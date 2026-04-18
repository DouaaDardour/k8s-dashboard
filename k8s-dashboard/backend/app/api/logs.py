from fastapi import APIRouter, Depends, BackgroundTasks, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional, List, Union
from datetime import datetime
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.log import RawLog
from app.models.incident import Incident, RiskScore, SeverityLevel, IncidentCategory
from app.api.auth import verify_token
from app.services.ml_client import score_log
from app.config import settings
import re

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# ─── Regex pour extraire les IPs sources depuis les logs ──────
# Nginx access log: "203.0.113.42 - - [14/Apr/2026:17:07:08 +0000] ..."
_NGINX_IP_RE = re.compile(r'^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+-\s+-\s+\[')
# Pattern IP générique dans le message
_GENERIC_IP_RE = re.compile(r'(?:client|remote|src|source|from|ip)[=:\s]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', re.IGNORECASE)
# X-Forwarded-For dans le message
_XFF_RE = re.compile(r'X-Forwarded-For[=:\s"]+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})', re.IGNORECASE)
# IP en tout début de ligne (format access log classique)
_LEADING_IP_RE = re.compile(r'^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b')

# IPs à ignorer (pods internes K8s, localhost, etc.)
_INTERNAL_PREFIXES = ('10.', '172.16.', '172.17.', '172.18.', '172.19.',
                      '172.20.', '172.21.', '172.22.', '172.23.', '172.24.',
                      '172.25.', '172.26.', '172.27.', '172.28.', '172.29.',
                      '172.30.', '172.31.', '192.168.', '127.', '0.0.0.0')


def _extract_source_ip(message: str, explicit_ip: str = None) -> str | None:
    """
    Extrait l'IP source depuis le message de log ou le champ explicite.
    Priorité : explicit > X-Forwarded-For > Nginx access log > générique > leading IP
    """
    # 1. Si FluentBit a fourni une IP explicite
    if explicit_ip and not explicit_ip.startswith(_INTERNAL_PREFIXES):
        return explicit_ip

    if not message:
        return explicit_ip

    # 2. X-Forwarded-For (IP réelle derrière un proxy/ALB)
    m = _XFF_RE.search(message)
    if m and not m.group(1).startswith(_INTERNAL_PREFIXES):
        return m.group(1)

    # 3. Format Nginx access log standard
    m = _NGINX_IP_RE.match(message)
    if m and not m.group(1).startswith(_INTERNAL_PREFIXES):
        return m.group(1)

    # 4. Pattern client/remote/source=IP
    m = _GENERIC_IP_RE.search(message)
    if m and not m.group(1).startswith(_INTERNAL_PREFIXES):
        return m.group(1)

    # 5. IP en début de ligne (dernier recours)
    m = _LEADING_IP_RE.match(message)
    if m and not m.group(1).startswith(_INTERNAL_PREFIXES):
        return m.group(1)

    return explicit_ip


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
    """Tâche de fond : appel ML → création incident si score > 40 (avec déduplication)"""
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

        # Créer un incident si score > 40 (avec déduplication fenêtre 5 min)
        if score > 40:
            try:
                category = IncidentCategory(category_str)
            except ValueError:
                category = IncidentCategory.RELIABILITY

            # ─── Déduplication : chercher un incident identique récent ───
            from datetime import timedelta
            dedup_window = datetime.utcnow() - timedelta(minutes=5)
            existing = (
                db.query(Incident)
                .filter(
                    Incident.type == incident_type,
                    Incident.namespace == log_data["namespace"],
                    Incident.detected_at >= dedup_window,
                    Incident.status.in_(["open", "auto_pending"]),
                )
                .first()
            )

            if existing:
                # Mettre à jour le score si celui-ci est plus élevé
                if score > existing.score:
                    existing.score = score
                    existing.severity = level
                # Compteur de doublons dans les métadonnées
                meta = existing.metadata_ or {}
                meta["duplicate_count"] = meta.get("duplicate_count", 1) + 1
                meta["last_log_id"] = log_id
                existing.metadata_ = meta
            else:
                # Extraire l'IP source depuis le message de log
                extracted_ip = _extract_source_ip(
                    log_data.get("message", ""),
                    log_data.get("source_ip")
                )

                # Créer un nouvel incident
                incident = Incident(
                    type=incident_type,
                    severity=level,
                    category=category,
                    score=score,
                    namespace=log_data["namespace"],
                    pod_name=log_data["pod_name"],
                    container_name=log_data.get("container_name"),
                    metadata_={
                        "log_id": log_id, 
                        "ml_result": result, 
                        "duplicate_count": 1,
                        "source_ip": extracted_ip,
                        "ip_extraction_method": "regex_log_parser" if extracted_ip else "none",
                    },
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


@router.post("/ingest")
@limiter.limit("1000/minute")
async def ingest_log(
    request: Request,
    payload: Union[LogIngestRequest, List[LogIngestRequest]],
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    payloads = payload if isinstance(payload, list) else [payload]
    results = []

    # Extraire l'IP du client depuis les headers HTTP (ALB / proxy)
    client_ip_from_headers = (
        request.headers.get("X-Forwarded-For", "").split(",")[0].strip()
        or request.headers.get("X-Real-IP", "")
        or (request.client.host if request.client else None)
    )

    for item in payloads:
        # Extraire l'IP source intelligemment
        resolved_ip = _extract_source_ip(
            item.message,
            item.source_ip or client_ip_from_headers
        )

        log = RawLog(
            namespace=item.namespace,
            pod_name=item.pod_name,
            container_name=item.container_name,
            message=item.message,
            log_level=item.log_level,
            source_ip=resolved_ip,
            timestamp=item.timestamp or datetime.utcnow(),
            raw_json=item.raw_json,
        )
        db.add(log)
        db.commit()
        db.refresh(log)

        # Injecter l'IP résolue dans les données pour l'analyse ML
        log_data = item.model_dump()
        log_data["source_ip"] = resolved_ip

        # Analyse ML en arrière-plan (non-bloquant)
        background_tasks.add_task(
            _analyze_and_create_incident,
            log.id,
            log_data,
            db,
        )
        results.append({"id": log.id, "status": "accepted", "resolved_ip": resolved_ip})

    if isinstance(payload, list):
        return results
    return results[0]
