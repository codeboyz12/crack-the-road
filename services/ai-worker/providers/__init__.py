import os
from .base import AIProvider
from .mock_yolo    import MockYOLOProvider
from .yolov8_local import YOLOv8LocalProvider
from .triton       import TritonProvider


def get_ai_provider() -> AIProvider:
    provider_name = os.getenv("AI_PROVIDER", "mock").lower()

    match provider_name:
        case "mock":
            return MockYOLOProvider()
        case "yolov8_local":
            model_path = os.getenv("MODEL_PATH", "/models/crack_yolov8.pt")
            device     = os.getenv("MODEL_DEVICE", "cuda")
            return YOLOv8LocalProvider(model_path=model_path, device=device)
        case "triton":
            triton_url  = os.getenv("TRITON_URL", "http://triton:8001")
            model_name  = os.getenv("TRITON_MODEL_NAME", "crack_yolov8")
            return TritonProvider(url=triton_url, model_name=model_name)
        case _:
            raise ValueError(f"Unknown AI_PROVIDER: {provider_name}")
