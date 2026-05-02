from celery import Celery
from core.config import settings

_celery = Celery(broker=settings.redis_url)


def enqueue_detection(report_id: str) -> None:
    _celery.send_task(
        "worker.detect_crack",
        args=[report_id],
        queue="crack.detect",
    )
