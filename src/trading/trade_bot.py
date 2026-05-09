import time
import threading
import requests
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
from loguru import logger

from src.database.models import TrendAnalysis, TradeLog, User
from src.database.session import SessionLocal
from src.notifications.notifier import Notifier

notifier = Notifier()

# ── Coin ID map for CoinGecko (cached) ──
COINGECKO_ID_MAP = {
    "BTC-USD": "bitcoin", "ETH-USD": "ethereum", "SOL-USD": "solana",
    "XRP-USD": "ripple",  "BNB-USD": "binancecoin", "ADA-USD": "cardano",
    "AVAX-USD": "avalanche-2", "DOGE-USD": "dogecoin", "MATIC-USD": "matic-network",
    "LTC-USD": "litecoin", "LINK-USD": "chainlink", "DOT-USD": "polkadot",
}

# ── Binance symbol map ──
BINANCE_US_SYMBOL_MAP = {
    "BTC-USD": "BTCUSDT", "ETH-USD": "ETHUSDT", "SOL-USD": "SOLUSDT",
    "XRP-USD": "XRPUSDT", "BNB-USD": "BNBUSDT", "ADA-USD": "ADAUSDT",
    "AVAX-USD": "AVAXUSDT", "DOGE-USD": "DOGEUSDT", "MATIC-USD": "MATICUSDT",
    "LTC-USD": "LTCUSDT", "LINK-USD": "LINKUSDT", "DOT-USD": "DOTUSDT",
}

KRAKEN_PAIR_MAP = {
    "BTC-USD": "XBTUSD",  "ETH-USD": "ETHUSD",  "SOL-USD": "SOLUSD",
    "XRP-USD": "XRPUSD",  "ADA-USD": "ADAUSD",  "DOGE-USD": "XDGUSD",
    "LTC-USD": "LTCUSD",  "LINK-USD": "LINKUSD", "DOT-USD": "DOTUSD",
    "AVAX-USD": "AVAXUSD",
}

_price_cache: Dict[str, tuple] = {}  # ticker -> (price, ts)


def _fetch_live_price(ticker: str) -> float:
    """Fetch live price: Binance.US (crypto) → Kraken (fallback) → yfinance (stocks)."""
    cached = _price_cache.get(ticker)
    if cached and (time.time() - cached[1]) < 10:
        return cached[0]

    price = None
    t_upper = ticker.upper()

    # ── 1. Binance.US (crypto, no geo-block) ──
    bsym = BINANCE_US_SYMBOL_MAP.get(t_upper)
    if bsym:
        try:
            r = requests.get(
                f"https://api.binance.us/api/v3/ticker/price?symbol={bsym}",
                timeout=5,
            )
            if r.status_code == 200:
                price = float(r.json()["price"])
        except Exception:
            pass

    # ── 2. Kraken as crypto fallback ──
    if price is None:
        kpair = KRAKEN_PAIR_MAP.get(t_upper)
        if kpair:
            try:
                r = requests.get(
                    f"https://api.kraken.com/0/public/Ticker?pair={kpair}",
                    timeout=5,
                )
                if r.status_code == 200:
                    result = r.json().get("result", {})
                    if result:
                        first_key = next(iter(result))
                        price = float(result[first_key]["c"][0])
            except Exception:
                pass

    # ── 3. yfinance for stocks or remaining crypto ──
    if price is None and t_upper not in BINANCE_US_SYMBOL_MAP:
        try:
            import yfinance as yf
            # Use 5-day/1d for stocks (reliable after-hours & intraday)
            data = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=True)
            if not data.empty:
                price = float(data["Close"].iloc[-1])
        except Exception:
            pass

    # ── 4. Hard fallback ──
    if price is None:
        fallbacks = {
            "BTC-USD": 80365.0, "ETH-USD": 3050.0, "SOL-USD": 148.0,
            "XRP-USD": 0.52,    "BNB-USD": 600.0,  "ADA-USD": 0.44,
            "AVAX-USD": 34.0,   "DOGE-USD": 0.17,
            "NVDA": 215.0, "AAPL": 293.0, "TSLA": 428.0, "MSFT": 415.0,
            "GOOGL": 400.0, "AMZN": 272.0, "META": 609.0,
        }
        price = fallbacks.get(t_upper, 100.0)
        logger.debug(f"Using fallback price for {ticker}: {price}")
    else:
        logger.debug(f"Live price {ticker}: ${price:,.4f}")

    _price_cache[ticker] = (price, time.time())
    return price


def _place_binance_order(side: str, symbol: str, qty: float, api_key: str, secret: str) -> dict:
    """Place a market order on Binance via ccxt. Returns order dict or raises."""
    try:
        import ccxt
        exchange = ccxt.binance({"apiKey": api_key, "secret": secret, "enableRateLimit": True})
        pair = symbol.replace("-", "/").replace("_", "/")
        if "/" not in pair:
            pair = pair[:3] + "/" + pair[3:]
        if side.upper() == "BUY":
            order = exchange.create_market_buy_order(pair, qty)
        else:
            order = exchange.create_market_sell_order(pair, qty)
        return {"order_id": str(order.get("id", "")), "status": order.get("status", "submitted")}
    except Exception as e:
        logger.warning(f"Binance order failed ({symbol} {side}): {e}")
        raise


user_bot_managers: Dict[str, "UserBotManager"] = {}


class TradingBotInstance:
    """Single-ticker trading bot instance with live price fetching."""

    SMA_PERIOD = 6     # Use 6 price samples for SMA
    TICK_SECS  = 12    # Fetch price every 12 seconds

    def __init__(self, ticker: str, paper: bool = True, user_id: int = None,
                 initial_capital: float = 10000.0, max_drawdown_pct: float = 10.0,
                 risk_per_trade_pct: float = 1.0):
        self.ticker           = ticker.upper()
        self.paper            = paper
        self.user_id          = user_id

        self.initial_capital  = initial_capital
        self.capital          = initial_capital
        self.position         = 0.0
        self.entry_price      = 0.0
        self.trades: List[dict] = []

        self.max_drawdown_pct = max_drawdown_pct
        self.risk_per_trade_pct = risk_per_trade_pct
        self.peak_capital     = initial_capital
        self.max_drawdown_reached = 0.0

        self.running          = False
        self.thread           = None
        self.latest_price     = 0.0
        self.price_history: List[float] = []
        self.signal_state     = "NEUTRAL"   # BULLISH / BEARISH / NEUTRAL
        self.last_signal_time: datetime | None = None

        self.binance_api_key: str | None = None
        self.binance_secret:  str | None = None

    def start(self):
        if self.running:
            return f"Bot already running for {self.ticker}"
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        mode = "PAPER" if self.paper else "LIVE"
        logger.success(f"🚀 {mode} Bot STARTED → {self.ticker}")
        return f"Bot started on {self.ticker} ({mode})"

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        logger.info(f"🛑 Bot STOPPED → {self.ticker}")
        return f"Bot stopped for {self.ticker}"

    def get_status(self):
        portfolio_value  = self.capital + self.position * self.latest_price
        unrealized_pnl   = (self.latest_price - self.entry_price) * self.position
        self.peak_capital = max(self.peak_capital, portfolio_value)
        current_dd = ((self.peak_capital - portfolio_value) / self.peak_capital * 100) if self.peak_capital > 0 else 0

        pnl_trades    = [t for t in self.trades if t.get("pnl") is not None]
        total_pnl     = sum(t["pnl"] for t in pnl_trades)
        winning       = sum(1 for t in pnl_trades if t["pnl"] > 0)
        win_rate      = round(winning / len(pnl_trades) * 100, 1) if pnl_trades else 0.0

        return {
            "running":              self.running,
            "ticker":               self.ticker,
            "mode":                 "LIVE" if not self.paper else "PAPER",
            "balance":              round(self.capital, 2),
            "portfolio_value":      round(portfolio_value, 2),
            "unrealized_pnl":       round(unrealized_pnl, 2),
            "realized_pnl":         round(total_pnl, 2),
            "win_rate":             win_rate,
            "position":             round(self.position, 6),
            "entry_price":          round(self.entry_price, 4),
            "current_price":        round(self.latest_price, 4),
            "signal":               self.signal_state,
            "current_drawdown_pct": round(current_dd, 2),
            "total_trades":         len(self.trades),
            "recent_trades":        [
                {
                    "time":   t["time"].isoformat() if isinstance(t["time"], datetime) else str(t["time"]),
                    "action": t["action"],
                    "price":  round(t["price"], 4),
                    "qty":    round(t["qty"], 6),
                    "pnl":    round(t["pnl"], 2) if t.get("pnl") is not None else None,
                    "reason": t.get("reason", ""),
                }
                for t in sorted(self.trades, key=lambda x: x["time"], reverse=True)[:20]
            ],
        }

    def _sma(self) -> float | None:
        if len(self.price_history) < self.SMA_PERIOD:
            return None
        return sum(self.price_history[-self.SMA_PERIOD:]) / self.SMA_PERIOD

    def _update_user_balance(self, delta: float):
        """Add delta to user's balance_usdt in DB."""
        if not self.user_id:
            return
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == self.user_id).first()
            if user:
                user.balance_usdt = max(0.0, (user.balance_usdt or 0.0) + delta)
                db.commit()
        except Exception as e:
            logger.error(f"Balance update failed: {e}")
        finally:
            db.close()

    def _log_trade_to_db(self, trade: dict):
        db = SessionLocal()
        try:
            pnl_value = trade.get("pnl")
            if trade["action"] == "BUY":
                pnl_value = None
            log = TradeLog(
                user_id=self.user_id,
                ticker=trade["ticker"],
                action=trade["action"],
                price=trade["price"],
                qty=trade["qty"],
                pnl=pnl_value,
                reason=trade.get("reason"),
                paper=self.paper,
                exchange="bot",
            )
            db.add(log)
            db.commit()
            if trade["action"] == "SELL" and pnl_value is not None:
                open_buy = (
                    db.query(TradeLog)
                    .filter(
                        TradeLog.user_id == self.user_id,
                        TradeLog.ticker == trade["ticker"],
                        TradeLog.action == "BUY",
                        TradeLog.pnl == None,
                    )
                    .order_by(TradeLog.created_at.desc())
                    .first()
                )
                if open_buy:
                    open_buy.pnl = pnl_value
                    db.commit()
        except Exception as e:
            logger.error(f"Failed to log trade: {e}")
        finally:
            db.close()

    def _run_loop(self):
        tick = 0
        while self.running:
            try:
                # ── Fetch live price ──
                price = _fetch_live_price(self.ticker)
                self.latest_price = price
                self.price_history.append(price)
                if len(self.price_history) > 40:
                    self.price_history = self.price_history[-40:]

                # ── Drawdown guard ──
                portfolio_value = self.capital + self.position * price
                self.peak_capital = max(self.peak_capital, portfolio_value)
                current_dd = (self.peak_capital - portfolio_value) / self.peak_capital * 100 if self.peak_capital > 0 else 0
                self.max_drawdown_reached = max(self.max_drawdown_reached, current_dd)
                if current_dd > self.max_drawdown_pct:
                    logger.warning(f"🛑 Max drawdown {current_dd:.1f}% reached for {self.ticker}. Stopping.")
                    if self.position > 0:
                        self._close_position(price, "MAX_DRAWDOWN_STOP")
                    self.stop()
                    break

                # ── Need enough history for SMA ──
                sma = self._sma()
                if sma is None:
                    time.sleep(self.TICK_SECS)
                    tick += 1
                    continue

                # ── SMA crossover momentum strategy ──
                prev_sma = (sum(self.price_history[-self.SMA_PERIOD - 1:-1]) / self.SMA_PERIOD
                            if len(self.price_history) >= self.SMA_PERIOD + 1 else sma)

                price_above_sma = price > sma
                was_above       = self.price_history[-2] > prev_sma if len(self.price_history) >= 2 else price_above_sma

                bullish_cross = price_above_sma and not was_above  # crossed above
                bearish_cross = not price_above_sma and was_above  # crossed below

                # Also check hard stop-loss (3%)
                hard_stop = self.position > 0 and price < self.entry_price * 0.97
                # Take-profit: 4% gain
                take_profit = self.position > 0 and price > self.entry_price * 1.04

                # Update signal state for UI
                if price_above_sma:
                    self.signal_state = "BULLISH"
                elif not price_above_sma:
                    self.signal_state = "BEARISH"

                # ── Entry ──
                if bullish_cross and self.position <= 0:
                    risk_amt = self.capital * (self.risk_per_trade_pct / 100)
                    qty = min((self.capital * 0.95) / price, risk_amt * 10 / price)
                    if qty > 0.00001:
                        self._open_position(qty, price, "SMA_BULLISH_CROSS")

                # ── Exit ──
                elif (bearish_cross or hard_stop or take_profit) and self.position > 0:
                    reason = "TAKE_PROFIT" if take_profit else ("HARD_STOP_LOSS" if hard_stop else "SMA_BEARISH_CROSS")
                    self._close_position(price, reason)

            except Exception as e:
                logger.error(f"Bot loop error for {self.ticker}: {e}")

            time.sleep(self.TICK_SECS)
            tick += 1

    def _open_position(self, qty: float, price: float, reason: str):
        try:
            cost = qty * price
            if not self.paper and self.binance_api_key and self.binance_secret:
                try:
                    _place_binance_order("BUY", self.ticker, round(qty, 4), self.binance_api_key, self.binance_secret)
                except Exception as e:
                    logger.warning(f"Binance BUY skipped, using internal balance: {e}")

            self.capital    -= cost
            self.position    = qty
            self.entry_price = price

            # Deduct from user's DB balance
            if not self.paper:
                self._update_user_balance(-cost)

            trade = {
                "time":   datetime.now(),
                "ticker": self.ticker,
                "action": "BUY",
                "price":  price,
                "qty":    qty,
                "pnl":    None,
                "reason": reason,
            }
            self.trades.append(trade)
            self._log_trade_to_db(trade)
            logger.success(f"🟢 BUY  {qty:.6f} {self.ticker} @ ${price:,.4f}  [{reason}]  cost=${cost:,.2f}")
        except Exception as e:
            logger.error(f"Failed to open {self.ticker}: {e}")

    def _close_position(self, price: float, reason: str):
        if self.position <= 0:
            return
        pnl      = (price - self.entry_price) * self.position
        proceeds = self.position * price
        try:
            if not self.paper and self.binance_api_key and self.binance_secret:
                try:
                    _place_binance_order("SELL", self.ticker, round(self.position, 4), self.binance_api_key, self.binance_secret)
                except Exception as e:
                    logger.warning(f"Binance SELL skipped, using internal balance: {e}")

            self.capital += proceeds

            # Return proceeds to user's DB balance
            if not self.paper:
                self._update_user_balance(proceeds)

            trade = {
                "time":   datetime.now(),
                "ticker": self.ticker,
                "action": "SELL",
                "price":  price,
                "qty":    self.position,
                "pnl":    pnl,
                "reason": reason,
            }
            self.trades.append(trade)
            self._log_trade_to_db(trade)
            emoji = "📈" if pnl >= 0 else "📉"
            logger.info(f"🔴 SELL {self.position:.6f} {self.ticker} @ ${price:,.4f}  [{reason}]  P&L=${pnl:+.2f} {emoji}")
            self.position    = 0.0
            self.entry_price = 0.0
        except Exception as e:
            logger.error(f"Failed to close {self.ticker}: {e}")


class TradingBot:
    """Multi-ticker trading bot (legacy compatibility)."""

    def __init__(self, tickers: list, initial_capital: float = 10000.0,
                 max_drawdown_pct: float = 10.0, risk_per_trade_pct: float = 1.0,
                 paper: bool = True):
        self.tickers = [t.upper() for t in tickers]
        self.paper = paper
        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.positions: dict = {t: 0.0 for t in self.tickers}
        self.entry_prices: dict = {t: 0.0 for t in self.tickers}
        self.trades: list = []
        self.max_drawdown_pct = max_drawdown_pct
        self.risk_per_trade_pct = risk_per_trade_pct
        self.peak_capital = initial_capital
        self.max_drawdown_reached = 0.0
        self.running = False
        self.thread = None
        self.latest_prices: dict = {t: 100.0 for t in self.tickers}

    def start(self):
        if self.running:
            return f"Bot already running for {self.tickers}"
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        return f"Bot started on {self.tickers}"

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        return f"Bot stopped for {self.tickers}"

    def get_status(self):
        portfolio_value = self.capital
        unrealized_pnl = 0.0
        for t in self.tickers:
            pos = self.positions.get(t, 0.0)
            price = self.latest_prices.get(t, 100.0)
            portfolio_value += pos * price
            unrealized_pnl += (price - self.entry_prices.get(t, 0.0)) * pos
        self.peak_capital = max(self.peak_capital, portfolio_value)
        current_dd = ((self.peak_capital - portfolio_value) / self.peak_capital * 100) if self.peak_capital > 0 else 0
        return {
            "running": self.running,
            "tickers": self.tickers,
            "mode": "LIVE" if not self.paper else "PAPER",
            "balance": round(self.capital, 2),
            "portfolio_value": round(portfolio_value, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "current_drawdown_pct": round(current_dd, 2),
            "total_trades": len(self.trades),
        }

    def _run_loop(self):
        while self.running:
            time.sleep(30)


class BotManager:
    def __init__(self):
        self.bots: Dict[str, TradingBot] = {}

    def start_bot(self, tickers: list, paper: bool = True, initial_capital: float = 10000.0):
        key = ",".join([t.upper() for t in tickers])
        if key in self.bots and self.bots[key].running:
            return f"Bot already running for {tickers}"
        bot = TradingBot(tickers=tickers, initial_capital=initial_capital, paper=paper)
        self.bots[key] = bot
        return bot.start()

    def stop_bot(self, tickers: list):
        key = ",".join([t.upper() for t in tickers])
        if key in self.bots:
            return self.bots[key].stop()
        return "Bot not found"

    def get_all_status(self):
        return {key: bot.get_status() for key, bot in self.bots.items()}


class UserBotManager:
    """Manages trading bots per user."""

    def __init__(self, user_id: int, user_email: str):
        self.user_id    = user_id
        self.user_email = user_email
        self.bots: Dict[str, TradingBotInstance] = {}

    def start_bot(self, ticker: str, paper: bool = True,
                  initial_capital: float = 1000.0,
                  risk_per_trade_pct: float = 1.0,
                  max_drawdown_pct: float = 10.0,
                  binance_api_key: str | None = None,
                  binance_secret:  str | None = None) -> str:
        if ticker in self.bots and self.bots[ticker].running:
            return f"Bot for {ticker} is already running."
        bot = TradingBotInstance(
            ticker=ticker,
            paper=paper,
            user_id=self.user_id,
            initial_capital=initial_capital,
            max_drawdown_pct=max_drawdown_pct,
            risk_per_trade_pct=risk_per_trade_pct,
        )
        if binance_api_key and binance_secret:
            bot.binance_api_key = binance_api_key
            bot.binance_secret  = binance_secret
        self.bots[ticker] = bot
        bot.start()
        broker = "Binance" if (binance_api_key and binance_secret) else "Platform Balance"
        logger.info(
            f"User {self.user_email} started {'paper' if paper else 'LIVE'} bot on "
            f"{ticker} via {broker} | capital=${initial_capital} risk={risk_per_trade_pct}% dd={max_drawdown_pct}%"
        )
        return f"✅ Bot started on {ticker} ({'Paper' if paper else 'LIVE'}) | Capital: ${initial_capital:,.2f} | Broker: {broker}"

    def stop_bot(self, ticker: str = "ALL") -> str:
        if ticker == "ALL":
            for t, bot in list(self.bots.items()):
                bot.stop()
            self.bots.clear()
            return "All bots stopped successfully."
        if ticker in self.bots:
            self.bots[ticker].stop()
            del self.bots[ticker]
            return f"Bot on {ticker} stopped."
        return f"No active bot found for ticker {ticker}."

    def get_status(self) -> dict:
        return {ticker: bot.get_status() for ticker, bot in self.bots.items()}

    def get_trades(self, limit: int = 50) -> List[dict]:
        all_trades = []
        for bot in self.bots.values():
            all_trades.extend(bot.trades)
        return sorted(all_trades, key=lambda x: x.get("time", ""), reverse=True)[:limit]


def get_user_bot_manager(user_email: str, user_id: int) -> UserBotManager:
    if user_email not in user_bot_managers:
        user_bot_managers[user_email] = UserBotManager(user_id, user_email)
    return user_bot_managers[user_email]


bot_manager = BotManager()
