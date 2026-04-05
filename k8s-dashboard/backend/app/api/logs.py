from fastapi import APIRouter, Depends, BackgroundTasks, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.log import RawLog
from app.models.incident import Incident, RiskScore, SeverityLevel, IncidentCategory
from app.api.auth import verify_token
from app.services.ml_client import score_log
from app.config import settings

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


class LogIngestRequest(BaseModel):
    namespace: str = Field(..., min_length=1, max_length=255)
    pod_name: str = Field(..., min_length=1, max_length=255)
    container_name: Optional[str] = None
    message: str = Field(..., min_length=1)
    log_level: Optional[str] = None
    source_ip: Optional[str] = None
    timestamp: Optional[datetime] = None
    raw_json: Optional[dict] = None


class LogIngestResponse(BaseModel):
    id: int
    status: str
    risk_score: Optional[float] = None


def _compute_risk_level(score: float) -> SeverityLevel:
    if score >= settings.RISK_THRESHOLD_CRITICAL:
        return SeverityLevel.CRITICAL
    elif score >= settings.RISK_THRESHOLD_HIGH:
        return SeverityLevel.HIGH
    elif score >= settings.RISK_THRESHOLD_MEDIUM:
        return SeverityLevel.MEDIUM
    return SeverityLevel.LOW


async def _analyze_and_create_incident(log_id: int, log_data: dict, db: Session):
    """Tâche de fond : appel ML → création incident si score > 40"""
    try:
        result = await score_log(log_data)
        score = result.get("score", 0)
        incident_type = result.get("type", "unknown")
        category_str = result.get("category", "reliability")

        # Sauvegarder le Risk Score global
        level = _compute_risk_level(score)
        risk = RiskScore(
            score=score,
            level=level,
            namespace=log_data["namespace"],
            security_score=result.get("security_score", 0),
            reliability_score=result.get("reliability_score", 0),
            frequency_score=result.get("frequency_score", 0),
            breakdown=result,
        )
        db.add(risk)

        # Créer un incident si score > 40
        if score > 40:
            try:
                category = IncidentCategory(category_str)
            except ValueError:
                category = IncidentCategory.RELIABILITY

            incident = Incident(
                type=incident_type,
                severity=level,
                category=category,
                score=score,
                namespace=log_data["namespace"],
                pod_name=log_data["pod_name"],
                container_name=log_data.get("container_name"),
                metadata_={"log_id": log_id, "ml_result": result},
            )
            db.add(incident)

            # Déclencher IR si CRITICAL ou HIGH
            if score >= settings.RISK_THRESHOLD_HIGH:
                from app.services.ir_tasks import dispatch_ir
                db.flush()
                dispatch_ir.delay(incident.id, incident_type, score)

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[ML Analysis Error] {e}")


@router.post("/ingest", response_model=LogIngestResponse)
@limiter.limit("1000/minute")
async def ingest_log(
    request: Request,
    payload: LogIngestRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    log = RawLog(
        namespace=payload.namespace,
        pod_name=payload.pod_name,
        container_name=payload.container_name,
        message=payload.message,
        log_level=payload.log_level,
        source_ip=payload.source_ip,
        timestamp=payload.timestamp or datetime.utcnow(),
        raw_json=payload.raw_json,
    )
    db.add(log)
    db.commit()
    db.refresh(log)

    # Analyse ML en arrière-plan (non-bloquant)
    background_tasks.add_task(
        _analyze_and_create_incident,
        log.id,
        payload.model_dump(),
        db,
    )

    return LogIngestResponse(id=log.id, status="accepted")
