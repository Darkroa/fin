"""
FinEventAI Trading Bot
----------------------
Monitors the events table for high-impact financial news and automatically
executes trades based on event sentiment and configurable settings.
"""

import threading
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from loguru import logger
from sqlalchemy.orm import Session

from src.database.models import Event, TradeLog, User
from src.database.session import SessionLocal
from src.trading.trade_bot import _fetch_live_price


class FinEventBot:
    """Runs in background, polls events table, trades on high-impact events."""

    POLL_SECONDS = 30

    def __init__(
        self,
        user_id: int,
        user_email: str,
        min_impact_score: int = 7,
        tickers: List[str] = None,
        capital_per_trade: float = 500.0,
        max_trades_per_day: int = 10,
        paper: bool = True,
        sentiment_filter: str = "both",  # "bullish" | "bearish" | "both"
    ):
        self.user_id            = user_id
        self.user_email         = user_email
        self.min_impact_score   = min_impact_score
        self.tickers            = [t.upper() for t in (tickers or ["BTC-USD", "ETH-USD"])]
        self.capital_per_trade  = capital_per_trade
        self.max_trades_per_day = max_trades_per_day
        self.paper              = paper
        self.sentiment_filter   = sentiment_filter.lower()

        self.running         = False
        self._thread         = None
        self._trades_today   = 0
        self._last_day       = datetime.utcnow().date()
        self._processed_ids  = set()  # event IDs we've already acted on
        self.trades: List[dict] = []
        self.total_pnl       = 0.0
        self.started_at      = None

    # ── Control ──────────────────────────────────────────────────────────────

    def start(self) -> str:
        if self.running:
            return "FinEventAI bot is already running."
        self.running    = True
        self.started_at = datetime.utcnow()
        self._thread    = threading.Thread(target=self._loop, daemon=True)
        self._thread.start()
        mode = "PAPER" if self.paper else "LIVE"
        logger.success(
            f"🧠 FinEventAI [{mode}] started for {self.user_email} "
            f"| min_impact={self.min_impact_score} | tickers={self.tickers}"
        )
        return (
            f"FinEventAI bot started ({mode}) | "
            f"Min impact: {self.min_impact_score}/10 | "
            f"Tickers: {', '.join(self.tickers)} | "
            f"Capital/trade: ${self.capital_per_trade:,.2f}"
        )

    def stop(self) -> str:
        self.running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        logger.info(f"🛑 FinEventAI bot stopped for {self.user_email}")
        return "FinEventAI bot stopped."

    # ── Main loop ─────────────────────────────────────────────────────────────

    def _loop(self):
        while self.running:
            try:
                self._poll_and_trade()
            except Exception as e:
                logger.error(f"FinEventAI loop error: {e}")
            time.sleep(self.POLL_SECONDS)

    def _poll_and_trade(self):
        now = datetime.utcnow()

        # Reset daily trade counter
        if now.date() != self._last_day:
            self._trades_today = 0
            self._last_day     = now.date()

        if self._trades_today >= self.max_trades_per_day:
            return

        with SessionLocal() as db:
            # Fetch recent high-impact events not yet processed
            cutoff = now - timedelta(hours=24)
            events = (
                db.query(Event)
                .filter(
                    Event.impact_score >= self.min_impact_score,
                    Event.created_at >= cutoff,
                )
                .order_by(Event.created_at.desc())
                .limit(20)
                .all()
            )

            for ev in events:
                if ev.id in self._processed_ids:
                    continue
                if self._trades_today >= self.max_trades_per_day:
                    break

                action = self._event_to_action(ev)
                if action is None:
                    self._processed_ids.add(ev.id)
                    continue

                # Determine which tickers to trade
                affected = [t.upper() for t in (ev.tickers_affected or [])]
                trade_tickers = [t for t in self.tickers if t in affected] or self.tickers[:1]

                for ticker in trade_tickers[:2]:  # cap at 2 per event
                    if self._trades_today >= self.max_trades_per_day:
                        break
                    self._execute_event_trade(db, ticker, action, ev)
                    self._trades_today += 1

                self._processed_ids.add(ev.id)
                # Avoid memory growth
                if len(self._processed_ids) > 5000:
                    self._processed_ids = set(list(self._processed_ids)[-2000:])

    def _event_to_action(self, event) -> Optional[str]:
        """Map event sentiment → BUY / SELL / None."""
        sent = (event.sentiment or "").lower()
        if self.sentiment_filter == "bullish" and sent not in ("positive", "bullish"):
            return None
        if self.sentiment_filter == "bearish" and sent not in ("negative", "bearish"):
            return None
        if sent in ("positive", "bullish"):
            return "BUY"
        if sent in ("negative", "bearish"):
            return "SELL"
        return None  # neutral — skip

    def _execute_event_trade(self, db: Session, ticker: str, action: str, event):
        """Log a trade driven by a financial event."""
        try:
            price = _fetch_live_price(ticker)
            qty   = round(self.capital_per_trade / price, 8) if price > 0 else 0.0

            reason = (
                f"FinEventAI | {event.event_type} | {event.title[:60]} | "
                f"Impact {event.impact_score}/10 | {event.sentiment}"
            )

            # Update user balance (paper mode keeps balance unchanged)
            if not self.paper:
                user = db.query(User).filter(User.id == self.user_id).first()
                if user:
                    cost = price * qty
                    if action == "BUY":
                        if (user.balance_usdt or 0) < cost:
                            logger.warning(f"FinEventAI: insufficient balance for {ticker}")
                            return
                        user.balance_usdt = round((user.balance_usdt or 0) - cost, 8)
                    else:  # SELL
                        user.balance_usdt = round((user.balance_usdt or 0) + cost, 8)

            log = TradeLog(
                user_id  = self.user_id,
                ticker   = ticker,
                action   = action,
                price    = price,
                qty      = qty,
                pnl      = None,
                reason   = reason,
                paper    = self.paper,
                exchange = "FinEventAI",
            )
            db.add(log)
            db.commit()
            db.refresh(log)

            trade_rec = {
                "id":       log.id,
                "ticker":   ticker,
                "action":   action,
                "price":    price,
                "qty":      qty,
                "reason":   reason,
                "time":     datetime.utcnow(),
                "paper":    self.paper,
                "pnl":      None,
            }
            self.trades.append(trade_rec)
            if len(self.trades) > 200:
                self.trades = self.trades[-200:]

            logger.info(
                f"🧠 FinEventAI {'PAPER' if self.paper else 'LIVE'} {action} "
                f"{ticker} @ ${price:,.4f} × {qty:.6f} | {event.title[:40]}"
            )

            # Notify via Telegram
            self._notify_trade(ticker, action, price, qty, reason)

        except Exception as e:
            logger.error(f"FinEventAI trade error ({ticker} {action}): {e}")

    def _notify_trade(self, ticker: str, action: str, price: float, qty: float, reason: str):
        import os, threading
        tok = os.getenv("TELEGRAM_BOT_TOKEN")
        with SessionLocal() as db:
            user = db.query(User).filter(User.id == self.user_id).first()
            if not user:
                return
            prefs    = dict(user.notification_preferences or {})
            cid      = user.telegram_chat_id
        if not (prefs.get("telegram") and cid and tok):
            return
        msg = (
            f"{'🟢' if action == 'BUY' else '🔴'} FinEventAI {'PAPER' if self.paper else 'LIVE'} {action}\n"
            f"Ticker: {ticker}\n"
            f"Price: ${price:,.4f} | Qty: {qty:.6f}\n"
            f"Reason: {reason[:120]}"
        )
        def _send():
            try:
                import requests as _r
                _r.post(f"https://api.telegram.org/bot{tok}/sendMessage",
                        json={"chat_id": cid, "text": msg}, timeout=5)
            except Exception:
                pass
        threading.Thread(target=_send, daemon=True).start()

    def get_status(self) -> dict:
        return {
            "running":            self.running,
            "paper":              self.paper,
            "min_impact_score":   self.min_impact_score,
            "tickers":            self.tickers,
            "capital_per_trade":  self.capital_per_trade,
            "max_trades_per_day": self.max_trades_per_day,
            "trades_today":       self._trades_today,
            "total_trades":       len(self.trades),
            "total_pnl":          self.total_pnl,
            "sentiment_filter":   self.sentiment_filter,
            "started_at":         self.started_at.isoformat() if self.started_at else None,
            "recent_trades":      [
                {
                    "ticker": t["ticker"],
                    "action": t["action"],
                    "price":  t["price"],
                    "qty":    t["qty"],
                    "reason": t["reason"],
                    "time":   t["time"].strftime("%H:%M:%S") if isinstance(t["time"], datetime) else str(t["time"]),
                    "paper":  t["paper"],
                }
                for t in self.trades[-20:]
            ],
        }


# ── Global singleton manager (per user_id) ───────────────────────────────────

class FinEventBotManager:
    _instance = None
    _lock      = threading.Lock()

    def __init__(self):
        self._bots: Dict[int, FinEventBot] = {}

    @classmethod
    def instance(cls) -> "FinEventBotManager":
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    def start(self, user_id: int, user_email: str, **kwargs) -> str:
        if user_id in self._bots and self._bots[user_id].running:
            return "FinEventAI bot is already running."
        bot = FinEventBot(user_id=user_id, user_email=user_email, **kwargs)
        self._bots[user_id] = bot
        return bot.start()

    def stop(self, user_id: int) -> str:
        bot = self._bots.get(user_id)
        if bot:
            return bot.stop()
        return "No FinEventAI bot running for this user."

    def get_status(self, user_id: int) -> dict:
        bot = self._bots.get(user_id)
        if bot:
            return bot.get_status()
        return {
            "running": False,
            "paper": True,
            "min_impact_score": 7,
            "tickers": ["BTC-USD", "ETH-USD"],
            "capital_per_trade": 500.0,
            "max_trades_per_day": 10,
            "trades_today": 0,
            "total_trades": 0,
            "total_pnl": 0.0,
            "sentiment_filter": "both",
            "started_at": None,
            "recent_trades": [],
        }
