from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.incident import RiskScore, SeverityLevel
from app.api.auth import verify_token

router = APIRouter()


class RiskScoreResponse(BaseModel):
    score: float
    level: str
    computed_at: datetime
    security_score: float
    reliability_score: float
    frequency_score: float
    namespace: Optional[str]
    breakdown: Optional[dict]

    class Config:
        from_attributes = True


class RiskHistoryPoint(BaseModel):
    computed_at: datetime
    score: float
    level: str


@router.get("", response_model=RiskScoreResponse)
def get_current_risk_score(
    namespace: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Retourne le Risk Score le plus récent (global ou par namespace)"""
    q = db.query(RiskScore)
    if namespace:
        q = q.filter(RiskScore.namespace == namespace)

    score = q.order_by(desc(RiskScore.computed_at)).first()

    if not score:
        # Retourner un score vide si aucune donnée
        return RiskScoreResponse(
            score=0,
            level="LOW",
            computed_at=datetime.utcnow(),
            security_score=0,
            reliability_score=0,
            frequency_score=0,
            namespace=namespace,
            breakdown={},
        )
    return score


@router.get("/history", response_model=List[RiskHistoryPoint])
def get_risk_history(
    days: int = Query(7, ge=1, le=90),
    namespace: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: dict = Depends(verify_token),
):
    """Historique du Risk Score sur N jours pour les graphes"""
    since = datetime.utcnow() - timedelta(days=days)
    q = db.query(RiskScore).filter(RiskScore.computed_at >= since)
    if namespace:
        q = q.filter(RiskScore.namespace == namespace)

    scores = q.order_by(RiskScore.computed_at).all()
    return scores
