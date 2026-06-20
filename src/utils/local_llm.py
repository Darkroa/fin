"""
FinA inIntelligence Engine
Context-aware AI fallback when no cloud API keys are configured.
Has full read access to user data, bot status, prices, and trade history.
"""
import re
from datetime import datetime
from typing import Optional, Dict, Any
from loguru import logger


# ── Intent detection ─────────────────────────────────────────────────────────

_INTENTS: Dict[str, list] = {
    "portfolio": [
        r"\bportfolio\b", r"\bbalance\b", r"\bmy (?:funds?|money|account)\b",
        r"\bhow much\b", r"\bwhat.*(?:have|got)\b",
    ],
    "price": [
        r"\bprice\b", r"\bhow much is\b", r"\brate\b", r"\bquote\b",
        r"\b(BTC|ETH|BNB|SOL|ADA|DOGE|XRP|AVAX|MATIC|DOT|LINK|LTC|BCH|ATOM|UNI)\b",
        r"\b(XAU|XAUUSD|XAG|XAGUSD|gold|silver|platinum|palladium)\b",
        r"\b(EUR|GBP|JPY|AUD|CHF|CAD|CNY|SGD|NZD|EURUSD|GBPUSD|USDJPY|AUDUSD|USDCHF)\b",
        r"\b(oil|crude|WTI|BRENT|NATGAS|gas)\b",
        r"\b(XAUUSD|XAGUSD|EURUSD|GBPUSD|USDJPY|AUDUSD|USDCHF|NZDUSD|CADUSD)\b",
    ],
    "pnl": [
        r"\bp&l\b", r"\bprofit\b", r"\bloss\b", r"\bearning\b",
        r"\bperformance\b", r"\bgain\b",
    ],
    "bot_status": [
        r"\bbot\b", r"\brun(?:ning)?\b", r"\bactive bot\b", r"\bstatus\b",
        r"\bmy bots?\b",
    ],
    "trade_history": [
        r"\btrades?\b", r"\bhistory\b", r"\blast.*trade\b", r"\brecent.*trade\b",
    ],
    "advice": [
        r"\bshould i\b", r"\badvice\b", r"\brecommend\b", r"\bsuggestion\b",
        r"\bwhat.*do\b", r"\bbuy.*sell\b", r"\bstrategy\b", r"\btip\b",
    ],
    "greeting": [
        r"^(?:hi|hey|hello|yo|sup|howdy|good\s+(?:morning|afternoon|evening))\b",
    ],
    "help": [
        r"^(?:help|\?|commands?)\s*$", r"\bwhat can you\b", r"\bwhat do you\b",
    ],
    "deposit": [r"\bdeposit\b", r"\btop.?up\b", r"\badd.*fund\b"],
    "withdraw": [r"\bwithdraw\b", r"\bcash.?out\b"],
    "market": [r"\bmarket\b", r"\bcrypto market\b", r"\boverall market\b"],
}


def detect_intent(text: str) -> str:
    text_lower = text.lower()
    for intent, patterns in _INTENTS.items():
        for p in patterns:
            if re.search(p, text_lower, re.IGNORECASE):
                return intent
    return "general"


# ── Context fetchers ──────────────────────────────────────────────────────────

def _get_user_context(user_email: Optional[str]) -> Dict[str, Any]:
    ctx: Dict[str, Any] = {}
    if not user_email:
        return ctx
    try:
        from src.database.session import SessionLocal
        from src.database.models import User, Transaction
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == user_email).first()
            if not user:
                return ctx
            ctx["email"] = user.email
            ctx["name"] = user.first_name or user.username or user_email.split("@")[0]
            ctx["balance"] = float(user.balance_usdt or 0)
            ctx["tier"] = user.account_tier or 0
            ctx["subscription"] = user.subscription or "free"
            ctx["kyc"] = user.kyc_status or "unverified"
            recent = (
                db.query(Transaction)
                .filter(Transaction.user_id == user.id)
                .order_by(Transaction.created_at.desc())
                .limit(5)
                .all()
            )
            ctx["recent_transactions"] = [
                {
                    "type": t.tx_type,
                    "amount": float(t.amount_usdt or 0),
                    "status": t.status,
                    "date": t.created_at.strftime("%b %d") if t.created_at else "—",
                }
                for t in recent
            ]
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"LocalAI: user context error: {e}")
    return ctx


def _get_bot_context(user_email: Optional[str]) -> Dict[str, Any]:
    ctx: Dict[str, Any] = {"bots": [], "total_pnl": 0.0, "bot_count": 0}
    try:
        if user_email:
            from src.users.crud import get_user_bot_manager
            manager = get_user_bot_manager(user_email, None)
        else:
            from src.trading.trade_bot import bot_manager as manager  # type: ignore
        statuses = manager.get_all_status() if manager else {}
        ctx["bot_count"] = len(statuses)
        ctx["total_pnl"] = sum(
            s.get("realized_pnl", 0) + s.get("unrealized_pnl", 0)
            for s in statuses.values()
        )
        ctx["bots"] = [
            {
                "ticker": ticker,
                "running": s.get("running", False),
                "pnl": float(s.get("realized_pnl", 0)),
                "strategy": s.get("strategy", "—"),
                "portfolio": float(s.get("portfolio_value", 0)),
            }
            for ticker, s in statuses.items()
        ]
    except Exception as e:
        logger.debug(f"LocalAI: bot context error: {e}")
    return ctx


def _fetch_price(ticker: str) -> Optional[float]:
    try:
        from src.trading.trade_bot import _fetch_live_price
        return _fetch_live_price(ticker.upper())
    except Exception:
        return None


# ── Response builders ─────────────────────────────────────────────────────────

def _reply_greeting(uc: Dict, bc: Dict) -> str:
    name = uc.get("name", "Trader")
    bal = uc.get("balance", 0.0)
    tier = uc.get("tier", 0)
    sub = uc.get("subscription", "free")
    hour = datetime.utcnow().hour
    tod = "morning" if hour < 12 else "afternoon" if hour < 17 else "evening"
    bots = bc.get("bots", [])
    bot_line = f"🤖 {len(bots)} bot(s) running" if bots else "🤖 No bots running"
    return (
        f"Good {tod}, {name}! 👋\n\n"
        f"💰 Balance: ${bal:,.2f} USDT\n"
        f"🏅 Tier {tier} · {sub.title()} plan\n"
        f"{bot_line}\n\n"
        "I'm FinAi — your trading assistant. Ask me anything or type /help."
    )


def _reply_portfolio(uc: Dict, bc: Dict) -> str:
    bal = uc.get("balance", 0.0)
    name = uc.get("name", "you")
    bots = bc.get("bots", [])
    total_pnl = bc.get("total_pnl", 0.0)
    lines = [f"💼 Portfolio — {name}\n"]
    lines.append(f"💰 Wallet: ${bal:,.2f} USDT")
    if bots:
        lines.append(f"\n🤖 Active Bots ({len(bots)}):")
        for b in bots:
            dot = "🟢" if b["running"] else "🔴"
            sign = "+" if b["pnl"] >= 0 else ""
            lines.append(f"  {dot} {b['ticker']} · ${b['portfolio']:,.2f} · P&L {sign}${b['pnl']:,.2f}")
        emoji = "📈" if total_pnl >= 0 else "📉"
        sign = "+" if total_pnl >= 0 else ""
        lines.append(f"\n{emoji} Total Bot P&L: {sign}${total_pnl:,.2f}")
    else:
        lines.append("\n🤖 No bots currently running")
    txs = uc.get("recent_transactions", [])
    if txs:
        lines.append("\n📋 Recent Activity:")
        for t in txs[:3]:
            sign = "+" if t["type"] in ("deposit", "bonus", "p2p_receive") else "-"
            lines.append(f"  {sign}${t['amount']:,.2f} · {t['type']} · {t['date']}")
    return "\n".join(lines)


def _reply_pnl(bc: Dict) -> str:
    bots = bc.get("bots", [])
    if not bots:
        return "📊 No active bots — P&L is $0.00\n\nStart a bot from the FinBots page to begin tracking profits."
    total = bc.get("total_pnl", 0.0)
    emoji = "📈" if total >= 0 else "📉"
    sign = "+" if total >= 0 else ""
    lines = [f"{emoji} P&L Summary\n", f"Total: {sign}${total:,.2f} USDT\n"]
    for b in bots:
        s = "+" if b["pnl"] >= 0 else ""
        lines.append(f"• {b['ticker']}: {s}${b['pnl']:,.2f} [{b['strategy'].upper()}]")
    return "\n".join(lines)


def _reply_bot_status(bc: Dict) -> str:
    bots = bc.get("bots", [])
    if not bots:
        return (
            "🤖 No bots running.\n\n"
            "Start one from the FinBots page or send:\n"
            "  /start BTC-USD"
        )
    lines = [f"🤖 Running Bots ({len(bots)})\n"]
    for b in bots:
        status = "🟢 RUNNING" if b["running"] else "🔴 STOPPED"
        lines.append(f"• {b['ticker']} — {status}\n  Strategy: {b['strategy'].upper()} · Value: ${b['portfolio']:,.2f}")
    return "\n".join(lines)


# ── Universal price resolver ──────────────────────────────────────────────────

# Maps user-typed symbols/words → canonical ticker for _fetch_live_price
_SYMBOL_ALIAS: Dict[str, str] = {
    # Gold / metals
    "XAUUSD": "XAU-USD", "XAUSD": "XAU-USD", "XAU": "XAU-USD", "GOLD": "XAU-USD",
    "XAGUSD": "XAG-USD", "XAGSD": "XAG-USD", "XAG": "XAG-USD", "SILVER": "XAG-USD",
    "PLATINUM": "XPT-USD", "XPT": "XPT-USD",
    "PALLADIUM": "XPD-USD", "XPD": "XPD-USD",
    # Oil / energy
    "OIL": "OIL-WTI", "CRUDE": "OIL-WTI", "WTI": "OIL-WTI",
    "BRENT": "OIL-WTI",
    "NATGAS": "NATGAS", "GAS": "NATGAS",
    # Crypto aliases
    "BTCUSD": "BTC-USD", "BTC": "BTC-USD",
    "ETHUSD": "ETH-USD", "ETH": "ETH-USD",
    "BNBUSD": "BNB-USD", "BNB": "BNB-USD",
    "SOLUSD": "SOL-USD", "SOL": "SOL-USD",
    "ADAUSD": "ADA-USD", "ADA": "ADA-USD",
    "DOGEUSD": "DOGE-USD", "DOGE": "DOGE-USD",
    "XRPUSD": "XRP-USD", "XRP": "XRP-USD",
    "AVAXUSD": "AVAX-USD", "AVAX": "AVAX-USD",
    "MATICUSD": "MATIC-USD", "MATIC": "MATIC-USD",
    "DOTUSD": "DOT-USD", "DOT": "DOT-USD",
    "LINKUSD": "LINK-USD", "LINK": "LINK-USD",
    "LTCUSD": "LTC-USD", "LTC": "LTC-USD",
    "BCHUSD": "BCH-USD", "BCH": "BCH-USD",
    "ATOMUSD": "ATOM-USD", "ATOM": "ATOM-USD",
    "UNIUSD": "UNI-USD", "UNI": "UNI-USD",
}

# Forex currency codes supported via frankfurter.app
_FOREX_CODES = {"EUR", "GBP", "JPY", "AUD", "CHF", "CAD", "CNY", "SGD", "HKD", "NZD", "MXN"}

# Maps common forex pair strings → (base, quote) or a direction
_FOREX_PAIRS: Dict[str, tuple] = {
    "EURUSD": ("EUR", "USD"), "EUR/USD": ("EUR", "USD"),
    "GBPUSD": ("GBP", "USD"), "GBP/USD": ("GBP", "USD"),
    "USDJPY": ("USD", "JPY"), "USD/JPY": ("USD", "JPY"),
    "AUDUSD": ("AUD", "USD"), "AUD/USD": ("AUD", "USD"),
    "USDCHF": ("USD", "CHF"), "USD/CHF": ("USD", "CHF"),
    "NZDUSD": ("NZD", "USD"), "NZD/USD": ("NZD", "USD"),
    "USDCAD": ("USD", "CAD"), "USD/CAD": ("USD", "CAD"),
    "USDCNY": ("USD", "CNY"), "USD/CNY": ("USD", "CNY"),
}


def _fetch_forex_price(pair_str: str) -> Optional[tuple]:
    """Return (rate_str, label) for a forex pair, or None if unavailable."""
    try:
        from src.utils.market_data import get_fx_rates
        data = get_fx_rates()
        rates = data.get("rates", {})
        pu = pair_str.upper().replace("/", "").replace("-", "")
        # Check known pairs
        pair = _FOREX_PAIRS.get(pu) or _FOREX_PAIRS.get(pair_str.upper())
        if pair:
            base, quote = pair
            if base == "USD" and quote in rates:
                # USD/JPY style — frankfurter gives JPY per USD
                r = rates[quote]["rate"]
                return (f"{r:.4f}", f"{base}/{quote}")
            elif quote == "USD" and base in rates:
                # EUR/USD style — invert
                r = rates[base]["rate"]
                inv = round(1 / r, 5) if r else None
                if inv:
                    return (f"{inv:.5f}", f"{base}/{quote}")
        # Maybe just a currency code typed alone (e.g. "EUR")
        code = pu[:3]
        if code in rates:
            r = rates[code]["rate"]
            inv = round(1 / r, 5) if r else None
            if inv:
                return (f"{inv:.5f}", f"{code}/USD")
    except Exception as exc:
        logger.debug(f"LocalAI: forex fetch error: {exc}")
    return None


def _fetch_any_price(symbol_raw: str) -> Optional[str]:
    """
    Universal price fetch — handles crypto, gold, silver, forex, oil, etc.
    Returns a formatted string like '$ 3,290.50' or '1.08523' or None.
    """
    su = symbol_raw.strip().upper().replace("/", "").replace("-", "")

    # 1. Try forex pairs first (before alias mapping)
    forex = _fetch_forex_price(su)
    if forex:
        rate_str, label = forex
        return f"{label}: {rate_str}"

    # 2. Map alias → canonical ticker
    canonical = _SYMBOL_ALIAS.get(su) or _SYMBOL_ALIAS.get(symbol_raw.upper())
    if not canonical:
        # If ends in USD, try stripping it
        if su.endswith("USD") and len(su) > 3:
            base = su[:-3]
            canonical = _SYMBOL_ALIAS.get(base) or f"{base}-USD"
        else:
            canonical = f"{su}-USD"

    # 3. Fetch via _fetch_live_price (handles crypto + metals via Binance/Kraken/Yahoo)
    try:
        from src.trading.trade_bot import _fetch_live_price
        price = _fetch_live_price(canonical)
        if price and price > 0:
            if price >= 1000:
                return f"${price:,.2f}"
            elif price >= 1:
                return f"${price:,.4f}"
            else:
                return f"${price:.6f}"
    except Exception as exc:
        logger.debug(f"LocalAI: price fetch error for {canonical}: {exc}")
    return None


def _extract_symbols(message: str) -> list[str]:
    """Extract all market symbols mentioned in a message."""
    msg_up = message.upper()
    found = []

    # Check forex pairs first
    for pair in _FOREX_PAIRS:
        if pair.replace("/", "") in msg_up.replace("/", ""):
            if pair not in found:
                found.append(pair)

    # Check aliases (crypto, metals, oil, etc.)
    for alias in _SYMBOL_ALIAS:
        pattern = r"\b" + re.escape(alias) + r"\b"
        if re.search(pattern, msg_up):
            canonical = _SYMBOL_ALIAS[alias]
            if canonical not in found:
                found.append(alias)

    # Fallback words
    word_map = {
        "GOLD": "GOLD", "SILVER": "SILVER", "OIL": "OIL", "CRUDE": "CRUDE",
        "PLATINUM": "PLATINUM", "NATGAS": "NATGAS",
    }
    for word, alias in word_map.items():
        if re.search(r"\b" + word + r"\b", msg_up) and alias not in found:
            found.append(alias)

    return found[:6]


def _reply_price(message: str) -> str:
    symbols = _extract_symbols(message)
    if not symbols:
        # Default to BTC + ETH if nothing specific mentioned
        symbols = ["BTC", "ETH"]

    lines = ["💰 Live Market Prices\n"]
    for sym in symbols:
        result = _fetch_any_price(sym)
        display = sym.upper()
        if result:
            lines.append(f"• {display}: {result}")
        else:
            lines.append(f"• {display}: Unavailable right now")
    return "\n".join(lines)


def _reply_advice(uc: Dict, bc: Dict) -> str:
    bal = uc.get("balance", 0.0)
    sub = uc.get("subscription", "free")
    bots = bc.get("bots", [])
    total_pnl = bc.get("total_pnl", 0.0)
    lines = ["💡 FinAi Trading Insights\n"]
    if bal < 200:
        lines.append(
            "⚠️ Balance below $200 minimum to run a bot.\n"
            "Make a deposit to unlock automated trading."
        )
    elif not bots:
        lines.append(
            "✅ Balance ready — no bots running yet.\n\n"
            "Recommended strategies:\n"
            "• FinLux — LuxAlgo breakouts, best for trending markets\n"
            "• SMA — steady crossover for stable assets\n"
            "• Auto — AI picks the best strategy dynamically\n\n"
            "Start with BTC-USD or ETH-USD for best liquidity."
        )
    else:
        emoji = "📈" if total_pnl >= 0 else "📉"
        if total_pnl < -50:
            lines.append(
                f"{emoji} Bots down ${abs(total_pnl):.2f}.\n"
                "Consider reviewing stop-loss settings or pausing underperforming bots."
            )
        else:
            lines.append(
                f"{emoji} Bots performing well (P&L: ${total_pnl:+.2f}).\n"
                "Consider diversifying into additional trading pairs."
            )
    if sub == "free":
        lines.append(
            "\n🔒 Upgrade to Pro to unlock FinLux + SMA strategies and up to 10 bots."
        )
    lines.append("\n📌 This is AI guidance from local context. Always apply your own judgment.")
    return "\n".join(lines)


def _reply_help() -> str:
    return (
        "🤖 FinAi Assistant — Commands\n\n"
        "📊 Account\n"
        "• /portfolio — Balance, bots & recent activity\n"
        "• /pnl — Today's profit & loss\n"
        "• /balance — Wallet balance\n\n"
        "🤖 Bots\n"
        "• /bots — Running bots\n"
        "• /status — Bot status\n"
        "• /start BTC-USD — Launch a paper bot\n"
        "• /stop ALL — Stop all bots\n\n"
        "💰 Market\n"
        "• /price BTC — Live BTC price\n"
        "• /price ETH — Live ETH price\n\n"
        "💬 AI Chat\n"
        "• /ask <question> — Ask anything\n"
        "  e.g. /ask What is my portfolio worth?\n"
        "  e.g. /ask Should I buy ETH now?\n\n"
        "📋 Other\n"
        "• /trades — Last 5 trades\n"
        "• /help — Show this menu"
    )


def _reply_trade_history(uc: Dict) -> str:
    txs = uc.get("recent_transactions", [])
    if not txs:
        return "📋 No recent transactions found."
    lines = ["📋 Recent Activity\n"]
    for t in txs:
        sign = "+" if t["type"] in ("deposit", "bonus", "p2p_receive") else "-"
        lines.append(f"• {sign}${t['amount']:,.2f} · {t['type']} · {t['date']} [{t['status']}]")
    return "\n".join(lines)


def _reply_general(message: str, uc: Dict) -> str:
    name = uc.get("name", "Trader")
    lower = message.lower()
    if any(w in lower for w in ["thank", "thanks", "thx", "appreciate"]):
        return f"You're welcome, {name}! 😊 Happy to help. Type /help for all commands."
    if any(w in lower for w in ["bye", "goodbye", "ciao", "later"]):
        return f"Goodbye, {name}! Happy trading 🚀"
    if "how are you" in lower or "how r u" in lower:
        return "Running perfectly ⚡ — all systems nominal. How can I help you trade today?"
    if any(w in lower for w in ["deposit", "fund", "add money", "top up"]):
        return (
            "💳 Deposits\n\n"
            "Go to Wallet → Deposit to get your deposit address.\n"
            "Supported: USDT (TRC20/ERC20), BTC, ETH\n\n"
            "After sending, submit a deposit request — admin approves within 24h."
        )
    if any(w in lower for w in ["withdraw", "cash out"]):
        bal = uc.get("balance", 0.0)
        tier = uc.get("tier", 0)
        if tier < 1:
            return "⚠️ KYC Tier 1 required for withdrawals. Complete KYC in your Profile."
        limit = "$500/day" if tier == 1 else "$5,000/day" if tier == 2 else "Unlimited"
        return f"💸 Withdrawals\n\nBalance: ${bal:,.2f} USDT\nDaily limit: {limit}\n\nGo to Wallet → Withdraw."
    return (
        f"🤖 Hi {name}! I'm your local FinAi assistant.\n\n"
        "I can help with portfolio info, bot status, P&L, live prices, and trading tips.\n\n"
        "Type /help for the full command list."
    )


# ── Public API ────────────────────────────────────────────────────────────────

def local_chat(message: str, user_email: Optional[str] = None) -> str:
    """
    Main entry point — returns a response without any cloud API calls.
    Has full access to user account data, bot status, and live prices.
    """
    uc = _get_user_context(user_email)
    bc = _get_bot_context(user_email)
    intent = detect_intent(message)
    logger.debug(f"LocalAI intent={intent!r} user={user_email}")

    if intent == "greeting":
        return _reply_greeting(uc, bc)
    if intent == "portfolio":
        return _reply_portfolio(uc, bc)
    if intent == "pnl":
        return _reply_pnl(bc)
    if intent == "bot_status":
        return _reply_bot_status(bc)
    if intent == "price":
        return _reply_price(message)
    if intent == "advice":
        return _reply_advice(uc, bc)
    if intent == "help":
        return _reply_help()
    if intent == "trade_history":
        return _reply_trade_history(uc)
    if intent == "deposit":
        return _reply_general("deposit", uc)
    if intent == "withdraw":
        return _reply_general("withdraw", uc)
    return _reply_general(message, uc)


class LocalAI:
    """
    Drop-in replacement for LangChain ChatOpenAI when no API keys are present.
    Compatible with .invoke(messages) interface used by agent.py.
    """

    def __init__(self, user_email: Optional[str] = None):
        self._user_email = user_email

    def invoke(self, messages):
        user_msg = ""
        if isinstance(messages, list):
            for m in reversed(messages):
                if isinstance(m, dict) and m.get("role") == "user":
                    user_msg = m.get("content", "")
                    break
        elif isinstance(messages, str):
            user_msg = messages
        reply = local_chat(user_msg, self._user_email)
        return type("AIMessage", (), {"content": reply})()
