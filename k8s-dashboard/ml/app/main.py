from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
from app.scorer import compute_score

app = FastAPI(title="K8s ML Scoring Service", version="1.0.0")


class LogRequest(BaseModel):
    namespace: str
    pod_name: str
    message: str
    source_ip: Optional[str] = None
    container_name: Optional[str] = None
    raw_json: Optional[dict] = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(log: LogRequest):
    result = compute_score(log.model_dump())
    return result
