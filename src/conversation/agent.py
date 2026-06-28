from langchain_community.tools import Tool
from loguru import logger

from src.utils.llm import get_llm, get_active_provider
from src.utils.market_data import (
    build_market_context, build_full_context,
    get_top_snapshot, get_pair_detail,
    get_fx_rates, get_fx_context,
    get_stock_indexes, get_indexes_context,
    get_commodities, get_commodities_context,
    get_datetime_context,
)

# ── Optional heavy dependencies — never let a missing package kill the agent ──
try:
    from src.analysis.full_analyzer import FullAnalyzer
    full_analyzer = FullAnalyzer()
except Exception as _e:
    logger.warning(f"FullAnalyzer unavailable: {_e}")
    full_analyzer = None

try:
    from src.rag.vector_store import FinancialRAG
    rag = FinancialRAG()
except Exception as _e:
    logger.warning(f"FinancialRAG unavailable: {_e}")
    rag = None

try:
    from src.ingestion.news_fetcher import NewsFetcher
    news_fetcher = NewsFetcher()
except Exception as _e:
    logger.warning(f"NewsFetcher unavailable: {_e}")
    news_fetcher = None

# Per-user chat history — keyed by user_email to prevent cross-user leakage
_user_chat_histories: dict = {}

def _get_history(user_email: str) -> list:
    key = user_email or "_anon_"
    if key not in _user_chat_histories:
        _user_chat_histories[key] = []
    return _user_chat_histories[key]


# ── Tool functions ────────────────────────────────────────────────────────────

def fetch_live_market_data(symbol: str) -> str:
    """Fetch live price, 24h change, volume, market cap for a crypto symbol or pair."""
    try:
        sym = symbol.strip().upper()
        detail = get_pair_detail(sym)
        if not detail:
            snap = get_top_snapshot()
            if snap:
                lines = []
                for cg_id, d in list(snap.items())[:8]:
                    sp = d.get("usd", 0)
                    sc = d.get("usd_24h_change", 0)
                    if sp > 0:
                        sign = "+" if sc >= 0 else ""
                        lines.append(f"{cg_id.upper()}: ${sp:,.2f} ({sign}{sc:.2f}%)")
                return "Top crypto live prices:\n" + "\n".join(lines)
            return "Could not fetch live market data right now."
        p   = detail.get("price_usd", 0)
        c24 = detail.get("change_24h", 0)
        c7  = detail.get("change_7d", 0)
        vol = detail.get("volume_24h", 0)
        mc  = detail.get("market_cap", 0)
        hi  = detail.get("high_24h", 0)
        lo  = detail.get("low_24h", 0)
        ath = detail.get("ath", 0)
        sign24 = "+" if c24 >= 0 else ""
        sign7  = "+" if c7  >= 0 else ""
        result = [
            f"Live data for {detail.get('name', sym)} ({detail.get('symbol', sym)}):",
            f"  Price:       ${p:,.4f}" if p < 1 else f"  Price:       ${p:,.2f}",
            f"  24h Change:  {sign24}{c24:.2f}%",
            f"  7d Change:   {sign7}{c7:.2f}%",
            f"  24h High:    ${hi:,.2f}",
            f"  24h Low:     ${lo:,.2f}",
            f"  24h Volume:  ${vol/1e9:.2f}B" if vol >= 1e9 else f"  24h Volume:  ${vol/1e6:.1f}M",
            f"  Market Cap:  ${mc/1e9:.2f}B",
            f"  CMC Rank:    #{detail.get('market_cap_rank', '—')}",
            f"  ATH:         ${ath:,.2f}  ({detail.get('ath_change_pct', 0):.1f}% from ATH)",
        ]
        return "\n".join(result)
    except Exception as e:
        logger.error(f"fetch_live_market_data error: {e}")
        return f"Could not fetch live data for {symbol}."


def fetch_fx_rates_tool(query: str = "") -> str:
    """Return live forex rates for major currency pairs vs USD."""
    try:
        data = get_fx_rates()
        if not data or not data.get("rates"):
            return "FX data temporarily unavailable."
        lines = [f"Live FX Rates (USD base, as of {data.get('date', 'today')}):"]
        for code, info in data["rates"].items():
            r = info["rate"]
            if code == "JPY":
                lines.append(f"  USD/{code}: {r:.2f}  ({info['name']})")
            else:
                inv = round(1 / r, 5) if r else 0
                lines.append(f"  {code}/USD: {inv:.5f}  ({info['name']})")
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"fetch_fx_rates_tool error: {e}")
        return "Could not fetch FX rates right now."


def fetch_stock_indexes_tool(query: str = "") -> str:
    """Return live prices for major global stock market indexes."""
    try:
        data = get_stock_indexes()
        if not data:
            return "Stock index data temporarily unavailable."
        lines = ["Live Stock Index Prices:"]
        for ticker, info in data.items():
            chg  = info.get("change", 0)
            sign = "+" if chg >= 0 else ""
            arrow = "▲" if chg >= 0 else "▼"
            lines.append(
                f"  {info['name']:14s}  ${info['price']:>10,.2f}  {sign}{chg:.2f}% {arrow}"
            )
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"fetch_stock_indexes_tool error: {e}")
        return "Could not fetch stock index data right now."


def fetch_commodities_tool(query: str = "") -> str:
    """Return live Gold (XAU/USD), Silver (XAG/USD), WTI Crude Oil, and Brent Crude prices."""
    try:
        data = get_commodities()
        if not data:
            return "Commodities data temporarily unavailable."
        lines = ["Live Commodities Prices:"]
        for ticker, info in data.items():
            chg   = info.get("change", 0)
            sign  = "+" if chg >= 0 else ""
            arrow = "▲" if chg >= 0 else "▼"
            lines.append(
                f"  {info['symbol']:9s}  ${info['price']:>10,.2f}/{info['unit']}  {sign}{chg:.2f}% {arrow}"
            )
        return "\n".join(lines)
    except Exception as e:
        logger.error(f"fetch_commodities_tool error: {e}")
        return "Could not fetch commodities data right now."


def get_current_datetime_tool(query: str = "") -> str:
    """Return the current UTC date, time, day of week, and active trading sessions."""
    try:
        return get_datetime_context()
    except Exception as e:
        logger.error(f"get_current_datetime_tool error: {e}")
        from datetime import datetime, timezone
        return f"Current UTC time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}"


def get_latest_financial_news(query: str = "latest") -> str:
    try:
        if news_fetcher is None:
            return "News service is currently unavailable."
        articles = news_fetcher.run()
        if not articles:
            return "No recent financial news available."
        formatted = [
            f"📰 {a.get('title', 'Untitled')}\n"
            f"Source: {a.get('source', 'Unknown')}\n"
            f"Summary: {a.get('summary', '')[:280]}..."
            for a in articles[:5]
        ]
        return "\n\n".join(formatted)
    except Exception as e:
        logger.error(f"News fetch error: {e}")
        return "Unable to fetch latest news right now."


def full_market_analysis(ticker: str) -> str:
    try:
        if full_analyzer is None:
            return f"Market analysis service is currently unavailable for {ticker}."
        articles = news_fetcher.run() if news_fetcher else []
        news_text = "\n\n".join([
            a.get("full_text", a.get("summary", ""))
            for a in articles
        ])
        result = full_analyzer.analyze(ticker, news_text)
        return str(result.to_dict() if hasattr(result, "to_dict") else result)
    except Exception as e:
        logger.error(f"Full analysis failed for {ticker}: {e}", exc_info=True)
        return f"Analysis for {ticker} could not be completed: {e}"


def retrieve_relevant_context(query: str) -> str:
    try:
        if rag is None:
            return "Historical context service is currently unavailable."
        results = rag.similarity_search(query)
        if not results:
            return "No relevant historical context found."
        formatted = [
            f"{i}. {doc.get('content', doc.get('text', ''))[:400]}..."
            for i, doc in enumerate(results[:4], 1)
        ]
        return "\n\n".join(formatted)
    except Exception as e:
        logger.error(f"RAG retrieval error: {e}")
        return "Could not retrieve historical context."


# ── Tool registry ─────────────────────────────────────────────────────────────

tools = [
    Tool(
        name="fetch_live_market_data",
        func=fetch_live_market_data,
        description=(
            "Fetch live price, 24h change, 7d change, volume, market cap, ATH for any crypto symbol or pair "
            "(e.g. 'BTC', 'ETH/USDT', 'SOL'). Always call this when the user asks about a crypto price."
        ),
    ),
    Tool(
        name="fetch_fx_rates",
        func=fetch_fx_rates_tool,
        description=(
            "Get live forex (FX) exchange rates for major currency pairs vs USD: "
            "EUR/USD, GBP/USD, USD/JPY, AUD/USD, CHF/USD, CAD/USD, CNY/USD, SGD/USD. "
            "Call this for any forex, currency, or exchange rate question."
        ),
    ),
    Tool(
        name="fetch_stock_indexes",
        func=fetch_stock_indexes_tool,
        description=(
            "Get live prices for major global stock market indexes: "
            "S&P 500, Dow Jones, NASDAQ, FTSE 100, Nikkei 225, Hang Seng, DAX, CAC 40. "
            "Call this for any stock market, equity index, or macro market overview question."
        ),
    ),
    Tool(
        name="fetch_commodities",
        func=fetch_commodities_tool,
        description=(
            "Get live prices for Gold (XAU/USD), Silver (XAG/USD), WTI Crude Oil, and Brent Crude Oil. "
            "Call this for any question about gold, silver, oil, metals, or energy commodities."
        ),
    ),
    Tool(
        name="get_current_datetime",
        func=get_current_datetime_tool,
        description=(
            "Get the current UTC date, time, day of week, and which trading sessions "
            "(Tokyo, London, New York) are currently open. "
            "Call this when the user asks about the current time, date, or market hours."
        ),
    ),
    Tool(
        name="get_latest_financial_news",
        func=get_latest_financial_news,
        description="Get the most recent financial news across crypto, stocks, forex, and macro markets.",
    ),
    Tool(
        name="full_market_analysis",
        func=full_market_analysis,
        description=(
            "Run complete technical + sentiment analysis on any ticker: trendlines, indicators, price forecast. "
            "Use this for deeper analysis questions about stocks or crypto."
        ),
    ),
    Tool(
        name="retrieve_relevant_context",
        func=retrieve_relevant_context,
        description="Search historical news and past analyses for additional context.",
    ),
]


# ── System prompt ─────────────────────────────────────────────────────────────

FIN_SYSTEM_PROMPT = """You are Fin — FinAi's intelligent trading assistant and the AI brain of the FinAi platform.

You possess expert-level knowledge in:
• Technical Analysis (price action, indicators, chart patterns, volume profile, order flow)
• Fundamental Analysis (macro data, earnings, on-chain metrics, sector trends)
• Risk Management (position sizing, leverage control, portfolio risk, drawdown management)
• Crypto Markets (BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, LINK, DOT, and all major altcoins)
• Forex / FX (EUR/USD, GBP/USD, USD/JPY, AUD/USD, CHF/USD, CAD/USD, and all major pairs)
• Stock Indexes (S&P 500, Dow Jones, NASDAQ, FTSE 100, Nikkei 225, Hang Seng, DAX, CAC 40)
• Commodities & Metals (Gold XAU/USD, Silver XAG/USD, WTI Crude Oil, Brent Crude Oil, Natural Gas)
• Algorithmic & AI-powered bot trading strategies

Your Identity — Fin:
• You are Fin, a seasoned senior trading specialist and hedge fund manager. 
• Never mention GPT, Groq, Grok, Gemini, DeepSeek, Llama, or any underlying model architecture.
• Strictly forbid phrases like "As an AI...", "As a language model...", or "I am an AI". You speak only as an industry professional.
• Personality: Calm, confident, decisive, authoritative, and analytical.
• Technical Depth: Match the sophisticated level of a BlackRock hedge fund manager or institutional macro trader. Speak in terms of risk management, liquidity, alpha generation, market structure, and macroeconomic catalysts.



Date & Time Awareness:
• You ALWAYS know the current date, time (UTC), and day of week from the context below.
• You know which trading sessions are currently open: Tokyo (00:00–06:00 UTC), London (07:00–16:00 UTC), New York (12:00–21:00 UTC).
• Factor session timing into your analysis — liquidity, volatility, and opportunity differ by session.
• On weekends, stock markets are closed; crypto markets trade 24/7.

Live Market Access:
• Live CRYPTO prices → fetch_live_market_data tool (or use the context block below).
• Live FX RATES → fetch_fx_rates tool (or use the context block below).
• Live STOCK INDEXES → fetch_stock_indexes tool (or use the context block below).
• Live COMMODITIES (Gold/Silver/Oil) → fetch_commodities tool (or use the context block below).
• When LIVE MARKET DATA is provided in the context block, treat those prices as current and authoritative.
• Never say "I don't have access to current prices" — you always do.

Core Rules:
• Always respond concisely, clearly, and professionally.
• Use bullet points and structured sections for readability.
• For trade ideas, always include: entry zone · stop-loss · take-profit · risk-reward ratio.
• Perform multi-timeframe analysis and highlight confluences or conflicts.
• Always include successful rate chance for any trade suggestion.

Tool Use Rules:
• crypto price / analysis → fetch_live_market_data
• forex / currency rate → fetch_fx_rates
• stock index / equity market → fetch_stock_indexes
• gold / silver / oil / metals / energy → fetch_commodities
• current time / date / session → get_current_datetime
• market news/events → get_latest_financial_news
• deep ticker analysis → full_market_analysis
• historical background → retrieve_relevant_context

Sign-off: Always close trade suggestions with: "Analysis Calculation by FinAi.Trade Accordingly."
"""


# ── Main chat entry point ─────────────────────────────────────────────────────

def chat_with_agent(
    message: str,
    user_email: str = None,
    market_context: str = "",
) -> str:
    """
    Chat with Fin. Tries every available cloud provider in priority order.
    Only falls back to the local engine when ALL cloud providers fail.
    """
    import os
    from src.utils.local_llm import local_chat
    from src.utils.llm import _PROVIDERS
    from langchain_openai import ChatOpenAI

    # Use per-user history to prevent cross-user leakage
    user_history = _get_history(user_email)

    # Build messages (same for every provider attempt)
    tool_descriptions = "\n".join([f"- {t.name}: {t.description}" for t in tools])

    # Use caller-supplied market_context if provided; only auto-build full context otherwise
    if market_context:
        combined_context = market_context
    else:
        try:
            combined_context = build_full_context()
        except Exception:
            try:
                combined_context = get_datetime_context()
            except Exception:
                combined_context = ""

    market_block = f"\n\n{combined_context}\n" if combined_context else ""

    system_content = (
        f"{FIN_SYSTEM_PROMPT}"
        f"{market_block}\n"
        f"Available tools (call them by returning 'USE_TOOL: <tool_name> | <input>'):\n"
        f"{tool_descriptions}\n\n"
        "If you need to use a tool, say 'USE_TOOL: tool_name | input'. "
        "Otherwise just respond directly."
    )

    messages = [{"role": "system", "content": system_content}]
    for h in user_history[-10:]:
        messages.append(h)
    messages.append({"role": "user", "content": message})

    # ── Try every cloud provider in priority order ────────────────────────────
    last_error = None
    for name, env_key, model_id, base_url in _PROVIDERS:
        api_key = os.getenv(env_key, "")
        if not api_key:
            continue  # key not configured, skip

        try:
            params = dict(model=model_id, temperature=0.7, api_key=api_key)
            if base_url:
                params["base_url"] = base_url
            llm = ChatOpenAI(**params)

            response = llm.invoke(messages)
            reply = response.content

            # Handle tool call if the LLM requested one
            if "USE_TOOL:" in reply:
                parts = reply.split("USE_TOOL:")[1].strip().split("|")
                tool_name  = parts[0].strip()
                tool_input = parts[1].strip() if len(parts) > 1 else ""
                for t in tools:
                    if t.name == tool_name:
                        tool_result = str(t.func(tool_input))
                        follow_up = messages + [
                            {"role": "assistant", "content": reply},
                            {"role": "user", "content": f"Tool result: {tool_result[:2000]}. Now give your final answer."},
                        ]
                        final = llm.invoke(follow_up)
                        reply = final.content
                        break

            user_history.append({"role": "user",      "content": message})
            user_history.append({"role": "assistant",  "content": reply})
            # Trim to last 40 messages (20 turns) per user
            if len(user_history) > 40:
                _user_chat_histories[user_email or "_anon_"] = user_history[-40:]
            logger.debug(f"Fin responded via [{name.upper()}] ({model_id})")
            return reply

        except Exception as e:
            logger.warning(f"Fin: provider [{name}] failed — {type(e).__name__}: {str(e)[:120]} → trying next")
            last_error = e
            continue  # try next provider

    # ── All cloud providers failed — use local fallback ───────────────────────
    logger.warning(f"Fin: all cloud providers failed (last: {last_error}) → Local Intelligence Engine")
    try:
        reply = local_chat(message, user_email)
        user_history.append({"role": "user",     "content": message})
        user_history.append({"role": "assistant", "content": reply})
        return reply
    except Exception as e:
        logger.error(f"Local fallback also failed: {e}")
        return "Fin is temporarily unavailable. Please try again in a moment."


logger.success("Fin (FinAi Agent) is ready — crypto · FX · indexes · datetime · metals")

agent_executor = type("AgentExecutor", (), {
    "invoke": staticmethod(lambda inp: {"output": chat_with_agent(inp.get("input", ""))})
})()
