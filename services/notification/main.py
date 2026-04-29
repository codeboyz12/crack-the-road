import asyncio
import json
import os
import redis.asyncio as aioredis
from channels.line_notify import send_line
from channels.email import send_email
from channels.webhook import send_webhook

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")

CHANNELS = ["alert.threshold_exceeded", "report.created", "report.ai_processed"]


async def handle_alert(payload: dict):
    channels = payload.get("notify_channels", [])
    message  = (
        f"[RCM Alert] {payload.get('zone_name')} — {payload.get('province')}\n"
        f"พบรายงาน {payload.get('report_count')} รายการ | ระดับ: {payload.get('severity')}"
    )

    tasks = []
    if "line" in channels:
        tasks.append(send_line(message))
    if "email" in channels:
        tasks.append(send_email("Road Crack Alert", message))
    if "webhook" in channels:
        tasks.append(send_webhook(payload))

    await asyncio.gather(*tasks, return_exceptions=True)


async def main():
    r = aioredis.from_url(REDIS_URL)
    pubsub = r.pubsub()
    await pubsub.subscribe(*CHANNELS)

    print(f"Notification service listening on: {CHANNELS}")

    async for message in pubsub.listen():
        if message["type"] != "message":
            continue
        try:
            payload = json.loads(message["data"])
            channel = message["channel"]
            if isinstance(channel, bytes):
                channel = channel.decode()

            if channel == "alert.threshold_exceeded":
                await handle_alert(payload)
        except Exception as e:
            print(f"Error handling message: {e}")


if __name__ == "__main__":
    asyncio.run(main())
