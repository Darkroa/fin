from celery import shared_task
from sqlalchemy.orm import Session
from loguru import logger

from src.ingestion.news_fetcher import NewsFetcher
from src.event.event_detector import EventDetector
from src.database.session import SessionLocal
from src.notifications.notifier import Notifier

notifier = Notifier()


@shared_task(bind=True, name="src.celery_app.tasks.ingest_and_detect_events", 
             max_retries=3, default_retry_delay=60, soft_time_limit=240)
def ingest_and_detect_events(self):
    """
    Main Celery task: Fetch news → Detect events → Save to DB → Notify
    """
    db: Session = SessionLocal()
    try:
        logger.info("🚀 Starting ingestion + event detection task")

        # 1. Fetch latest news
        fetcher = NewsFetcher()
        articles = fetcher.run()
        
        if not articles:
            logger.warning("No articles fetched. Task completed early.")
            return {"articles": 0, "events": 0, "status": "no_data"}

        logger.info(f"Fetched {len(articles)} articles")

        # 2. Detect events
        detector = EventDetector()
        all_events = []
        
        # Process only recent/relevant articles (limit for performance)
        for article in articles[:30]:
            try:
                events = detector.detect_events(article)
                if events:
                    all_events.extend(events)
            except Exception as e:
                logger.error(f"Failed to detect events for article: {e}")
                continue

        # 3. Save events to database
        saved_count = 0
        if all_events:
            saved_count = detector.save_events_to_db(all_events, db)
            # Optional backup
            detector.save_events_to_json(all_events)

        # 4. Send notifications (only if we have new high-impact events)
        high_impact_events = [e for e in all_events if getattr(e, 'impact_score', 0) >= 70]
        if high_impact_events:
            try:
                notifier.send_event_alert(high_impact_events[0])   # or broadcast multiple
            except Exception as e:
                logger.warning(f"Notification failed: {e}")

        logger.success(
            f"✅ Task completed successfully | "
            f"Articles: {len(articles)} → Events: {len(all_events)} → Saved: {saved_count}"
        )

        return {
            "status": "success",
            "articles_processed": len(articles),
            "events_detected": len(all_events),
            "events_saved": saved_count,
            "high_impact_events": len(high_impact_events)
        }

    except Exception as exc:
        logger.error(f"❌ Celery task failed: {exc}", exc_info=True)
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))
    
    finally:
        db.close()
        logger.debug("Database session closed")