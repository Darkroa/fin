from celery import shared_task
from sqlalchemy.orm import Session
from datetime import datetime
from loguru import logger

from src.database.session import SessionLocal
from src.database.models import Event
from src.notifications.notifier import Notifier

notifier = Notifier()


@shared_task(bind=True, name="src.celery_app.tasks.ingest_and_detect_events",
             max_retries=3, default_retry_delay=60, soft_time_limit=240)
def ingest_and_detect_events(self):
    from src.ingestion.news_fetcher import NewsFetcher
    from src.event.event_detector import EventDetector

    db: Session = SessionLocal()
    try:
        logger.info("Starting ingestion + event detection task")

        fetcher = NewsFetcher()
        articles = fetcher.run()

        if not articles:
            logger.warning("No articles fetched. Task completed early.")
            return {"articles": 0, "events": 0, "status": "no_data"}

        logger.info(f"Fetched {len(articles)} articles")

        detector = EventDetector()
        all_events = []

        for article in articles[:30]:
            try:
                events = detector.detect_events(article)
                if events:
                    all_events.extend(events)
            except Exception as e:
                logger.error(f"Failed to detect events for article: {e}")
                continue

        saved_count = 0
        if all_events:
            # Dedupe against events saved in the last 30 minutes so a task
            # retry doesn't insert the same headline twice.
            from datetime import timedelta
            cutoff = datetime.utcnow() - timedelta(minutes=30)
            recent_titles = {
                row.title for row in db.query(Event.title).filter(Event.created_at >= cutoff).all()
            }
            fresh = [e for e in all_events if getattr(e, "title", "") not in recent_titles]
            skipped = len(all_events) - len(fresh)
            if skipped:
                logger.info(f"Skipped {skipped} duplicate events (seen in last 30 min)")
            if fresh:
                saved_count = detector.save_events_to_db(fresh, db)
            detector.save_events_to_json(all_events)

        high_impact_events = [e for e in all_events if getattr(e, 'impact_score', 0) >= 7]
        if high_impact_events:
            try:
                notifier.send_event_alert(high_impact_events[0])
            except Exception as e:
                logger.warning(f"Notification failed: {e}")

        logger.success(
            f"Task completed | Articles: {len(articles)} → Events: {len(all_events)} → Saved: {saved_count}"
        )

        return {
            "status": "success",
            "articles_processed": len(articles),
            "events_detected": len(all_events),
            "events_saved": saved_count,
            "high_impact_events": len(high_impact_events)
        }

    except Exception as exc:
        logger.error(f"Celery task failed: {exc}", exc_info=True)
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))

    finally:
        db.close()
        logger.debug("Database session closed")
