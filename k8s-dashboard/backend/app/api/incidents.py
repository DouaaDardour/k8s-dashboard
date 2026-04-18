from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from datetime import datetime

from app.database import get_db
from app.models.incident import (
    Incident, IncidentAction, IncidentTimer,
    IncidentStatus, SeverityLevel, IncidentCategory
)
from app.api.auth import verify_token

router = APIRouter()


# ─── Schémas de réponse ───────────────────────────────────────

class IncidentResponse(BaseModel):
    id: int
    type: str
    severity: str
    category: str
    score: float
    status: str
    namespace: str
    pod_name: Optional[str]
    detected_at: datetime
    resolved_at: Optional[datetime]
    metadata_: Optional[dict] = None

    class Config:
        from_attributes = True


class ActionResponse(BaseModel):
    id: int
    playbook: str
    delay_s: int
    executed_at: Optional[datetime]
    result: Optional[str]
    error: Optional[str]

    class Config:
        from_attributes = True


class TimerResponse(BaseModel):
    id: int
    incident_id: int
    celery_task_id: str
    eta: datetime
    cancelled_at: Optional[datetime]
    seconds_remaining: Optional[int] = None

    class Config:
        from_attributes = True


class IncidentListResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    page: int
    page_size: int


# ─── Endpoints ────────────────────────────────────────────────

@router.get("", response_model=IncidentListResponse)
def list_incidents(
    namespace: Optional[str] = Query(None),
    pod_name: Optional[str] = Query(None),
    severity: Optional[SeverityLevel] = Query(None),
    status: Optional[IncidentStatus] = Query(None),
    category: Optional[IncidentCategory] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    q = db.query(Incident)
    if namespace:
        q = q.filter(Incident.namespace == namespace)
    if pod_name:
        q = q.filter(Incident.pod_name == pod_name)
    if severity:
        q = q.filter(Incident.severity == severity)
    if status:
        q = q.filter(Incident.status == status)
    if category:
        q = q.filter(Incident.category == category)

    total = q.count()
    items = q.order_by(desc(Incident.detected_at)).offset((page - 1) * page_size).limit(page_size).all()

    return IncidentListResponse(items=items, total=total, page=page, page_size=page_size)


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: int, db: Session = Depends(get_db), _: dict = Depends(verify_token)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    return incident


@router.get("/{incident_id}/timeline", response_model=List[ActionResponse])
def get_incident_timeline(
    incident_id: int, db: Session = Depends(get_db), _: dict = Depends(verify_token)
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")
    return incident.actions


@router.get("/{incident_id}/timer", response_model=Optional[TimerResponse])
def get_incident_timer(
    incident_id: int, db: Session = Depends(get_db), _: dict = Depends(verify_token)
):
    """Retourne le timer IR actif pour un incident (pour le Live Panel)"""
    timer = (
        db.query(IncidentTimer)
        .filter(
            IncidentTimer.incident_id == incident_id,
            IncidentTimer.cancelled_at.is_(None),
        )
        .order_by(desc(IncidentTimer.eta))
        .first()
    )
    if not timer:
        return None

    now = datetime.utcnow()
    seconds_remaining = max(0, int((timer.eta - now).total_seconds()))
    response = TimerResponse(
        id=timer.id,
        incident_id=timer.incident_id,
        celery_task_id=timer.celery_task_id,
        eta=timer.eta,
        cancelled_at=timer.cancelled_at,
        seconds_remaining=seconds_remaining,
    )
    return response


@router.post("/{incident_id}/cancel")
def cancel_incident(
    incident_id: int, db: Session = Depends(get_db), _: dict = Depends(verify_token)
):
    """Annule une action IR en attente (révoque la tâche Celery)"""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")

    if incident.status != IncidentStatus.AUTO_PENDING:
        raise HTTPException(status_code=400, detail=f"Impossible d'annuler un incident en statut '{incident.status}'")

    # Révoquer la tâche Celery
    active_timers = (
        db.query(IncidentTimer)
        .filter(IncidentTimer.incident_id == incident_id, IncidentTimer.cancelled_at.is_(None))
        .all()
    )
    from app.services.celery_app import celery_app
    for timer in active_timers:
        celery_app.control.revoke(timer.celery_task_id, terminate=True)
        timer.cancelled_at = datetime.utcnow()

    incident.status = IncidentStatus.CANCELLED
    db.commit()

    return {"status": "cancelled", "incident_id": incident_id}


@router.post("/{incident_id}/execute-now")
def force_execute_incident(
    incident_id: int, db: Session = Depends(get_db), _: dict = Depends(verify_token)
):
    """Force l'exécution immédiate du playbook IR pour cet incident (outrepasse le timer de 120s)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident non trouvé")

    # Chercher le timer actif
    timer = db.query(IncidentTimer).filter(IncidentTimer.incident_id == incident_id).order_by(desc(IncidentTimer.id)).first()

    if incident.status == IncidentStatus.AUTO_PENDING and timer:
        from app.services.celery_app import celery_app
        from app.services.ir_tasks import execute_playbook, IR_DISPATCH_MAP
        
        # 1. Révoquer la tâche en cours
        celery_app.control.revoke(timer.celery_task_id, terminate=True)
        timer.cancelled_at = datetime.utcnow()
        
        # 2. Exécuter la mitigation immédiatement pour éviter le délai
        delay_s, mapped_playbook, _ = IR_DISPATCH_MAP.get(incident.type, (0, "block_and_alert", ""))
        
        # Passer en mode RECOVERY direct
        incident.status = IncidentStatus.REMEDIATING
        db.commit()

        execute_playbook.delay(incident.id, mapped_playbook, incident.type, incident.score)
        return {"status": "forced", "playbook": mapped_playbook, "message": "Exécution forcée de l'Incident Response déclenchée avec succès."}
    
    return {"status": "ignored", "message": "Aucune action en attente pour cet incident."}



@router.post("/{incident_id}/resolve")
def resolve_incident(
    incident_id: int, db: Session = Depends(get_db), _: dict = Depends(verify_token)
):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident introuvable")

    incident.status = IncidentStatus.RESOLVED
    incident.resolved_at = datetime.utcnow()
    db.commit()

    return {"status": "resolved", "incident_id": incident_id}


@router.get("/namespaces/list")
def list_namespaces(db: Session = Depends(get_db), _: dict = Depends(verify_token)):
    rows = db.query(Incident.namespace).distinct().all()
    return [r[0] for r in rows]


@router.get("/pods/list")
def list_pods(
    namespace: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    q = db.query(Incident.pod_name).distinct()
    if namespace:
        q = q.filter(Incident.namespace == namespace)
    rows = q.all()
    return [r[0] for r in rows if r[0]]
