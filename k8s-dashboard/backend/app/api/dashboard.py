from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.incident import Incident, RiskScore, SeverityLevel, IncidentStatus, IncidentTimer
from app.api.auth import verify_token

router = APIRouter()


class NamespaceRisk(BaseModel):
    namespace: str
    incident_count: int
    avg_score: float
    max_severity: str


class PendingAction(BaseModel):
    incident_id: int
    incident_type: str
    namespace: str
    pod_name: Optional[str]
    playbook: str
    eta: datetime
    seconds_remaining: int
    celery_task_id: str


class DashboardSummaryResponse(BaseModel):
    total_incidents_24h: int
    open_incidents: int
    critical_incidents: int
    high_incidents: int
    current_risk_score: float
    current_risk_level: str
    top_namespaces: List[NamespaceRisk]
    pending_ir_actions: List[PendingAction]
    resolved_today: int


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    namespace: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    now = datetime.utcnow()
    since_24h = now - timedelta(hours=24)
    since_today = now.replace(hour=0, minute=0, second=0, microsecond=0)

    base_q = db.query(Incident)
    if namespace:
        base_q = base_q.filter(Incident.namespace == namespace)

    # Compteurs
    total_24h = base_q.filter(Incident.detected_at >= since_24h).count()
    open_count = base_q.filter(Incident.status == IncidentStatus.OPEN).count()
    critical_count = base_q.filter(
        Incident.severity == SeverityLevel.CRITICAL,
        Incident.status.in_([IncidentStatus.OPEN, IncidentStatus.AUTO_PENDING]),
    ).count()
    high_count = base_q.filter(
        Incident.severity == SeverityLevel.HIGH,
        Incident.status.in_([IncidentStatus.OPEN, IncidentStatus.AUTO_PENDING]),
    ).count()
    resolved_today = base_q.filter(
        Incident.status == IncidentStatus.RESOLVED,
        Incident.resolved_at >= since_today,
    ).count()

    # Risk Score courant
    risk_q = db.query(RiskScore)
    if namespace:
        risk_q = risk_q.filter(RiskScore.namespace == namespace)
    latest_risk = risk_q.order_by(desc(RiskScore.computed_at)).first()
    current_score = latest_risk.score if latest_risk else 0
    current_level = latest_risk.level.value if latest_risk else "LOW"

    # Top namespaces par risque (24h)
    ns_query = (
        db.query(
            Incident.namespace,
            func.count(Incident.id).label("incident_count"),
            func.avg(Incident.score).label("avg_score"),
            func.max(Incident.score).label("max_score"),
        )
        .filter(Incident.detected_at >= since_24h)
        .group_by(Incident.namespace)
        .order_by(desc("max_score"))
        .limit(5)
        .all()
    )

    top_namespaces = []
    for row in ns_query:
        max_s = row.max_score or 0
        if max_s >= 76:
            sev = "CRITICAL"
        elif max_s >= 51:
            sev = "HIGH"
        elif max_s >= 26:
            sev = "MEDIUM"
        else:
            sev = "LOW"
        top_namespaces.append(
            NamespaceRisk(
                namespace=row.namespace,
                incident_count=row.incident_count,
                avg_score=round(row.avg_score or 0, 1),
                max_severity=sev,
            )
        )

    # Actions IR en attente
    pending_timers = (
        db.query(IncidentTimer, Incident)
        .join(Incident, IncidentTimer.incident_id == Incident.id)
        .filter(
            IncidentTimer.cancelled_at.is_(None),
            IncidentTimer.eta > now,
            Incident.status == IncidentStatus.AUTO_PENDING,
        )
        .order_by(IncidentTimer.eta)
        .all()
    )

    pending_actions = []
    for timer, incident in pending_timers:
        secs = max(0, int((timer.eta - now).total_seconds()))
        pending_actions.append(
            PendingAction(
                incident_id=incident.id,
                incident_type=incident.type,
                namespace=incident.namespace,
                pod_name=incident.pod_name,
                playbook=incident.type,
                eta=timer.eta,
                seconds_remaining=secs,
                celery_task_id=timer.celery_task_id,
            )
        )

    return DashboardSummaryResponse(
        total_incidents_24h=total_24h,
        open_incidents=open_count,
        critical_incidents=critical_count,
        high_incidents=high_count,
        current_risk_score=current_score,
        current_risk_level=current_level,
        top_namespaces=top_namespaces,
        pending_ir_actions=pending_actions,
        resolved_today=resolved_today,
    )
