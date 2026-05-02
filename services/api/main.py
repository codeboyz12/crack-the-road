from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os

from core.config import settings
from routers import reports, map, alerts, admin, auth, stats, ws


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield


app = FastAPI(
    title="Road Crack Monitor API",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(reports.router)
app.include_router(map.router)
app.include_router(alerts.router)
app.include_router(admin.router)
app.include_router(stats.router)
app.include_router(ws.router)

app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/health/ai")
async def health_ai():
    """Verify AI model files are accessible from the API container's perspective."""
    import os
    provider = os.getenv("AI_PROVIDER", "mock")
    checks: dict = {"provider": provider}

    if provider == "onnx":
        stage1 = os.getenv("STAGE1_MODEL_PATH", "/models/stage1_efficientnet_b0.onnx")
        stage2 = os.getenv("STAGE2_MODEL_PATH", "/models/mobilenet_v2_model.onnx")
        checks["stage1_model"] = os.path.exists(stage1)
        checks["stage2_model"] = os.path.exists(stage2)
        checks["status"] = "ok" if all([checks["stage1_model"], checks["stage2_model"]]) else "missing_models"
    elif provider == "mock":
        checks["status"] = "ok (mock — no models needed)"
    else:
        checks["status"] = "unknown provider"

    return checks
