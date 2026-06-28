import os
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
    "BTC-USD": "BTCUSDT",  "BTC-USDT": "BTCUSDT",
    "ETH-USD": "ETHUSDT",  "ETH-USDT": "ETHUSDT",
    "SOL-USD": "SOLUSDT",  "SOL-USDT": "SOLUSDT",
    "XRP-USD": "XRPUSDT",  "XRP-USDT": "XRPUSDT",
    "BNB-USD": "BNBUSDT",  "BNB-USDT": "BNBUSDT",
    "ADA-USD": "ADAUSDT",  "ADA-USDT": "ADAUSDT",
    "AVAX-USD": "AVAXUSDT","AVAX-USDT": "AVAXUSDT",
    "DOGE-USD": "DOGEUSDT","DOGE-USDT": "DOGEUSDT",
    "MATIC-USD":"MATICUSDT","MATIC-USDT":"MATICUSDT",
    "LTC-USD": "LTCUSDT",  "LTC-USDT": "LTCUSDT",
    "LINK-USD": "LINKUSDT","LINK-USDT": "LINKUSDT",
    "DOT-USD": "DOTUSDT",  "DOT-USDT": "DOTUSDT",
    "UNI-USD": "UNIUSDT",  "UNI-USDT": "UNIUSDT",
    "XLM-USD": "XLMUSDT",  "XLM-USDT": "XLMUSDT",
}

KRAKEN_PAIR_MAP = {
    "BTC-USD": "XBTUSD",  "ETH-USD": "ETHUSD",  "SOL-USD": "SOLUSD",
    "XRP-USD": "XRPUSD",  "ADA-USD": "ADAUSD",  "DOGE-USD": "XDGUSD",
    "LTC-USD": "LTCUSD",  "LINK-USD": "LINKUSD", "DOT-USD": "DOTUSD",
    "AVAX-USD": "AVAXUSD",
}

# Yahoo Finance symbols for metals futures and stocks
YAHOO_SYMBOL_MAP = {
    "XAU-USD": "GC=F",  "XAU/USD": "GC=F",
    "XAG-USD": "SI=F",  "XAG/USD": "SI=F",
    "XPT-USD": "PL=F",  "XPT/USD": "PL=F",
    "XPD-USD": "PA=F",  "XPD/USD": "PA=F",
    "COPPER":  "HG=F",
    "OIL-WTI": "CL=F",  "OIL/WTI": "CL=F",
    "NATGAS":  "NG=F",
    "AAPL": "AAPL", "TSLA": "TSLA", "NVDA": "NVDA", "SPY": "SPY",
    "MSFT": "MSFT", "GOOGL": "GOOGL", "AMZN": "AMZN", "META": "META",
    "BRK": "BRK-B", "JPM": "JPM", "V": "V", "JNJ": "JNJ",
    "WMT": "WMT", "XOM": "XOM", "GLD": "GLD",
}

_price_cache: Dict[str, tuple] = {}
_YF_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; FinAi/1.0)"}


def _fetch_yahoo_price(yahoo_sym: str) -> Optional[float]:
    """Fetch current price from Yahoo Finance REST API (no yfinance package)."""
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yahoo_sym}?interval=1d&range=2d"
        r = requests.get(url, headers=_YF_HEADERS, timeout=6)
        if r.status_code == 200:
            meta = r.json()["chart"]["result"][0]["meta"]
            price = meta.get("regularMarketPrice") or meta.get("previousClose")
            if price and float(price) > 0:
                return float(price)
    except Exception:
        pass
    return None


def _fetch_live_price(ticker: str) -> float:
    cached = _price_cache.get(ticker)
    if cached and (time.time() - cached[1]) < 10:
        return cached[0]

    price = None
    t_upper = ticker.upper()

    # 1. Try Binance US (crypto pairs — handles both -USD and -USDT format)
    bsym = BINANCE_US_SYMBOL_MAP.get(t_upper)
    if bsym:
        try:
            r = requests.get(f"https://api.binance.us/api/v3/ticker/price?symbol={bsym}", timeout=5)
            if r.status_code == 200:
                price = float(r.json()["price"])
        except Exception:
            pass

    # 2. Try Kraken (crypto fallback)
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

    # 3. Try Yahoo Finance REST API (metals, stocks, futures)
    if price is None:
        yahoo_sym = YAHOO_SYMBOL_MAP.get(t_upper) or YAHOO_SYMBOL_MAP.get(ticker)
        if yahoo_sym is None and t_upper not in BINANCE_US_SYMBOL_MAP and t_upper not in KRAKEN_PAIR_MAP:
            yahoo_sym = t_upper  # try bare ticker (e.g. AAPL, MSFT)
        if yahoo_sym:
            price = _fetch_yahoo_price(yahoo_sym)

    if price is None:
        fallbacks = {
            "BTC-USD": 97000.0, "BTC-USDT": 97000.0,
            "ETH-USD": 3200.0,  "ETH-USDT": 3200.0,
            "SOL-USD": 155.0,   "BNB-USD": 628.0,
            "XRP-USD": 0.52,    "ADA-USD": 0.44,
            "AVAX-USD": 34.0,   "DOGE-USD": 0.17,
            "XAU-USD": 3290.0,  "XAU/USD": 3290.0,
            "XAG-USD": 32.80,   "XAG/USD": 32.80,
            "OIL-WTI": 78.40,   "OIL/WTI": 78.40,
            "NATGAS": 2.18,
            "NVDA": 875.0, "AAPL": 195.0, "TSLA": 175.0, "MSFT": 415.0,
            "GOOGL": 400.0, "AMZN": 272.0, "META": 609.0, "SPY": 526.0,
        }
        price = fallbacks.get(t_upper, fallbacks.get(ticker, 100.0))
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

    SMA_PERIOD = 1
    TICK_SECS  = 0.5   # faster execution — tick every 0.5 s
    FL_LENGTH  = 4

    def __init__(self, ticker: str, paper: bool = False, user_id: int = None,
                 initial_capital: float = 1000.0, max_drawdown_pct: float = 90.0,
                 risk_per_trade_pct: float = 40,
                 strategy: str = "sma",
                 take_profit_pct: float = 500.0,
                 direction: str = "auto",
                 bot_id: str = None,
                 bot_name: str = None,
                 leverage: float = 200.0,
                 sl_usdt: float = 100.0,
                 stop_loss_pct: float = 50.0,
                 lot_size: float = 1.0,
                 num_trades: int = 0,
                 execution_cooldown: int = 40):
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

        self.leverage         = float(leverage)
        self.sl_usdt          = float(sl_usdt)
        self.stop_loss_pct    = float(stop_loss_pct)
        self.lot_size         = max(0.01, float(lot_size) if lot_size is not None else 1.0)
        self.open_margin      = 0.0
        self.trail_high       = 0.0

        self.num_trades           = max(0, int(num_trades))  # 0 = unlimited
        self.completed_trades     = 0                         # closed trades counter
        self.opened_trades        = 0                         # opened trades counter
        self.execution_cooldown   = max(10, int(execution_cooldown))  # seconds between trades
        self.last_close_time: Optional[datetime] = None      # when last position was closed

        self.binance_api_key: Optional[str] = None
        self.binance_secret:  Optional[str] = None

        # FinLux persistent state
        self.fl_upper:    float = 9.0
        self.fl_lower:    float = 9.0
        self.fl_slope_ph: float = 9.0
        self.fl_slope_pl: float = 9.0
        self.fl_upos:     int   = 9
        self.fl_dnos:     int   = 9
        self.fl_mult:     float = 9.0

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
        unrealized_pnl  = (self.latest_price - self.entry_price) * self.position if self.position > 0 else 0.0
        portfolio_value = self.capital + self.open_margin + unrealized_pnl
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
            "leverage":             self.leverage,
            "sl_usdt":              self.sl_usdt,
            "stop_loss_pct":        self.stop_loss_pct,
            "lot_size":             self.lot_size,
            "open_margin":          round(self.open_margin, 2),
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
            "completed_trades":     self.completed_trades,
            "opened_trades":        self.opened_trades,
            "num_trades":           self.num_trades,
            "trade_limit_reached":  self.num_trades > 0 and self.completed_trades >= self.num_trades,
            "execution_cooldown":   self.execution_cooldown,
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

    # ── Volatility-based fill price (realistic market order slippage) ─────────

    def _volatility_fill_price(self, side: str, price: float) -> float:
        """
        Simulates realistic market-order execution by applying ATR-based slippage.
        BUY orders fill slightly above the tick price (you pay more).
        SELL orders fill slightly below the tick price (you receive less).
        Slippage = 0.25 × recent ATR, capped at 0.05% of price.
        """
        n = len(self.price_history)
        if n < 2:
            return price
        lookback = min(n, 10)
        recent = self.price_history[-lookback:]
        diffs = [abs(recent[i] - recent[i - 1]) for i in range(1, len(recent))]
        atr = sum(diffs) / max(len(diffs), 1)
        # Cap slippage at 0.05% of price to avoid unrealistic fills
        max_slip = price * 0.0005
        slip = min(atr * 0.25, max_slip)
        if side == "BUY":
            return round(price + slip, 8)
        else:
            return round(price - slip, 8)

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

                # Trade count limit — do NOT stop the bot; just block new opens.
                # The bot stays alive to manage any remaining open position and
                # can be stopped manually. (Like FinEvent behavior.)
                at_trade_limit = self.num_trades > 0 and self.completed_trades >= self.num_trades
                if at_trade_limit:
                    logger.debug(f"Trade limit {self.num_trades} reached for {self.ticker}; blocking new opens.")

                # ── Risk management: pct-based SL/TP + trailing stop ───────
                risk_closed = False
                if self.position > 0:
                    if price > self.trail_high:
                        self.trail_high = price
                    unrealized = (price - self.entry_price) * self.position
                    # Percentage-based SL/TP on margin used
                    sl_thresh = -(self.open_margin * self.stop_loss_pct / 100) if self.open_margin > 0 else -self.sl_usdt
                    tp_thresh = (self.open_margin * self.take_profit_pct / 100) if self.open_margin > 0 else float("inf")
                    if unrealized <= sl_thresh:
                        self._close_position(price, "STOP_LOSS")
                        risk_closed = True
                    elif unrealized >= tp_thresh:
                        self._close_position(price, "TAKE_PROFIT")
                        risk_closed = True
                    elif (self.trail_high > self.entry_price * 1.005 and
                          price < self.trail_high * (1 - 1.5 / 100)):
                        self._close_position(price, "TRAILING_STOP")
                        risk_closed = True

                # Cooldown check: how long since the last close
                in_cooldown = (
                    self.last_close_time is not None and
                    (datetime.now() - self.last_close_time).total_seconds() < self.execution_cooldown
                )

                if not risk_closed:
                    # ── Dispatch to strategy ──────────────────────────────────
                    # ── Live strategy: open immediately, hold until TP/SL ─────
                    if self.strategy == "live":
                        can_open = self.position <= 0 and not at_trade_limit and not in_cooldown
                        if can_open and self.direction in ("auto", "buy"):
                            margin_usdt = min(self.capital * self.risk_per_trade_pct / 100 * self.lot_size, self.capital * 0.95)
                            notional_usdt = margin_usdt * self.leverage
                            exec_price = self._volatility_fill_price("BUY", price)
                            qty = notional_usdt / exec_price
                            if margin_usdt >= 1.0 and qty > 0:
                                self._open_position(qty, exec_price, "LIVE_BUY", margin_usdt)
                        elif can_open and self.direction == "sell":
                            margin_usdt = min(self.capital * self.risk_per_trade_pct / 100 * self.lot_size, self.capital * 0.95)
                            notional_usdt = margin_usdt * self.leverage
                            exec_price = self._volatility_fill_price("SELL", price)
                            qty = notional_usdt / exec_price
                            if margin_usdt >= 1.0 and qty > 0:
                                self._open_position(qty, exec_price, "LIVE_SELL", margin_usdt)
                    elif self.strategy == "finlux":
                        signal = self._step_finlux(price)

                        # Update signal state for UI
                        if self.fl_upos:
                            self.signal_state = "BULLISH"
                        elif self.fl_dnos:
                            self.signal_state = "BEARISH"
                        else:
                            self.signal_state = "NEUTRAL"

                        can_open = self.position <= 0 and not at_trade_limit and not in_cooldown
                        if signal == "BUY" and can_open and self.direction in ("auto", "buy"):
                            margin_usdt = min(self.capital * (self.risk_per_trade_pct / 100) * self.lot_size, self.capital * 0.95)
                            notional_usdt = margin_usdt * self.leverage
                            exec_price = self._volatility_fill_price("BUY", price)
                            qty = notional_usdt / exec_price
                            if margin_usdt >= 1.0:
                                self._open_position(qty, exec_price, "FL_BREAKOUT_BUY", margin_usdt)
                        elif signal == "SELL" and self.position > 0 and self.direction in ("auto", "sell"):
                            exec_price = self._volatility_fill_price("SELL", price)
                            self._close_position(exec_price, "FL_BREAKOUT_SELL")

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

                        can_open = self.position <= 0 and not at_trade_limit and not in_cooldown
                        if bullish_cross and can_open and self.direction in ("auto", "buy"):
                            margin_usdt = min(self.capital * (self.risk_per_trade_pct / 100) * self.lot_size, self.capital * 0.95)
                            notional_usdt = margin_usdt * self.leverage
                            exec_price = self._volatility_fill_price("BUY", price)
                            qty = notional_usdt / exec_price
                            if margin_usdt >= 1.0:
                                self._open_position(qty, exec_price, "SMA_BULLISH_CROSS", margin_usdt)
                        elif bearish_cross and self.position > 0 and self.direction in ("auto", "sell"):
                            exec_price = self._volatility_fill_price("SELL", price)
                            self._close_position(exec_price, "SMA_BEARISH_CROSS")

            except Exception as e:
                logger.error(f"Bot loop error for {self.ticker} [{self.bot_id}]: {e}")

            time.sleep(self.TICK_SECS)
            tick += 1

    # ── Position helpers ──────────────────────────────────────────────────────

    def _open_position(self, qty: float, price: float, reason: str, margin: float = None):
        try:
            cost = margin if margin is not None else qty * price / max(self.leverage, 1.0)
            if not self.paper and self.binance_api_key and self.binance_secret:
                try:
                    _place_binance_order("BUY", self.ticker, round(qty, 4), self.binance_api_key, self.binance_secret)
                except Exception as e:
                    logger.warning(f"Binance BUY skipped: {e}")

            self.capital       -= cost
            self.open_margin    = cost
            self.position       = qty
            self.entry_price    = price
            self.trail_high     = price
            self.opened_trades += 1

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
            self._notify_trade(trade)
            logger.success(f"🟢 BUY  {qty:.6f} {self.ticker} @ ${price:,.4f}  [{reason}]  margin=${cost:,.2f}  lev={self.leverage:.0f}x")
        except Exception as e:
            logger.error(f"Failed to open {self.ticker}: {e}")

    def _close_position(self, price: float, reason: str):
        if self.position <= 0:
            return
        pnl      = (price - self.entry_price) * self.position
        proceeds = self.open_margin + pnl  # return margin + profit/loss
        try:
            if not self.paper and self.binance_api_key and self.binance_secret:
                try:
                    _place_binance_order("SELL", self.ticker, round(self.position, 4), self.binance_api_key, self.binance_secret)
                except Exception as e:
                    logger.warning(f"Binance SELL skipped: {e}")

            self.capital += max(proceeds, 0.0)

            self._update_user_balance(max(proceeds, 0.0))  # return margin + P&L to user balance

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
            self._notify_trade(trade)
            emoji = "📈" if pnl >= 0 else "📉"
            logger.info(f"🔴 SELL {self.position:.6f} {self.ticker} @ ${price:,.4f}  [{reason}]  P&L=${pnl:+.2f} {emoji}")
            self.position         = 0.0
            self.entry_price      = 0.0
            self.open_margin      = 0.0
            self.trail_high       = 0.0
            self.completed_trades += 1
            self.last_close_time  = datetime.now()
        except Exception as e:
            logger.error(f"Failed to close {self.ticker}: {e}")

    def _notify_trade(self, trade: dict):
        """Send in-app + Telegram + WhatsApp notification for every trade open/close."""
        if not self.user_id:
            return

        def _send():
            from src.database.models import Notification
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == self.user_id).first()
                if not user:
                    return
                prefs   = dict(user.notification_preferences or {})
                action  = trade["action"]
                ticker  = trade["ticker"]
                price   = trade["price"]
                qty     = trade["qty"]
                pnl     = trade.get("pnl")
                ts      = (trade["time"].strftime("%Y-%m-%d %H:%M:%S")
                           if isinstance(trade["time"], datetime) else str(trade["time"]))

                if action == "BUY":
                    notif_title = f"🟢 AI Bot — {ticker} Position Opened"
                    notif_msg   = (
                        f"BUY {qty:.6f} {ticker} @ ${price:,.4f}\n"
                        f"Leverage: {self.leverage:.0f}x | Signal: {trade.get('reason', 'Signal')}\n"
                        f"Time: {ts}"
                    )
                    msg = (
                        f"🟢 FIN BOT — Position Opened\n"
                        f"Pair: {ticker}\n"
                        f"Price: ${price:,.4f}\n"
                        f"Size: {qty:.6f}\n"
                        f"Leverage: {self.leverage:.0f}x\n"
                        f"Signal: {trade.get('reason', 'Signal')}\n"
                        f"Time: {ts}"
                    )
                else:
                    pnl_str = f"${pnl:+.2f}" if pnl is not None else "N/A"
                    emoji   = "📈" if (pnl or 0) >= 0 else "📉"
                    notif_title = f"{emoji} AI Bot — {ticker} Position Closed"
                    notif_msg   = (
                        f"SELL {qty:.6f} {ticker} @ ${price:,.4f}\n"
                        f"P&L: {pnl_str} | Reason: {trade.get('reason', 'Signal')}\n"
                        f"Time: {ts}"
                    )
                    msg = (
                        f"{emoji} FIN BOT — Position Closed\n"
                        f"Pair: {ticker}\n"
                        f"Price: ${price:,.4f}\n"
                        f"Size: {qty:.6f}\n"
                        f"P&L: {pnl_str}\n"
                        f"Reason: {trade.get('reason', 'Signal')}\n"
                        f"Time: {ts}"
                    )

                # 1. In-app notification (always)
                db.add(Notification(
                    title=notif_title,
                    message=notif_msg,
                    target_all=False,
                    target_user_id=user.id,
                    created_by=None,
                    read_by_user_ids=[],
                ))
                db.commit()

                # 2. Telegram — use telegram_chat_id field first, then prefs fallback
                telegram_chat_id = user.telegram_chat_id or prefs.get("telegram_chat_id")
                bot_token        = os.environ.get("TELEGRAM_BOT_TOKEN")
                if telegram_chat_id and bot_token:
                    try:
                        requests.post(
                            f"https://api.telegram.org/bot{bot_token}/sendMessage",
                            json={"chat_id": telegram_chat_id, "text": msg},
                            timeout=10,
                        )
                    except Exception as ex:
                        logger.warning(f"Telegram notify failed: {ex}")

                # 3. WhatsApp
                whatsapp_number = user.whatsapp_number or prefs.get("whatsapp_number")
                if whatsapp_number and notifier.twilio_client:
                    try:
                        notifier.twilio_client.messages.create(
                            from_=notifier.whatsapp_from,
                            body=msg,
                            to=f"whatsapp:{whatsapp_number}",
                        )
                    except Exception as ex:
                        logger.warning(f"WhatsApp notify failed: {ex}")

            except Exception as ex:
                logger.warning(f"Trade notification error: {ex}")
            finally:
                db.close()

        threading.Thread(target=_send, daemon=True).start()


# ── Legacy multi-ticker bot (kept for compatibility) ─────────────────────────

class TradingBot:
    def __init__(self, tickers: list, initial_capital: float = 10000.0,
                 max_drawdown_pct: float = 10.0, risk_per_trade_pct: float = 100,
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

    def start_bot(self, ticker: str, paper: bool = False,
                  initial_capital: float = 200.0,
                  risk_per_trade_pct: float = 40.0,
                  max_drawdown_pct: float = 90.0,
                  strategy: str = "sma",
                  take_profit_pct: float = 500.0,
                  direction: str = "auto",
                  bot_name: Optional[str] = None,
                  binance_api_key: Optional[str] = None,
                  binance_secret:  Optional[str] = None,
                  leverage: float = 200.0,
                  sl_usdt: float = 100.0,
                  stop_loss_pct: float = 50.0,
                  lot_size: float = 1.0,
                  num_trades: int = 0,
                  execution_cooldown: int = 40) -> str:
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
            leverage=leverage,
            sl_usdt=sl_usdt,
            stop_loss_pct=stop_loss_pct,
            lot_size=lot_size,
            num_trades=num_trades,
            execution_cooldown=execution_cooldown,
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
            f"lev={leverage}x sl={stop_loss_pct}% tp={take_profit_pct}% risk={risk_per_trade_pct}% dd={max_drawdown_pct}%"
        )
        return (
            f"✅ Bot '{bot_id}' started on {ticker} ({'Paper' if paper else 'LIVE'}) | "
            f"Strategy: {strategy.upper()} | Capital: ${initial_capital:,.2f} | "
            f"Leverage: {leverage:.0f}x | SL: {stop_loss_pct:.0f}% | TP: {take_profit_pct:.0f}% | Broker: {broker}"
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
