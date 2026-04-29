import asyncio
import time
import httpx
from .base import AIProvider, DetectionResult, BoundingBox, CrackType, Severity


class TritonProvider(AIProvider):
    def __init__(self, url: str, model_name: str):
        self.url        = url
        self.model_name = model_name

    async def detect(self, image_path: str) -> DetectionResult:
        # Placeholder — implement Triton HTTP inference protocol when ready
        raise NotImplementedError("Triton provider not yet implemented")

    async def health_check(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{self.url}/v2/health/ready")
                return r.status_code == 200
        except Exception:
            return False
