import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

app = Celery("rcm_worker", broker=REDIS_URL, backend=REDIS_URL)

app.conf.task_routes = {"worker.detect_crack": {"queue": "crack.detect"}}
app.conf.task_serializer   = "json"
app.conf.result_serializer = "json"
app.conf.accept_content    = ["json"]


@app.task(name="worker.detect_crack", bind=True, max_retries=3, default_retry_delay=10)
def detect_crack(self, report_id: str):
    try:
        from tasks.detect_crack import run_detection
        run_detection(report_id)
    except Exception as exc:
        raise self.retry(exc=exc)
