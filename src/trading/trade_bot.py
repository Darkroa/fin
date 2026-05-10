import time
import threading
import requests
from datetime import datetime
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from loguru import logger

from src.database.models import TrendAnalysis, TradeLog, User
from src.database.session import SessionLocal
from src.notifications.notifier import Notifier

notifier = Notifier()

COINGECKO_ID_MAP = {
    "BTC-USD": "bitcoin", "ETH-USD": "ethereum", "SOL-USD": "solana",
    "XRP-USD": "ripple",  "BNB-USD": "binancecoin", "ADA-USD": "cardano",
    "AVAX-USD": "avalanche-2", "DOGE-USD": "dogecoin", "MATIC-USD": "matic-network",
    "LTC-USD": "litecoin", "LINK-USD": "chainlink", "DOT-USD": "polkadot",
}

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

_price_cache: Dict[str, tuple] = {}


def _fetch_live_price(ticker: str) -> float:
    cached = _price_cache.get(ticker)
    if cached and (time.time() - cached[1]) < 10:
        return cached[0]

    price = None
    t_upper = ticker.upper()

    bsym = BINANCE_US_SYMBOL_MAP.get(t_upper)
    if bsym:
        try:
            r = requests.get(f"https://api.binance.us/api/v3/ticker/price?symbol={bsym}", timeout=5)
            if r.status_code == 200:
                price = float(r.json()["price"])
        except Exception:
            pass

    if price is None:
        kpair = KRAKEN_PAIR_MAP.get(t_upper)
        if kpair:
            try:
                r = requests.get(f"https://api.kraken.com/0/public/Ticker?pair={kpair}", timeout=5)
                if r.status_code == 200:
                    result = r.json().get("result", {})
                    if result:
                        first_key = next(iter(result))
                        price = float(result[first_key]["c"][0])
            except Exception:
                pass

    if price is None and t_upper not in BINANCE_US_SYMBOL_MAP:
        try:
            import yfinance as yf
            data = yf.download(ticker, period="5d", interval="1d", progress=False, auto_adjust=True)
            if not data.empty:
                price = float(data["Close"].iloc[-1])
        except Exception:
            pass

    if price is None:
        fallbacks = {
            "BTC-USD": 80365.0, "ETH-USD": 3050.0, "SOL-USD": 93.0,
            "XRP-USD": 0.52,    "BNB-USD": 600.0,  "ADA-USD": 0.44,
            "AVAX-USD": 34.0,   "DOGE-USD": 0.17,
            "NVDA": 215.0, "AAPL": 293.0, "TSLA": 428.0, "MSFT": 415.0,
            "GOOGL": 400.0, "AMZN": 272.0, "META": 609.0,
        }
        price = fallbacks.get(t_upper, 100.0)
    else:
        logger.debug(f"Live price {ticker}: ${price:,.4f}")

    _price_cache[ticker] = (price, time.time())
    return price


def _place_binance_order(side: str, symbol: str, qty: float, api_key: str, secret: str) -> dict:
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
    """Single-ticker trading bot with SMA or FinLux strategy."""

    SMA_PERIOD = 6
    TICK_SECS  = 12
    FL_LENGTH  = 14

    def __init__(self, ticker: str, paper: bool = True, user_id: int = None,
                 initial_capital: float = 10000.0, max_drawdown_pct: float = 10.0,
                 risk_per_trade_pct: float = 1.0,
                 strategy: str = "sma",
                 take_profit_pct: float = 4.0,
                 direction: str = "auto",
                 bot_id: str = None,
                 bot_name: str = None):
        self.ticker           = ticker.upper()
        self.paper            = paper
        self.user_id          = user_id
        self.bot_id           = bot_id or f"{ticker.upper()}_{int(time.time())}"
        self.bot_name         = bot_name or f"Bot-{ticker.upper()}"
        self.strategy         = strategy.lower()
        self.take_profit_pct  = float(take_profit_pct)
        self.direction        = direction.lower()

        self.initial_capital  = initial_capital
        self.capital          = initial_capital
        self.position         = 0.0
        self.entry_price      = 0.0
        self.trades: List[dict] = []

        self.max_drawdown_pct     = max_drawdown_pct
        self.risk_per_trade_pct   = risk_per_trade_pct
        self.peak_capital         = initial_capital
        self.max_drawdown_reached = 0.0

        self.running          = False
        self.thread           = None
        self.latest_price     = 0.0
        self.price_history:    List[float]    = []
        self.price_timestamps: List[datetime] = []
        self.signal_state     = "NEUTRAL"
        self.last_signal_time: Optional[datetime] = None

        self.binance_api_key: Optional[str] = None
        self.binance_secret:  Optional[str] = None

        # FinLux persistent state
        self.fl_upper:    float = 0.0
        self.fl_lower:    float = 0.0
        self.fl_slope_ph: float = 0.0
        self.fl_slope_pl: float = 0.0
        self.fl_upos:     int   = 0
        self.fl_dnos:     int   = 0
        self.fl_mult:     float = 1.0

    # ── Start / Stop ──────────────────────────────────────────────────────────

    def start(self):
        if self.running:
            return f"Bot already running for {self.ticker}"
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        mode = "PAPER" if self.paper else "LIVE"
        logger.success(f"🚀 {mode} Bot STARTED → {self.ticker} [{self.strategy.upper()}] (id={self.bot_id})")
        return f"Bot started on {self.ticker} ({mode})"

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        logger.info(f"🛑 Bot STOPPED → {self.ticker} (id={self.bot_id})")
        return f"Bot stopped for {self.ticker}"

    # ── Status ────────────────────────────────────────────────────────────────

    def get_status(self):
        portfolio_value  = self.capital + self.position * self.latest_price
        unrealized_pnl   = (self.latest_price - self.entry_price) * self.position
        self.peak_capital = max(self.peak_capital, portfolio_value)
        current_dd = ((self.peak_capital - portfolio_value) / self.peak_capital * 100) if self.peak_capital > 0 else 0

        pnl_trades = [t for t in self.trades if t.get("pnl") is not None]
        total_pnl  = sum(t["pnl"] for t in pnl_trades)
        winning    = sum(1 for t in pnl_trades if t["pnl"] > 0)
        win_rate   = round(winning / len(pnl_trades) * 100, 1) if pnl_trades else 0.0

        # Build price chart (last 120 points)
        hist_slice = self.price_history[-120:]
        ts_slice   = self.price_timestamps[-120:]
        price_chart = []
        for i, p in enumerate(hist_slice):
            ts = ts_slice[i] if i < len(ts_slice) else None
            price_chart.append({
                "time":  ts.strftime("%H:%M:%S") if ts else f"t{i}",
                "price": round(p, 4),
            })

        # Mark entry/exit events on chart
        entry_markers = []
        exit_markers  = []
        for t in self.trades[-30:]:
            t_time = t["time"].strftime("%H:%M:%S") if isinstance(t["time"], datetime) else str(t["time"])[:8]
            if t["action"] == "BUY":
                entry_markers.append({"time": t_time, "price": round(t["price"], 4)})
            elif t["action"] == "SELL":
                exit_markers.append({
                    "time":  t_time,
                    "price": round(t["price"], 4),
                    "pnl":   round(t.get("pnl", 0) or 0, 2),
                })

        return {
            "running":              self.running,
            "bot_id":               self.bot_id,
            "bot_name":             self.bot_name,
            "ticker":               self.ticker,
            "strategy":             self.strategy,
            "direction":            self.direction,
            "take_profit_pct":      self.take_profit_pct,
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
            "price_chart":          price_chart,
            "entry_markers":        entry_markers,
            "exit_markers":         exit_markers,
            "recent_trades": [
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

    # ── SMA helper ────────────────────────────────────────────────────────────

    def _sma(self) -> Optional[float]:
        if len(self.price_history) < self.SMA_PERIOD:
            return None
        return sum(self.price_history[-self.SMA_PERIOD:]) / self.SMA_PERIOD

    # ── FinLux Trendlines with Breaks (Python port of LuxAlgo Pine Script) ───

    def _step_finlux(self, price: float) -> str:
        """
        Port of LuxAlgo 'Trendlines with Breaks' (Pine Script v5).
        Returns 'BUY' on upward trendline breakout, 'SELL' on downward, 'HOLD' otherwise.
        """
        n = len(self.price_history)
        length = self.FL_LENGTH

        if n < length * 2 + 2:
            return "HOLD"

        # ATR-based slope (same as Pine calcMethod='Atr')
        recent = self.price_history[-length:]
        diffs  = [abs(recent[i] - recent[i - 1]) for i in range(1, len(recent))]
        atr    = sum(diffs) / max(len(diffs), 1) if diffs else price * 0.001
        slope  = atr / length * self.fl_mult

        # Detect confirmed pivot high/low at bar n-length-1 (requires length bars after it)
        pivot_idx = n - length - 1
        if pivot_idx >= length:
            pivot_val = self.price_history[pivot_idx]
            window    = self.price_history[pivot_idx - length: pivot_idx + length + 1]
            if len(window) == 2 * length + 1:
                is_ph = pivot_val >= max(window) - 1e-9
                is_pl = pivot_val <= min(window) + 1e-9
                if is_ph:
                    self.fl_upper    = pivot_val
                    self.fl_slope_ph = slope
                    self.fl_upos     = 0
                if is_pl:
                    self.fl_lower    = pivot_val
                    self.fl_slope_pl = slope
                    self.fl_dnos     = 0

        # Initialise slopes if not yet set
        if self.fl_slope_ph == 0:
            self.fl_slope_ph = slope
        if self.fl_slope_pl == 0:
            self.fl_slope_pl = slope

        # Advance trendlines one tick (upper descends, lower ascends)
        if self.fl_upper > 0:
            self.fl_upper -= self.fl_slope_ph
        if self.fl_lower > 0:
            self.fl_lower += self.fl_slope_pl

        # Trendline values used for breakout detection
        upper_line = self.fl_upper - self.fl_slope_ph * length if self.fl_upper > 0 else 0
        lower_line = self.fl_lower + self.fl_slope_pl * length if self.fl_lower > 0 else 0

        prev_upos = self.fl_upos
        prev_dnos = self.fl_dnos

        if upper_line > 0 and price > upper_line:
            self.fl_upos = 1
        if lower_line > 0 and price < lower_line:
            self.fl_dnos = 1

        # Transition 0→1 fires the breakout signal
        if self.fl_upos > prev_upos:
            return "BUY"
        if self.fl_dnos > prev_dnos:
            return "SELL"
        return "HOLD"

    # ── Balance helpers ───────────────────────────────────────────────────────

    def _update_user_balance(self, delta: float):
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

    # ── Main loop ─────────────────────────────────────────────────────────────

    def _run_loop(self):
        tick = 0
        while self.running:
            try:
                price = _fetch_live_price(self.ticker)
                self.latest_price = price
                self.price_history.append(price)
                self.price_timestamps.append(datetime.now())
                if len(self.price_history) > 300:
                    self.price_history    = self.price_history[-300:]
                    self.price_timestamps = self.price_timestamps[-300:]

                # Drawdown guard
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

                # TP / hard-stop (apply to both strategies)
                take_profit = self.position > 0 and price > self.entry_price * (1 + self.take_profit_pct / 100)
                hard_stop   = self.position > 0 and price < self.entry_price * 0.97

                if take_profit:
                    self._close_position(price, "TAKE_PROFIT")
                elif hard_stop:
                    self._close_position(price, "HARD_STOP_LOSS")
                else:
                    # ── Dispatch to strategy ──────────────────────────────────
                    if self.strategy == "finlux":
                        signal = self._step_finlux(price)

                        # Update signal state for UI
                        if self.fl_upos:
                            self.signal_state = "BULLISH"
                        elif self.fl_dnos:
                            self.signal_state = "BEARISH"
                        else:
                            self.signal_state = "NEUTRAL"

                        if signal == "BUY" and self.position <= 0 and self.direction in ("auto", "buy"):
                            risk_amt = self.capital * (self.risk_per_trade_pct / 100)
                            qty = min((self.capital * 0.95) / price, risk_amt * 10 / price)
                            if qty > 0.00001:
                                self._open_position(qty, price, "FL_BREAKOUT_BUY")
                        elif signal == "SELL" and self.position > 0 and self.direction in ("auto", "sell"):
                            self._close_position(price, "FL_BREAKOUT_SELL")

                    else:
                        # SMA crossover (default)
                        sma = self._sma()
                        if sma is None:
                            time.sleep(self.TICK_SECS)
                            tick += 1
                            continue

                        prev_sma = (sum(self.price_history[-self.SMA_PERIOD - 1:-1]) / self.SMA_PERIOD
                                    if len(self.price_history) >= self.SMA_PERIOD + 1 else sma)

                        price_above_sma = price > sma
                        was_above       = self.price_history[-2] > prev_sma if len(self.price_history) >= 2 else price_above_sma
                        bullish_cross   = price_above_sma and not was_above
                        bearish_cross   = not price_above_sma and was_above

                        self.signal_state = "BULLISH" if price_above_sma else "BEARISH"

                        if bullish_cross and self.position <= 0 and self.direction in ("auto", "buy"):
                            risk_amt = self.capital * (self.risk_per_trade_pct / 100)
                            qty = min((self.capital * 0.95) / price, risk_amt * 10 / price)
                            if qty > 0.00001:
                                self._open_position(qty, price, "SMA_BULLISH_CROSS")
                        elif bearish_cross and self.position > 0 and self.direction in ("auto", "sell"):
                            self._close_position(price, "SMA_BEARISH_CROSS")

            except Exception as e:
                logger.error(f"Bot loop error for {self.ticker} [{self.bot_id}]: {e}")

            time.sleep(self.TICK_SECS)
            tick += 1

    # ── Position helpers ──────────────────────────────────────────────────────

    def _open_position(self, qty: float, price: float, reason: str):
        try:
            cost = qty * price
            if not self.paper and self.binance_api_key and self.binance_secret:
                try:
                    _place_binance_order("BUY", self.ticker, round(qty, 4), self.binance_api_key, self.binance_secret)
                except Exception as e:
                    logger.warning(f"Binance BUY skipped: {e}")

            self.capital    -= cost
            self.position    = qty
            self.entry_price = price

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
                    logger.warning(f"Binance SELL skipped: {e}")

            self.capital += proceeds

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


# ── Legacy multi-ticker bot (kept for compatibility) ─────────────────────────

class TradingBot:
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
            return f"Bot already running"
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, daemon=True)
        self.thread.start()
        return f"Bot started"

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=5)
        return "Bot stopped"

    def get_status(self):
        return {"running": self.running, "tickers": self.tickers,
                "balance": round(self.capital, 2), "total_trades": len(self.trades)}

    def _run_loop(self):
        while self.running:
            time.sleep(30)


class BotManager:
    def __init__(self):
        self.bots: Dict[str, TradingBot] = {}

    def start_bot(self, tickers: list, paper: bool = True, initial_capital: float = 10000.0):
        key = ",".join([t.upper() for t in tickers])
        if key in self.bots and self.bots[key].running:
            return f"Bot already running"
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


# ── Per-user bot manager ──────────────────────────────────────────────────────

class UserBotManager:
    """Manages multiple trading bots per user, each keyed by bot_id."""

    def __init__(self, user_id: int, user_email: str):
        self.user_id    = user_id
        self.user_email = user_email
        self.bots: Dict[str, TradingBotInstance] = {}

    def start_bot(self, ticker: str, paper: bool = True,
                  initial_capital: float = 1000.0,
                  risk_per_trade_pct: float = 1.0,
                  max_drawdown_pct: float = 10.0,
                  strategy: str = "sma",
                  take_profit_pct: float = 4.0,
                  direction: str = "auto",
                  bot_name: Optional[str] = None,
                  binance_api_key: Optional[str] = None,
                  binance_secret:  Optional[str] = None) -> str:
        # Derive a stable bot_id from the name, or generate a unique one
        if bot_name and bot_name.strip():
            bot_id = bot_name.strip().replace(" ", "_").lower()
        else:
            bot_id = f"{ticker.upper()}_{int(time.time())}"

        if bot_id in self.bots and self.bots[bot_id].running:
            return f"Bot '{bot_id}' is already running."

        bot = TradingBotInstance(
            ticker=ticker,
            paper=paper,
            user_id=self.user_id,
            initial_capital=initial_capital,
            max_drawdown_pct=max_drawdown_pct,
            risk_per_trade_pct=risk_per_trade_pct,
            strategy=strategy,
            take_profit_pct=take_profit_pct,
            direction=direction,
            bot_id=bot_id,
            bot_name=bot_name or f"Bot-{ticker.upper()}",
        )
        if binance_api_key and binance_secret:
            bot.binance_api_key = binance_api_key
            bot.binance_secret  = binance_secret
        self.bots[bot_id] = bot
        bot.start()
        broker = "Binance" if (binance_api_key and binance_secret) else "Platform Balance"
        logger.info(
            f"User {self.user_email} started {'paper' if paper else 'LIVE'} bot '{bot_id}' "
            f"on {ticker} | strategy={strategy} | capital=${initial_capital} "
            f"risk={risk_per_trade_pct}% dd={max_drawdown_pct}% tp={take_profit_pct}%"
        )
        return (
            f"✅ Bot '{bot_id}' started on {ticker} ({'Paper' if paper else 'LIVE'}) | "
            f"Strategy: {strategy.upper()} | Capital: ${initial_capital:,.2f} | Broker: {broker}"
        )

    def stop_bot(self, bot_id: str = "ALL") -> str:
        if bot_id == "ALL":
            for b in list(self.bots.values()):
                b.stop()
            self.bots.clear()
            return "All bots stopped successfully."
        if bot_id in self.bots:
            self.bots[bot_id].stop()
            del self.bots[bot_id]
            return f"Bot '{bot_id}' stopped."
        # Fallback: match by ticker name
        matches = [bid for bid, b in self.bots.items() if b.ticker == bot_id.upper()]
        if matches:
            for bid in matches:
                self.bots[bid].stop()
                del self.bots[bid]
            return f"Stopped {len(matches)} bot(s) on {bot_id}."
        return f"No active bot found with id '{bot_id}'."

    def close_position(self, bot_id: str) -> str:
        """Manually close a bot's open position at current market price."""
        if bot_id not in self.bots:
            return f"Bot '{bot_id}' not found."
        bot = self.bots[bot_id]
        if bot.position <= 0:
            return f"Bot '{bot_id}' has no open position."
        price = bot.latest_price or _fetch_live_price(bot.ticker)
        bot._close_position(price, "MANUAL_CLOSE")
        return f"Position closed for bot '{bot_id}' at ${price:,.4f}."

    def get_status(self) -> dict:
        return {bot_id: bot.get_status() for bot_id, bot in self.bots.items()}

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
