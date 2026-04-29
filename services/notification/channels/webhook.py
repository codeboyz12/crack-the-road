import os
import httpx

WEBHOOK_URL = os.getenv("ALERT_WEBHOOK_URL", "")


async def send_webhook(payload: dict):
    if not WEBHOOK_URL:
        print(f"[WEBHOOK] (no url) {payload}")
        return
    async with httpx.AsyncClient(timeout=5) as client:
        await client.post(WEBHOOK_URL, json=payload)
