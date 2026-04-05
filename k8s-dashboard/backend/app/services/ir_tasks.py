"""
Playbooks Incident Response — Celery tasks

Types d'incidents et délais :
  - crash_loop      : immédiat → kubectl rollout restart
  - oom_killed      : immédiat → kubectl patch memory +25%
  - resource_saturation : immédiat → kubectl patch HPA +1
  - brute_force     : 120s → NetworkPolicy block IP
  - sql_injection   : 120s → rate limiting renforcé
  - xss             : 120s → rate limiting renforcé
  - unauthorized    : 120s → révocation token JWT
  - http_5xx        : 120s → rollback si deploy < 30min
  - risk_critical   : 300s → rollback + escalade
"""
from celery import shared_task
from datetime import datetime, timedelta
import subprocess
import json
import httpx

from app.services.celery_app import celery_app
from app.config import settings

# Mapping type → (délai en secondes, nom du playbook)
IR_DISPATCH_MAP = {
    "crash_loop": (0, "restart_pod"),
    "oom_killed": (0, "patch_memory"),
    "resource_saturation": (0, "scale_out"),
    "brute_force": (120, "block_ip"),
    "sql_injection": (120, "rate_limit_pod"),
    "xss": (120, "rate_limit_pod"),
    "unauthorized_access": (120, "revoke_token"),
    "http_5xx": (120, "rollback_deploy"),
    "risk_critical": (300, "rollback_escalate"),
}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def dispatch_ir(self, incident_id: int, incident_type: str, score: float):
    """Dispatch le bon playbook avec le bon délai."""
    from app.database import SessionLocal
    from app.models.incident import Incident, IncidentTimer, IncidentStatus

    delay_s, playbook = IR_DISPATCH_MAP.get(incident_type, (120, "alert_only"))

    # Vérifier circuit breaker
    from app.services.circuit_breaker import circuit_breaker_check
    if not circuit_breaker_check(playbook):
        print(f"[IR] Circuit breaker ouvert pour {playbook} — passage en mode manuel")
        return

    # Créer la tâche différée
    eta = datetime.utcnow() + timedelta(seconds=delay_s)
    task = execute_playbook.apply_async(
        args=[incident_id, playbook],
        countdown=delay_s,
    )

    # Persister le timer en base
    db = SessionLocal()
    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if incident:
            incident.status = IncidentStatus.AUTO_PENDING
            timer = IncidentTimer(
                incident_id=incident_id,
                celery_task_id=task.id,
                eta=eta,
            )
            db.add(timer)
            db.commit()
    finally:
        db.close()

    # Notification Slack immédiate
    _send_slack_notification(incident_id, incident_type, playbook, delay_s, eta, task.id)

    return {"task_id": task.id, "eta": eta.isoformat(), "playbook": playbook}


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def execute_playbook(self, incident_id: int, playbook: str):
    """Exécute le playbook IR et met à jour l'incident en base."""
    from app.database import SessionLocal
    from app.models.incident import Incident, IncidentAction, IncidentStatus
    from app.services.circuit_breaker import circuit_breaker_success, circuit_breaker_failure

    db = SessionLocal()
    result = "success"
    error_msg = None

    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident or incident.status not in ("auto_pending", "open"):
            return {"skipped": True, "reason": "incident annulé ou déjà traité"}

        incident.status = IncidentStatus.REMEDIATING
        db.commit()

        # Exécuter le playbook approprié
        if playbook == "restart_pod":
            _kubectl_restart(incident.namespace, incident.pod_name)
        elif playbook == "patch_memory":
            _kubectl_patch_memory(incident.namespace, incident.pod_name)
        elif playbook == "scale_out":
            _kubectl_scale_out(incident.namespace)
        elif playbook == "block_ip":
            source_ip = (incident.metadata_ or {}).get("source_ip")
            if source_ip:
                _block_ip_networkpolicy(incident.namespace, source_ip)
        elif playbook == "rate_limit_pod":
            _apply_rate_limiting(incident.namespace, incident.pod_name)
        elif playbook == "rollback_deploy":
            _kubectl_rollback(incident.namespace, incident.pod_name)
        elif playbook == "rollback_escalate":
            _kubectl_rollback(incident.namespace, incident.pod_name)
            _send_escalation_alert(incident_id)

        # Succès → résoudre l'incident
        incident.status = IncidentStatus.RESOLVED
        incident.resolved_at = datetime.utcnow()
        circuit_breaker_success(playbook)

    except Exception as e:
        result = "failed"
        error_msg = str(e)
        circuit_breaker_failure(playbook)
        if incident:
            incident.status = IncidentStatus.OPEN  # Retour à open pour investigation
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            pass
    finally:
        action = IncidentAction(
            incident_id=incident_id,
            playbook=playbook,
            delay_s=0,
            executed_at=datetime.utcnow(),
            result=result,
            error=error_msg,
        )
        db.add(action)
        db.commit()
        db.close()

    return {"playbook": playbook, "result": result}


# ─── Fonctions kubectl (simulation en dev) ───────────────────

def _kubectl_restart(namespace: str, pod_name: str):
    print(f"[IR] kubectl rollout restart -n {namespace} deployment/{pod_name}")
    # En production : subprocess.run(["kubectl", "rollout", "restart", ...], check=True)

def _kubectl_patch_memory(namespace: str, pod_name: str):
    print(f"[IR] kubectl patch deployment {pod_name} -n {namespace} (memory +25%)")

def _kubectl_scale_out(namespace: str):
    print(f"[IR] kubectl patch hpa -n {namespace} (minReplicas +1)")

def _block_ip_networkpolicy(namespace: str, ip: str):
    print(f"[IR] kubectl apply NetworkPolicy block {ip} in {namespace}")

def _apply_rate_limiting(namespace: str, pod_name: str):
    print(f"[IR] applying rate limit on {pod_name} in {namespace}")

def _kubectl_rollback(namespace: str, pod_name: str):
    print(f"[IR] kubectl rollout undo deployment/{pod_name} -n {namespace}")

def _send_escalation_alert(incident_id: int):
    print(f"[IR] ESCALADE — incident #{incident_id}")


def _send_slack_notification(incident_id, incident_type, playbook, delay_s, eta, task_id):
    if not settings.SLACK_WEBHOOK_URL:
        return
    delay_label = f"{delay_s}s" if delay_s > 0 else "immédiat"
    msg = {
        "text": f":rotating_light: *IR déclenché* — Incident #{incident_id}",
        "blocks": [
            {"type": "section", "text": {"type": "mrkdwn",
                "text": f"*Type* : `{incident_type}`\n*Playbook* : `{playbook}`\n*Exécution dans* : {delay_label}"}},
            {"type": "actions", "elements": [
                {"type": "button", "text": {"type": "plain_text", "text": "✅ Annuler"},
                 "style": "danger",
                 "url": f"http://localhost:3000/incidents/{incident_id}"}
            ]}
        ]
    }
    try:
        httpx.post(settings.SLACK_WEBHOOK_URL, json=msg, timeout=5)
    except Exception:
        pass
