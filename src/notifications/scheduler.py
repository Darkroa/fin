from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from src.notifications.notifier import Notifier

notifier = Notifier()
scheduler = BackgroundScheduler(timezone="UTC")


def send_daily_portfolio_summary():
    try:
        from src.trading.trade_bot import bot_manager
        statuses = list(bot_manager.get_all_status().values())
        if not statuses:
            notifier._send_all("📊 Daily Summary: No active bots running.", "Daily Portfolio Summary")
            return
        notifier.send_daily_summary(statuses)
        logger.success("📧 Daily portfolio summary sent via all channels")
    except Exception as e:
        logger.error(f"Daily summary failed: {e}")


scheduler.add_job(
    send_daily_portfolio_summary,
    trigger=CronTrigger(hour=20, minute=0),
    id="daily_portfolio_summary",
    replace_existing=True,
)

logger.info("⏰ Daily Portfolio Summary Scheduler configured (runs at 20:00 UTC)")
