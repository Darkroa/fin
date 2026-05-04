import time
import threading
from datetime import datetime
from typing import Dict, List
from sqlalchemy.orm import Session
from loguru import logger

from src.database.models import TrendAnalysis, TradeLog
from src.database.session import SessionLocal
from src.notifications.notifier import Notifier

from alpaca.trading.client import TradingClient
from alpaca.trading.requests import MarketOrderRequest
from alpaca.trading.enums import OrderSide, TimeInForce

notifier = Notifier()

user_bot_managers: Dict[str, "UserBotManager"] = {}


class TradingBotInstance:
    """Single-ticker trading bot instance."""

    def __init__(self, ticker: str, paper: bool = True, user_id: int = None,
                 initial_capital: float = 10000.0, max_drawdown_pct: float = 10.0,
                 risk_per_trade_pct: float = 1.0):
        self.ticker = ticker.upper()
        self.paper = paper
        self.user_id = user_id

        self.initial_capital = initial_capital
        self.capital = initial_capital
        self.position = 0.0
        self.entry_price = 0.0
        self.trades: List[dict] = []

        self.max_drawdown_pct = max_drawdown_pct
        self.risk_per_trade_pct = risk_per_trade_pct
        self.peak_capital = initial_capital
        self.max_drawdown_reached = 0.0

        self.running = False
        self.thread = None
        self.latest_price = 100.0

        self.trading_client = None
        import os
        api_key = os.getenv("ALPACA_API_KEY")
        secret_key = os.getenv("ALPACA_SECRET_KEY")
        if api_key and secret_key:
            try:
                self.trading_client = TradingClient(api_key, secret_key, paper=paper)
            except Exception as e:
                logger.warning(f"Alpaca connection failed: {e}")

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
        portfolio_value = self.capital + self.position * self.latest_price
        unrealized_pnl = (self.latest_price - self.entry_price) * self.position
        self.peak_capital = max(self.peak_capital, portfolio_value)
        current_dd = ((self.peak_capital - portfolio_value) / self.peak_capital * 100) if self.peak_capital > 0 else 0
        return {
            "running": self.running,
            "ticker": self.ticker,
            "mode": "LIVE" if not self.paper else "PAPER",
            "balance": round(self.capital, 2),
            "portfolio_value": round(portfolio_value, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "position": round(self.position, 4),
            "current_drawdown_pct": round(current_dd, 2),
            "total_trades": len(self.trades),
        }

    def _get_latest_trend(self):
        db = SessionLocal()
        try:
            return (
                db.query(TrendAnalysis)
                .filter(TrendAnalysis.ticker == self.ticker)
                .order_by(TrendAnalysis.timestamp.desc())
                .first()
            )
        finally:
            db.close()

    def _log_trade_to_db(self, trade: dict):
        db = SessionLocal()
        try:
            log = TradeLog(
                ticker=trade["ticker"],
                action=trade["action"],
                price=trade["price"],
                qty=trade["qty"],
                pnl=trade.get("pnl"),
                reason=trade.get("reason"),
                paper=self.paper,
            )
            db.add(log)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log trade: {e}")
        finally:
            db.close()

    def _run_loop(self):
        while self.running:
            try:
                portfolio_value = self.capital + self.position * self.latest_price
                if self.peak_capital > 0:
                    current_dd = (self.peak_capital - portfolio_value) / self.peak_capital * 100
                    self.peak_capital = max(self.peak_capital, portfolio_value)
                    self.max_drawdown_reached = max(self.max_drawdown_reached, current_dd)
                    if current_dd > self.max_drawdown_pct:
                        logger.warning(f"🛑 Max drawdown reached for {self.ticker}. Stopping.")
                        if self.position > 0:
                            self._close_position(self.latest_price, "MAX_DRAWDOWN_STOP")
                        self.stop()
                        break

                latest = self._get_latest_trend()
                if not latest:
                    time.sleep(30)
                    continue

                price = latest.current_price
                self.latest_price = price
                state = latest.trend_state
                conf = latest.confidence or 0.0
                atr = latest.atr or 1.0

                risk_amount = self.capital * (self.risk_per_trade_pct / 100)
                stop_distance = atr * 2.0
                position_size = risk_amount / stop_distance if stop_distance > 0 else 0

                if state == "BULLISH" and self.position <= 0 and conf > 0.65:
                    qty = min(position_size, (self.capital / price) * 0.98)
                    if qty > 0.0001:
                        self._open_position(qty, price, "BULLISH_SIGNAL")
                elif state == "BEARISH" and self.position > 0 and conf > 0.65:
                    self._close_position(price, "SIGNAL_SELL")
                elif self.position > 0 and price < self.entry_price * 0.95:
                    self._close_position(price, "HARD_STOP_LOSS")

            except Exception as e:
                logger.error(f"Bot loop error for {self.ticker}: {e}")

            time.sleep(30)

    def _open_position(self, qty: float, price: float, reason: str):
        try:
            if not self.paper and self.trading_client:
                order_data = MarketOrderRequest(
                    symbol=self.ticker,
                    qty=round(qty, 4),
                    side=OrderSide.BUY,
                    time_in_force=TimeInForce.DAY,
                )
                self.trading_client.submit_order(order_data)

            self.position = qty
            self.entry_price = price

            trade = {
                "time": datetime.now(),
                "ticker": self.ticker,
                "action": "BUY",
                "price": price,
                "qty": qty,
                "pnl": 0.0,
                "reason": reason,
            }
            self.trades.append(trade)
            self._log_trade_to_db(trade)
            logger.success(f"🟢 BUY {qty:.4f} {self.ticker} @ ${price:.2f} ({reason})")
        except Exception as e:
            logger.error(f"Failed to open {self.ticker}: {e}")

    def _close_position(self, price: float, reason: str):
        if self.position <= 0:
            return
        pnl = (price - self.entry_price) * self.position
        try:
            if not self.paper and self.trading_client:
                order_data = MarketOrderRequest(
                    symbol=self.ticker,
                    qty=round(self.position, 4),
                    side=OrderSide.SELL,
                    time_in_force=TimeInForce.DAY,
                )
                self.trading_client.submit_order(order_data)

            self.capital += self.position * price
            trade = {
                "time": datetime.now(),
                "ticker": self.ticker,
                "action": "SELL",
                "price": price,
                "qty": self.position,
                "pnl": pnl,
                "reason": reason,
            }
            self.trades.append(trade)
            self._log_trade_to_db(trade)
            logger.info(f"🔴 CLOSE {reason} | P&L: ${pnl:.2f} | {self.ticker}")
            self.position = 0.0
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
        self.user_id = user_id
        self.user_email = user_email
        self.bots: Dict[str, TradingBotInstance] = {}

    def start_bot(self, ticker: str, paper: bool = True) -> str:
        if ticker in self.bots and self.bots[ticker].running:
            return f"Bot for {ticker} is already running."
        bot = TradingBotInstance(ticker=ticker, paper=paper, user_id=self.user_id)
        self.bots[ticker] = bot
        bot.start()
        logger.info(f"User {self.user_email} started {'paper' if paper else 'LIVE'} bot on {ticker}")
        return f"✅ Bot started successfully on {ticker} (Paper Trading: {paper})"

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
