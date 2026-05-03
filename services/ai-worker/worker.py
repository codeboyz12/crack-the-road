import asyncio
import logging
import os
from celery import Celery
from celery.signals import worker_ready

logger = logging.getLogger(__name__)
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

app = Celery("rcm_worker", broker=REDIS_URL, backend=REDIS_URL)

app.conf.task_routes = {"worker.detect_crack": {"queue": "crack.detect"}}
app.conf.task_serializer   = "json"
app.conf.result_serializer = "json"
app.conf.accept_content    = ["json"]


@worker_ready.connect
def on_worker_ready(sender, **kwargs):
    """Pre-warm the AI provider so model sessions are loaded before the first task."""
    from providers import get_ai_provider
    provider = get_ai_provider()

    async def _warm():
        ok = await provider.health_check()
        if ok:
            logger.info("AI provider ready: %s", type(provider).__name__)
        else:
            logger.error("AI provider health check FAILED: %s", type(provider).__name__)

    asyncio.run(_warm())


@app.task(name="worker.detect_crack", bind=True, max_retries=3, default_retry_delay=10)
def detect_crack(self, report_id: str):
    try:
        from tasks.detect_crack import run_detection
        run_detection(report_id)
    except Exception as exc:
        raise self.retry(exc=exc)
