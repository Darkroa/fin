from celery import shared_task
from sqlalchemy.orm import Session
from loguru import logger

from src.ingestion.news_fetcher import NewsFetcher
from src.event.event_detector import EventDetector
from src.database.session import SessionLocal
from src.notifications.notifier import Notifier
from src.analysis.full_analyzer import FullAnalyzer   # Optional: run full analysis on high-impact articles

notifier = Notifier()
full_analyzer = FullAnalyzer()   # You can use this for deeper Grok-powered analysis

@shared_task(
    bind=True,
    name="src.celery_app.tasks.ingest_and_detect_events",
    max_retries=3,
    default_retry_delay=60,
    soft_time_limit=240,
    time_limit=300
)
def ingest_and_detect_events(self):
    """Delegating wrapper. Canonical implementation in src.celery_app.tasks.
    Defining a duplicate here broke Celery's task registry and revoke() semantics."""
    from src.celery_app.tasks import ingest_and_detect_events as _canonical
    return _canonical.run()
