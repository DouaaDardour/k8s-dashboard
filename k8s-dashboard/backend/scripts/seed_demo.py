"""
Injecte des données de démo en base pour tester le dashboard.
Usage : docker compose exec api python scripts/seed_demo.py
"""
import sys, os
sys.path.insert(0, "/app")

from datetime import datetime, timedelta
import random
from app.database import SessionLocal, engine, Base
from app.models.incident import (
    Incident, RiskScore, IncidentAction,
    SeverityLevel, IncidentStatus, IncidentCategory
)
from app.models.log import RawLog

Base.metadata.create_all(bind=engine)
db = SessionLocal()

NAMESPACES = ["production", "staging", "monitoring", "default"]
PODS = {
    "production": ["api-server-7d9f", "payment-svc-3k2l", "auth-service-9mx"],
    "staging": ["frontend-dev-2x1", "backend-test-5z"],
    "monitoring": ["prometheus-6g4", "grafana-2b1"],
    "default": ["nginx-ingress-7x2"],
}

INCIDENT_TYPES = [
    ("crash_loop", SeverityLevel.HIGH, IncidentCategory.RELIABILITY, (55, 80)),
    ("oom_killed", SeverityLevel.HIGH, IncidentCategory.RELIABILITY, (50, 75)),
    ("sql_injection", SeverityLevel.CRITICAL, IncidentCategory.SECURITY, (76, 100)),
    ("brute_force", SeverityLevel.CRITICAL, IncidentCategory.SECURITY, (70, 95)),
    ("http_5xx", SeverityLevel.MEDIUM, IncidentCategory.RELIABILITY, (30, 60)),
    ("resource_saturation", SeverityLevel.HIGH, IncidentCategory.PERFORMANCE, (55, 80)),
    ("xss", SeverityLevel.HIGH, IncidentCategory.SECURITY, (55, 85)),
    ("unauthorized_access", SeverityLevel.MEDIUM, IncidentCategory.SECURITY, (30, 60)),
]

print("🌱 Injection des données de démo...")

# ─── Incidents (7 derniers jours) ────────────────────────────
incidents_created = 0
for i in range(80):
    inc_type, severity, category, score_range = random.choice(INCIDENT_TYPES)
    ns = random.choice(NAMESPACES)
    pod = random.choice(PODS[ns])
    score = random.uniform(*score_range)
    hours_ago = random.uniform(0, 168)  # 7 jours
    detected = datetime.utcnow() - timedelta(hours=hours_ago)

    status = random.choices(
        [IncidentStatus.OPEN, IncidentStatus.RESOLVED, IncidentStatus.CANCELLED, IncidentStatus.AUTO_PENDING],
        weights=[20, 50, 15, 15]
    )[0]

    incident = Incident(
        type=inc_type,
        severity=severity,
        category=category,
        score=round(score, 1),
        status=status,
        namespace=ns,
        pod_name=pod,
        detected_at=detected,
        resolved_at=detected + timedelta(minutes=random.randint(5, 60)) if status == IncidentStatus.RESOLVED else None,
        metadata_={"source": "seed_demo", "source_ip": f"192.168.{random.randint(1,254)}.{random.randint(1,254)}"},
    )
    db.add(incident)
    db.flush()

    # Actions associées
    if status in (IncidentStatus.RESOLVED, IncidentStatus.REMEDIATING):
        action = IncidentAction(
            incident_id=incident.id,
            playbook=f"{'restart_pod' if inc_type == 'crash_loop' else 'block_ip' if 'injection' in inc_type or 'brute' in inc_type else 'rate_limit_pod'}",
            delay_s=0 if inc_type in ("crash_loop", "oom_killed") else 120,
            executed_at=detected + timedelta(minutes=2),
            result="success",
        )
        db.add(action)

    incidents_created += 1

# ─── Risk Scores (7 derniers jours, toutes les 5 min) ─────────
scores_created = 0
for minutes_ago in range(0, 60 * 24 * 7, 5):
    ts = datetime.utcnow() - timedelta(minutes=minutes_ago)
    base = 35 + 20 * abs(((minutes_ago // 60) % 12) - 6) / 6  # vague sinusoïdale
    score = max(0, min(100, base + random.gauss(0, 8)))

    if score >= 76:
        level = SeverityLevel.CRITICAL
    elif score >= 51:
        level = SeverityLevel.HIGH
    elif score >= 26:
        level = SeverityLevel.MEDIUM
    else:
        level = SeverityLevel.LOW

    ns = random.choice(NAMESPACES + [None])
    rs = RiskScore(
        computed_at=ts,
        score=round(score, 1),
        level=level,
        namespace=ns,
        security_score=round(score * 0.5 + random.gauss(0, 5), 1),
        reliability_score=round(score * 0.3 + random.gauss(0, 3), 1),
        frequency_score=round(score * 0.2 + random.gauss(0, 2), 1),
        breakdown={"weights": {"security": 0.5, "reliability": 0.3, "frequency": 0.2}},
    )
    db.add(rs)
    scores_created += 1

db.commit()
db.close()
print(f"✅ {incidents_created} incidents créés")
print(f"✅ {scores_created} risk scores créés")
print("🎉 Données de démo injectées avec succès !")
