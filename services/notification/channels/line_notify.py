import os
import httpx

LINE_NOTIFY_TOKEN = os.getenv("LINE_NOTIFY_TOKEN", "")


async def send_line(message: str):
    if not LINE_NOTIFY_TOKEN:
        print(f"[LINE] (no token) {message}")
        return
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://notify-api.line.me/api/notify",
            headers={"Authorization": f"Bearer {LINE_NOTIFY_TOKEN}"},
            data={"message": message},
        )
