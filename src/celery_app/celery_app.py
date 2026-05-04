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
    """
    Main background task:
    1. Fetch news from RSS + NewsAPI + Alpha Vantage
    2. Detect important financial events
    3. Save to database
    4. (Optional) Run FullAnalyzer with Grok
    5. Send notifications for high-impact events
    """
    db: Session = SessionLocal()
    try:
        logger.info("🚀 Starting news ingestion + event detection task")

        # 1. Fetch latest news
        fetcher = NewsFetcher()
        articles = fetcher.run()   # This calls the async fetch_all internally

        if not articles:
            logger.warning("No articles fetched this cycle.")
            return {"status": "no_data", "articles": 0, "events": 0}

        logger.info(f"Fetched {len(articles)} articles total")

        # 2. Detect events
        detector = EventDetector()
        all_events = []

        for article in articles[:40]:   # Limit to avoid overload
            try:
                events = detector.detect_events(article)
                if events:
                    all_events.extend(events)
            except Exception as e:
                logger.error(f"Event detection failed for one article: {e}")
                continue

        # 3. Save events to DB
        saved_count = 0
        if all_events:
            saved_count = detector.save_events_to_db(all_events, db)
            detector.save_events_to_json(all_events)   # Optional backup

        # 4. Optional: Run Full Grok-powered analysis on high-impact events
        high_impact = [e for e in all_events if getattr(e, 'impact_score', 0) >= 70]
        for event in high_impact[:5]:   # Limit expensive LLM calls
            try:
                if event.tickers_affected:
                    ticker = event.tickers_affected[0] if isinstance(event.tickers_affected, list) else event.tickers_affected
                    analysis = full_analyzer.analyze(ticker, event.description or "")
                    # You can save analysis result to TrendAnalysis or a new table here
                    logger.info(f"Full analysis done for {ticker} → {analysis.overall_signal}")
            except Exception as e:
                logger.warning(f"Full analysis skipped for event: {e}")

        # 5. Notifications
        if high_impact:
            try:
                notifier.send_event_alert(high_impact[0])
            except Exception as e:
                logger.warning(f"Notification failed: {e}")

        logger.success(
            f"✅ Task completed | Articles: {len(articles)} | "
            f"Events detected: {len(all_events)} | Saved: {saved_count}"
        )

        return {
            "status": "success",
            "articles_processed": len(articles),
            "events_detected": len(all_events),
            "events_saved": saved_count,
            "high_impact": len(high_impact)
        }

    except Exception as exc:
        logger.error(f"❌ Celery task failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

    finally:
        db.close()
        logger.debug("Database session closed in Celery task")