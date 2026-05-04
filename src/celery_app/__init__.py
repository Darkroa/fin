from celery import Celery
from celery.signals import task_prerun, task_postrun
from loguru import logger
import os
import socket


def _redis_available(url: str) -> bool:
    try:
        raw = url.split("://")[-1]
        host = raw.split(":")[0] if ":" in raw else raw.split("/")[0]
        port_part = raw.split(":")[1] if raw.count(":") >= 1 else "6379"
        port = int(port_part.split("/")[0])
        sock = socket.create_connection((host, port), timeout=1)
        sock.close()
        return True
    except Exception:
        return False


REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.getenv("REDIS_RESULT_BACKEND", "redis://localhost:6379/1")

REDIS_MODE = _redis_available(REDIS_URL)

if REDIS_MODE:
    celery_app = Celery(
        "finforge",
        broker=REDIS_URL,
        backend=RESULT_BACKEND,
        include=["src.celery_app.tasks"],
    )
    logger.info("Celery running with Redis broker")
else:
    celery_app = Celery(
        "finforge",
        broker="memory://",
        backend="cache+memory://",
        include=["src.celery_app.tasks"],
    )
    logger.warning("Redis unavailable — Celery running in synchronous (eager) mode. Background tasks will run inline.")

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_always_eager=not REDIS_MODE,
    task_eager_propagates=not REDIS_MODE,
    task_track_started=True,
    task_send_sent_event=REDIS_MODE,
    worker_send_task_events=REDIS_MODE,
    result_extended=True,
    task_time_limit=300,
    task_soft_time_limit=240,
    beat_schedule={
        "ingest-and-detect-every-15-min": {
            "task": "src.celery_app.tasks.ingest_and_detect_events",
            "schedule": 15 * 60,
        },
    },
)


@task_prerun.connect
def task_started(sender=None, task_id=None, task=None, **kwargs):
    logger.info(f"Celery Task Started → {task.name} [ID: {task_id}]")


@task_postrun.connect
def task_finished(sender=None, task_id=None, task=None, state=None, retval=None, **kwargs):
    logger.info(f"Celery Task Finished → {task.name} [ID: {task_id}] → Status: {state}")
