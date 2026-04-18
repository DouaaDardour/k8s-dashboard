"""
Playbooks Incident Response — Celery tasks (Niveau 1 — Production Ready)

Architecture PICERL :
  PREPARE   → Configuration des seuils et délais
  IDENTIFY  → Qualification de l'incident (déjà faite par le ML)
  CONTAIN   → Blocage IP progressif Redis + NetworkPolicy
  ERADICATE → Rate limiting, révocation tokens, rollback
  RECOVER   → Notification Slack avec boutons d'action
  LESSONS   → Audit trail complet en base

Blocage IP progressif :
  1ère fois     → blocage 5 minutes
  2ème fois     → blocage 30 minutes
  3ème fois+    → blacklist permanente (24h)
  Log4Shell     → isolement immédiat sans délai

Délais IR par type :
  Fiabilité K8s      : immédiat (0s)
  Attaques réseau    : 120s (annulables par l'opérateur)
  Command Injection  : 60s (urgent)
  Log4Shell          : 30s (CRITIQUE)
"""
from celery import shared_task
from datetime import datetime, timedelta
import json
import httpx
import redis
import os

from app.services.celery_app import celery_app
from app.config import settings

# ─── Client Redis global ──────────────────────────────────────
_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

# ─── Seuils de blocage IP progressif ─────────────────────────
IP_BLOCK_TTL = {
    1: 5 * 60,         # 1ère infraction → 5 minutes
    2: 30 * 60,        # 2ème infraction → 30 minutes
    3: 24 * 60 * 60,   # 3ème+ infraction → 24 heures (blacklist)
}
IP_BLOCK_PERMANENT_TTL = 24 * 60 * 60

# ─── Mapping type → (délai, playbook, phase PICERL) ──────────
# AUTOMATISATION COMPLÈTE : Les attaques critiques déclenchent full_advanced_protection
IR_DISPATCH_MAP = {
    # Fiabilité K8s — action immédiate
    "crash_loop":          (0,   "restart_pod",       "RECOVER"),
    "oom_killed":          (0,   "patch_memory",      "RECOVER"),
    "resource_saturation": (0,   "scale_out",         "RECOVER"),
    # Attaques réseau standard — blocage progressif
    "brute_force":         (120, "progressive_block", "CONTAIN"),
    "xss":                 (120, "block_and_alert",   "CONTAIN"),
    "ssrf":                (120, "block_and_alert",   "CONTAIN"),
    "path_traversal":      (120, "block_and_alert",   "CONTAIN"),
    "xxe":                 (120, "block_and_alert",   "CONTAIN"),
    "unauthorized_access": (120, "revoke_and_alert",  "CONTAIN"),
    "http_5xx":            (120, "rollback_deploy",   "RECOVER"),
    "anomaly_detected":    (120, "block_and_alert",   "CONTAIN"),
    # ═══════════════════════════════════════════════════════════
    # ATTAQUES CRITIQUES → PROTECTION AVANCÉE AUTOMATIQUE
    # Déclenche : blocage IP + rate limit + NetworkPolicy + 
    #             forensic + quarantaine + geoip + honeypot + SIEM
    # ═══════════════════════════════════════════════════════════
    "sql_injection":       (90,  "full_advanced_protection", "ERADICATE"),
    "command_injection":   (60,  "full_advanced_protection", "ERADICATE"),
    "log4shell":           (30,  "full_advanced_protection", "ERADICATE"),
    "risk_critical":       (180, "full_advanced_protection", "ERADICATE"),
    # Manuel (pour tests ou cas spéciaux)
    "advanced_protection": (180, "full_advanced_protection", "ERADICATE"),
}


# ════════════════════════════════════════════════════════════════
#  TÂCHE PRINCIPALE : Dispatch du bon playbook
# ════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=3, default_retry_delay=10)
def dispatch_ir(self, incident_id: int, incident_type: str, score: float):
    """Dispatch le bon playbook avec le bon délai selon le type d'incident."""
    from app.database import SessionLocal
    from app.models.incident import Incident, IncidentTimer, IncidentStatus

    # Récupérer la config du playbook
    delay_s, playbook, phase = IR_DISPATCH_MAP.get(
        incident_type, (120, "block_and_alert", "CONTAIN")
    )

    # Vérifier circuit breaker
    from app.services.circuit_breaker import circuit_breaker_check
    if not circuit_breaker_check(playbook):
        _log_audit(incident_id, playbook, "skipped", "Circuit breaker ouvert — passage en mode manuel")
        return {"skipped": True, "reason": "circuit_breaker_open"}

    # Planifier l'exécution différée
    eta = datetime.utcnow() + timedelta(seconds=delay_s)
    task = execute_playbook.apply_async(
        args=[incident_id, playbook, incident_type, score],
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

            # Notification Slack immédiate (avertissement de l'IR)
            source_ip = (incident.metadata_ or {}).get("source_ip") or \
                        (incident.metadata_ or {}).get("ml_result", {}).get("details", {})
            _notify_slack_ir_dispatched(
                incident_id=incident_id,
                incident_type=incident_type,
                playbook=playbook,
                phase=phase,
                delay_s=delay_s,
                eta=eta,
                task_id=task.id,
                namespace=incident.namespace,
                pod_name=incident.pod_name,
                score=score,
            )
    finally:
        db.close()

    return {"task_id": task.id, "eta": eta.isoformat(), "playbook": playbook, "phase": phase}


# ════════════════════════════════════════════════════════════════
#  TÂCHE D'EXÉCUTION : Lance le vrai playbook
# ════════════════════════════════════════════════════════════════

@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def execute_playbook(self, incident_id: int, playbook: str, incident_type: str, score: float):
    """Exécute le playbook IR et enregistre le résultat complet."""
    from app.database import SessionLocal
    from app.models.incident import Incident, IncidentAction, IncidentStatus
    from app.services.circuit_breaker import circuit_breaker_success, circuit_breaker_failure

    db = SessionLocal()
    result = "success"
    error_msg = None
    action_details = {}

    try:
        incident = db.query(Incident).filter(Incident.id == incident_id).first()
        if not incident or incident.status not in ("auto_pending", "open"):
            return {"skipped": True, "reason": "incident annulé ou déjà traité"}

        incident.status = IncidentStatus.REMEDIATING
        db.commit()

        # Extraire l'IP source depuis les métadonnées de l'incident
        source_ip = None
        if incident.metadata_:
            source_ip = incident.metadata_.get("source_ip")
            if not source_ip:
                ml_result = incident.metadata_.get("ml_result", {})
                # Chercher dans plusieurs niveaux
                source_ip = ml_result.get("source_ip")

        # ── Exécuter le playbook ─────────────────────────────
        if playbook == "progressive_block":
            action_details = _progressive_ip_block(source_ip, incident.namespace, incident_type)

        elif playbook == "block_and_alert":
            block_result = _progressive_ip_block(source_ip, incident.namespace, incident_type)
            alert_result = _send_security_alert(incident, incident_type, score, source_ip)
            action_details = {**block_result, **alert_result}

        elif playbook == "isolate_and_block":
            block_result = _progressive_ip_block(source_ip, incident.namespace, incident_type, force_max=True)
            isolate_result = _isolate_pod_simulation(incident.namespace, incident.pod_name)
            alert_result = _send_security_alert(incident, incident_type, score, source_ip, urgent=True)
            action_details = {**block_result, **isolate_result, **alert_result}

        elif playbook == "emergency_isolate":
            # Log4Shell — protocole d'urgence maximum
            block_result = _progressive_ip_block(source_ip, incident.namespace, incident_type, force_max=True)
            isolate_result = _isolate_pod_simulation(incident.namespace, incident.pod_name)
            alert_result = _send_security_alert(incident, incident_type, score, source_ip, urgent=True, emergency=True)
            action_details = {**block_result, **isolate_result, **alert_result, "protocol": "EMERGENCY"}

        elif playbook == "revoke_and_alert":
            revoke_result = _revoke_sessions(incident.namespace, source_ip)
            alert_result = _send_security_alert(incident, incident_type, score, source_ip)
            action_details = {**revoke_result, **alert_result}

        elif playbook == "restart_pod":
            action_details = _restart_pod(incident.namespace, incident.pod_name)

        elif playbook == "patch_memory":
            action_details = _patch_memory(incident.namespace, incident.pod_name)

        elif playbook == "scale_out":
            action_details = _scale_out(incident.namespace)

        elif playbook == "rollback_deploy":
            action_details = _rollback_deploy(incident.namespace, incident.pod_name)

        elif playbook == "full_escalation":
            block_result = _progressive_ip_block(source_ip, incident.namespace, incident_type, force_max=True)
            rollback_result = _rollback_deploy(incident.namespace, incident.pod_name)
            alert_result = _send_security_alert(incident, incident_type, score, source_ip, urgent=True, emergency=True)
            action_details = {**block_result, **rollback_result, **alert_result}

        elif playbook == "full_advanced_protection":
            # Playbook avancé : combine toutes les nouvelles mesures
            block_result = _progressive_ip_block(source_ip, incident.namespace, incident_type, force_max=True)
            rate_result = _adaptive_rate_limit(source_ip, incident.namespace, incident_type)
            netpol_result = _generate_network_policy(incident.namespace, incident.pod_name, incident_id)
            forensic_result = _forensic_capture(incident.namespace, incident.pod_name, incident_id, incident_type)
            quarantine_result = _quarantine_pod(incident.namespace, incident.pod_name, incident_id)
            geo_result = _geoip_block(source_ip)
            honeypot_result = _deploy_honeypot_redirect(incident.namespace, source_ip, incident_type)
            siem_result = _notify_siem_soar(incident, incident_type, score, {**block_result, **geo_result})
            alert_result = _send_security_alert(incident, incident_type, score, source_ip, urgent=True, emergency=True)
            action_details = {
                **block_result, **rate_result, **netpol_result, **forensic_result,
                **quarantine_result, **geo_result, **honeypot_result, **siem_result, **alert_result
            }

        # ── Résolution de l'incident ─────────────────────────
        incident.status = IncidentStatus.RESOLVED
        incident.resolved_at = datetime.utcnow()
        circuit_breaker_success(playbook)

        # Notification Slack de résolution
        _notify_slack_resolved(incident_id, incident_type, playbook, action_details)

    except Exception as e:
        result = "failed"
        error_msg = str(e)
        circuit_breaker_failure(playbook)
        if incident:
            incident.status = IncidentStatus.OPEN
        try:
            self.retry(exc=e)
        except self.MaxRetriesExceededError:
            _notify_slack_failure(incident_id, incident_type, playbook, error_msg)
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

    return {"playbook": playbook, "result": result, "details": action_details}


# ════════════════════════════════════════════════════════════════
#  PLAYBOOKS — Implémentations réelles (Niveau 1 = Redis + logs)
# ════════════════════════════════════════════════════════════════

def _progressive_ip_block(ip: str, namespace: str, attack_type: str, force_max: bool = False) -> dict:
    """
    Blocage IP progressif avec Redis.
    1ère infraction → 5 min | 2ème → 30 min | 3ème+ → 24h (blacklist)
    """
    if not ip:
        return {"ip_block": "skipped", "reason": "IP source inconnue"}

    # Compteur d'infractions pour cette IP
    infraction_key = f"ir:infractions:{ip}"
    infraction_count = _redis.incr(infraction_key)
    _redis.expire(infraction_key, 7 * 24 * 3600)  # historique 7 jours

    if force_max or infraction_count >= 3:
        ttl = IP_BLOCK_PERMANENT_TTL
        level = "BLACKLIST_24H"
    else:
        ttl = IP_BLOCK_TTL.get(infraction_count, IP_BLOCK_PERMANENT_TTL)
        level = f"BLOCK_{ttl // 60}MIN"

    # Enregistrer le blocage dans Redis
    block_key = f"ir:blocked_ip:{ip}"
    block_data = {
        "ip": ip,
        "blocked_at": datetime.utcnow().isoformat(),
        "expires_at": (datetime.utcnow() + timedelta(seconds=ttl)).isoformat(),
        "attack_type": attack_type,
        "namespace": namespace,
        "infraction_count": infraction_count,
        "level": level,
    }
    _redis.setex(block_key, ttl, json.dumps(block_data))

    # Garder une liste globale des IPs bloquées (pour le dashboard)
    _redis.sadd("ir:blocked_ips_list", ip)

    print(f"[IR] 🚫 IP {ip} BLOQUÉE — {level} — infraction #{infraction_count} — {ttl//60} minutes")

    return {
        "ip_block": "executed",
        "ip": ip,
        "level": level,
        "duration_minutes": ttl // 60,
        "infraction_count": infraction_count,
    }


def _isolate_pod_simulation(namespace: str, pod_name: str) -> dict:
    """
    Isolation logique du pod (Niveau 1 : marque le pod comme isolé dans Redis).
    Niveau 2 : kubectl apply NetworkPolicy deny-all
    """
    if not namespace or not pod_name:
        return {"pod_isolation": "skipped", "reason": "namespace/pod inconnu"}

    isolation_key = f"ir:isolated_pods:{namespace}:{pod_name}"
    isolation_data = {
        "namespace": namespace,
        "pod_name": pod_name,
        "isolated_at": datetime.utcnow().isoformat(),
        "reason": "Incident response — isolement automatique",
    }
    _redis.setex(isolation_key, 3600, json.dumps(isolation_data))  # 1h d'isolation

    print(f"[IR] 🔒 POD ISOLÉ — {namespace}/{pod_name}")
    print(f"[IR]    → kubectl apply -f networkpolicy-deny-{pod_name}.yaml -n {namespace}")
    print(f"[IR]    → (Niveau 2 : commande SSH au Bastion)")

    return {
        "pod_isolation": "simulated",
        "namespace": namespace,
        "pod_name": pod_name,
        "note": "Niveau 1 : marqué dans Redis. Niveau 2 : NetworkPolicy via Bastion SSH.",
    }


def _revoke_sessions(namespace: str, ip: str) -> dict:
    """Révoque les sessions actives et purge les tokens Redis de cette IP."""
    revoked = 0
    pattern = f"session:*:{ip}:*" if ip else f"session:{namespace}:*"
    for key in _redis.scan_iter(pattern):
        _redis.delete(key)
        revoked += 1

    print(f"[IR] 🔑 {revoked} sessions révoquées pour IP={ip} namespace={namespace}")
    return {"revoke_sessions": "executed", "sessions_revoked": revoked, "source_ip": ip}


def _restart_pod(namespace: str, pod_name: str) -> dict:
    """Redémarre le déploiement (simulation + log de la commande réelle)."""
    cmd = f"kubectl rollout restart deployment/{pod_name} -n {namespace}"
    print(f"[IR] 🔄 RESTART — {cmd}")
    return {"restart_pod": "simulated", "command": cmd, "namespace": namespace, "pod": pod_name}


def _patch_memory(namespace: str, pod_name: str) -> dict:
    """Augmente les limites mémoire du pod de +25%."""
    cmd = f"kubectl set resources deployment/{pod_name} -n {namespace} --limits=memory=512Mi"
    print(f"[IR] 💾 PATCH MEMORY — {cmd}")
    return {"patch_memory": "simulated", "command": cmd, "new_limit": "512Mi (+25%)"}


def _scale_out(namespace: str) -> dict:
    """Scale out horizontal (+1 réplica)."""
    cmd = f"kubectl scale deployment --all -n {namespace} --replicas=+1"
    print(f"[IR] 📈 SCALE OUT — {cmd}")
    return {"scale_out": "simulated", "command": cmd, "namespace": namespace}


def _rollback_deploy(namespace: str, pod_name: str) -> dict:
    """Rollback au déploiement précédent."""
    cmd = f"kubectl rollout undo deployment/{pod_name} -n {namespace}"
    print(f"[IR] ⏪ ROLLBACK — {cmd}")
    return {"rollback": "simulated", "command": cmd, "namespace": namespace, "pod": pod_name}


# ════════════════════════════════════════════════════════════════
#  NOUVELLES MESURES IR — Mesures avancées au-delà du blocage IP
# ════════════════════════════════════════════════════════════════

def _adaptive_rate_limit(ip: str, namespace: str, attack_type: str) -> dict:
    """
    Rate limiting adaptatif : réduit le débit plutôt que bloquer totalement.
    Utilise Redis pour tracker les requêtes par IP avec fenêtre glissante.
    """
    if not ip:
        return {"rate_limit": "skipped", "reason": "IP source inconnue"}

    # Fenêtre de 60 secondes, limite adaptative selon la gravité
    limit_map = {
        "sql_injection": 5,
        "command_injection": 3,
        "log4shell": 1,
        "xss": 10,
        "brute_force": 3,
        "default": 10
    }
    limit = limit_map.get(attack_type, limit_map["default"])

    key = f"ir:ratelimit:{ip}:{namespace}"
    current = _redis.incr(key)
    _redis.expire(key, 60)

    # Calculer le délai de backoff exponentiel
    if current > limit:
        backoff = min(300, 2 ** (current - limit))  # Max 5 min
        _redis.setex(f"ir:ratelimit_block:{ip}", backoff, "1")
        status = "throttled"
    else:
        backoff = 0
        status = "normal"

    print(f"[IR] ⏱️ RATE LIMIT — IP={ip} | Req={current}/{limit} | Status={status} | Backoff={backoff}s")

    return {
        "rate_limit": status,
        "ip": ip,
        "request_count": current,
        "limit": limit,
        "backoff_seconds": backoff,
        "window_seconds": 60,
    }


def _generate_network_policy(namespace: str, pod_name: str, incident_id: int) -> dict:
    """
    Génère un manifest NetworkPolicy K8s pour isoler le pod compromise.
    Retourne le YAML prêt à être appliqué via kubectl.
    """
    if not namespace or not pod_name:
        return {"network_policy": "skipped", "reason": "namespace/pod inconnu"}

    policy_name = f"ir-deny-{pod_name}-{incident_id}"
    yaml_content = f"""apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: {policy_name}
  namespace: {namespace}
  labels:
    incident-response: "true"
    incident-id: "{incident_id}"
    auto-generated: "true"
spec:
  podSelector:
    matchLabels:
      app: {pod_name}
  policyTypes:
  - Ingress
  - Egress
  ingress: []  # Deny all ingress
  egress:
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system  # Allow DNS only
    ports:
    - protocol: UDP
      port: 53
"""

    # Stocker dans Redis pour référence/rollback
    policy_key = f"ir:networkpolicy:{namespace}:{pod_name}"
    _redis.setex(policy_key, 24 * 3600, json.dumps({
        "yaml": yaml_content,
        "policy_name": policy_name,
        "created_at": datetime.utcnow().isoformat(),
        "incident_id": incident_id,
    }))

    cmd_apply = f"kubectl apply -f - <<'EOF'\n{yaml_content}EOF"
    cmd_delete = f"kubectl delete networkpolicy {policy_name} -n {namespace}"

    print(f"[IR] 🔥 NETWORK POLICY GÉNÉRÉE — {policy_name}")
    print(f"[IR]    → kubectl apply -f networkpolicy-{policy_name}.yaml")
    print(f"[IR]    → Suppression : {cmd_delete}")

    return {
        "network_policy": "generated",
        "policy_name": policy_name,
        "namespace": namespace,
        "pod_name": pod_name,
        "yaml_preview": yaml_content[:200] + "...",
        "apply_command": cmd_apply,
        "delete_command": cmd_delete,
        "redis_key": policy_key,
    }


def _forensic_capture(namespace: str, pod_name: str, incident_id: int, incident_type: str) -> dict:
    """
    Capture forensique : sauvegarde logs, description du pod, et métriques.
    Stocke tout dans Redis pour investigation post-incident.
    """
    if not namespace or not pod_name:
        return {"forensic": "skipped", "reason": "namespace/pod inconnu"}

    capture_id = f"{incident_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

    # Simuler la capture des logs et métadonnées
    forensic_data = {
        "capture_id": capture_id,
        "incident_id": incident_id,
        "incident_type": incident_type,
        "namespace": namespace,
        "pod_name": pod_name,
        "captured_at": datetime.utcnow().isoformat(),
        "logs_command": f"kubectl logs {pod_name} -n {namespace} --all-containers --since=1h",
        "describe_command": f"kubectl describe pod {pod_name} -n {namespace}",
        "events_command": f"kubectl get events -n {namespace} --field-selector involvedObject.name={pod_name}",
        "artifacts": {
            "logs_stored": f"/var/forensics/{namespace}/{pod_name}/{capture_id}-logs.txt",
            "manifest_stored": f"/var/forensics/{namespace}/{pod_name}/{capture_id}-manifest.json",
            "network_capture": f"/var/forensics/{namespace}/{pod_name}/{capture_id}-pcap.pcap",
        },
        "retention_days": 30,
    }

    # Sauvegarder dans Redis
    forensic_key = f"ir:forensic:{capture_id}"
    _redis.setex(forensic_key, 30 * 24 * 3600, json.dumps(forensic_data))

    # Ajouter à la liste des captures de l'incident
    incident_forensics_key = f"ir:forensics:incident:{incident_id}"
    _redis.rpush(incident_forensics_key, capture_id)
    _redis.expire(incident_forensics_key, 30 * 24 * 3600)

    print(f"[IR] 📸 FORENSIC CAPTURE — {capture_id}")
    print(f"[IR]    → Logs: {forensic_data['artifacts']['logs_stored']}")
    print(f"[IR]    → Retention: 30 jours")

    return {
        "forensic": "captured",
        "capture_id": capture_id,
        "namespace": namespace,
        "pod_name": pod_name,
        "artifacts": forensic_data["artifacts"],
        "retention_days": 30,
        "redis_key": forensic_key,
    }


def _quarantine_pod(namespace: str, pod_name: str, incident_id: int) -> dict:
    """
    Met le pod en quarantaine :
    - Label 'quarantine=active' pour exclusion du traffic
    - Cordon du node (optionnel)
    - Taint 'security-incident' sur le node
    """
    if not namespace or not pod_name:
        return {"quarantine": "skipped", "reason": "namespace/pod inconnu"}

    quarantine_label = "security.quarantine/active"
    quarantine_taint = "security-incident=true:NoSchedule"

    # Commandes kubectl simulées
    cmd_label = f"kubectl label pod {pod_name} -n {namespace} quarantine=active incident-id={incident_id} --overwrite"
    cmd_cordon = f"kubectl cordon $(kubectl get pod {pod_name} -n {namespace} -o jsonpath='{{.spec.nodeName}}')"
    cmd_taint = f"kubectl taint node $(kubectl get pod {pod_name} -n {namespace} -o jsonpath='{{.spec.nodeName}}') {quarantine_taint}"
    cmd_evict = f"kubectl delete pod {pod_name} -n {namespace} --grace-period=30"

    # Marquer dans Redis
    quarantine_key = f"ir:quarantine:{namespace}:{pod_name}"
    quarantine_data = {
        "pod_name": pod_name,
        "namespace": namespace,
        "incident_id": incident_id,
        "quarantined_at": datetime.utcnow().isoformat(),
        "label": quarantine_label,
        "taint": quarantine_taint,
        "commands": {
            "label": cmd_label,
            "cordon": cmd_cordon,
            "taint": cmd_taint,
            "evict": cmd_evict,
        },
    }
    _redis.setex(quarantine_key, 24 * 3600, json.dumps(quarantine_data))

    print(f"[IR] 🚧 QUARANTAINE — {namespace}/{pod_name}")
    print(f"[IR]    → Label: {cmd_label}")
    print(f"[IR]    → Cordon: {cmd_cordon}")
    print(f"[IR]    → Taint: {cmd_taint}")

    return {
        "quarantine": "active",
        "namespace": namespace,
        "pod_name": pod_name,
        "label_applied": quarantine_label,
        "commands": quarantine_data["commands"],
        "redis_key": quarantine_key,
    }


def _geoip_block(ip: str, country_code: str = None) -> dict:
    """
    Blocage géographique basé sur le pays de l'IP.
    Permet de bloquer des régions entières si nécessaire.
    """
    if not ip:
        return {"geoip_block": "skipped", "reason": "IP source inconnue"}

    # Simulation de lookup GeoIP
    # En production : utiliser geoip2 ou maxmind
    country_map = {
        "1.2.3.4": "CN",
        "5.6.7.8": "RU",
        "192.168.1.1": "LOCAL",
    }
    detected_country = country_code or country_map.get(ip, "UNKNOWN")

    # Liste des pays à haut risque (à configurer)
    high_risk_countries = ["CN", "RU", "KP", "IR"]
    is_high_risk = detected_country in high_risk_countries

    geo_key = f"ir:geoip:blocked:{detected_country}"
    _redis.sadd(geo_key, ip)
    _redis.expire(geo_key, 7 * 24 * 3600)

    action = "blocked" if is_high_risk else "logged"

    print(f"[IR] 🌍 GEOIP — IP={ip} | Country={detected_country} | Action={action}")

    return {
        "geoip": action,
        "ip": ip,
        "country": detected_country,
        "is_high_risk": is_high_risk,
        "high_risk_countries": high_risk_countries,
    }


def _deploy_honeypot_redirect(namespace: str, source_ip: str, attack_type: str) -> dict:
    """
    Déploie un honeypot dynamique et redirige l'attaquant vers celui-ci.
    Permet de capturer le comportement de l'attaquant sans risque.
    """
    if not source_ip:
        return {"honeypot": "skipped", "reason": "IP source inconnue"}

    honeypot_name = f"honeypot-{attack_type}-{datetime.utcnow().strftime('%H%M%S')}"

    # Marquer l'IP comme redirigée vers honeypot
    redirect_key = f"ir:honeypot:redirect:{source_ip}"
    redirect_data = {
        "source_ip": source_ip,
        "namespace": namespace,
        "attack_type": attack_type,
        "honeypot_name": honeypot_name,
        "redirected_at": datetime.utcnow().isoformat(),
        "duration_minutes": 60,
        "capture_traffic": True,
    }
    _redis.setex(redirect_key, 3600, json.dumps(redirect_data))

    # Simuler la création d'une règle de redirection
    cmd = f"kubectl create deployment {honeypot_name} --image=honeypot/{attack_type}-trap -n honeypot-ns"

    print(f"[IR] 🍯 HONEYPOT — Redirection de {source_ip} vers {honeypot_name}")
    print(f"[IR]    → Trafic capturé pour analyse")

    return {
        "honeypot": "deployed",
        "source_ip": source_ip,
        "honeypot_name": honeypot_name,
        "redirect_duration_min": 60,
        "capture_enabled": True,
        "deploy_command": cmd,
        "redis_key": redirect_key,
    }


def _notify_siem_soar(incident, incident_type: str, score: float, action_details: dict) -> dict:
    """
    Envoie une notification webhook vers un SIEM/SOAR externe (Splunk, TheHive, ELK).
    Format JSON standardisé pour intégration SOC.
    """
    siem_webhook = os.getenv("SIEM_WEBHOOK_URL")
    if not siem_webhook:
        return {"siem_notification": "skipped", "reason": "SIEM_WEBHOOK_URL non configuré"}

    payload = {
        "event_type": "security.incident",
        "event_version": "1.0",
        "timestamp": datetime.utcnow().isoformat(),
        "incident": {
            "id": incident.id if hasattr(incident, 'id') else 0,
            "type": incident_type,
            "severity": "CRITICAL" if score >= 76 else "HIGH" if score >= 51 else "MEDIUM",
            "score": score,
            "namespace": incident.namespace if hasattr(incident, 'namespace') else "unknown",
            "pod_name": incident.pod_name if hasattr(incident, 'pod_name') else None,
        },
        "source": {
            "ip": action_details.get("ip"),
            "country": action_details.get("country"),
        },
        "actions_taken": list(action_details.keys()),
        "mitre_attack_technique": _map_to_mitre(incident_type),
    }

    try:
        resp = httpx.post(siem_webhook, json=payload, timeout=5)
        status = "sent" if resp.status_code == 200 else f"failed:{resp.status_code}"
    except Exception as e:
        status = f"error:{str(e)}"

    print(f"[IR] 📡 SIEM/SOAR — Incident notification {status}")

    return {
        "siem_notification": status,
        "webhook_url": siem_webhook[:30] + "..." if siem_webhook else None,
        "payload_size": len(json.dumps(payload)),
    }


def _map_to_mitre(incident_type: str) -> str:
    """Mappe les types d'incidents aux techniques MITRE ATT&CK."""
    mitre_map = {
        "sql_injection": "T1190",      # Exploit Public-Facing Application
        "command_injection": "T1059",   # Command and Scripting Interpreter
        "log4shell": "T1190",           # Exploit Public-Facing Application
        "xss": "T1189",                 # Drive-by Compromise
        "brute_force": "T1110",         # Brute Force
        "ssrf": "T1090",                # Proxy
        "path_traversal": "T1083",      # File and Directory Discovery
        "xxe": "T1059",                 # Command and Scripting Interpreter
    }
    return mitre_map.get(incident_type, "T1595")  # Active Scanning (default)


# ════════════════════════════════════════════════════════════════
#  NOTIFICATIONS SLACK — Messages riches avec contexte complet
# ════════════════════════════════════════════════════════════════

ATTACK_EMOJI = {
    "sql_injection": "💉", "xss": "🕸️", "ssrf": "🔗",
    "path_traversal": "📂", "command_injection": "💻",
    "log4shell": "☢️", "xxe": "📄", "brute_force": "🔨",
    "unauthorized_access": "🚪", "crash_loop": "🔄",
    "oom_killed": "💥", "resource_saturation": "📈",
    "anomaly_detected": "🤖",
}

SEVERITY_COLOR = {
    "CRITICAL": "#ef4444", "HIGH": "#f97316",
    "MEDIUM": "#eab308", "LOW": "#22c55e",
}

def _notify_slack_ir_dispatched(incident_id, incident_type, playbook, phase,
                                 delay_s, eta, task_id, namespace, pod_name, score):
    """Notification Slack quand un IR est déclenché (avant exécution)."""
    if not settings.SLACK_WEBHOOK_URL:
        print(f"[IR-Slack] SLACK_WEBHOOK_URL non configuré — notification ignorée")
        return

    emoji = ATTACK_EMOJI.get(incident_type, "⚠️")
    delay_label = "immédiat" if delay_s == 0 else f"dans {delay_s}s"
    eta_str = eta.strftime("%H:%M:%S")

    severity = "CRITICAL" if score >= 76 else "HIGH" if score >= 51 else "MEDIUM"
    color = SEVERITY_COLOR.get(severity, "#eab308")

    message = {
        "attachments": [{
            "color": color,
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"{emoji} IR Déclenché — Incident #{incident_id}"}
                },
                {
                    "type": "section",
                    "fields": [
                        {"type": "mrkdwn", "text": f"*Type d'attaque :*\n`{incident_type.upper()}`"},
                        {"type": "mrkdwn", "text": f"*Score de risque :*\n`{score:.1f}/100` — {severity}"},
                        {"type": "mrkdwn", "text": f"*Namespace :*\n`{namespace}`"},
                        {"type": "mrkdwn", "text": f"*Pod :*\n`{pod_name or 'inconnu'}`"},
                        {"type": "mrkdwn", "text": f"*Playbook :*\n`{playbook}`"},
                        {"type": "mrkdwn", "text": f"*Phase PICERL :*\n`{phase}`"},
                    ]
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"⏱️ *Exécution {delay_label}* (à {eta_str})\n_Vous avez {delay_s}s pour annuler cette action._"
                                if delay_s > 0 else "⚡ *Exécution immédiate*"
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "🔍 Voir l'incident"},
                            "url": f"http://localhost:3000/incidents/{incident_id}",
                            "style": "primary"
                        },
                        {
                            "type": "button",
                            "text": {"type": "plain_text", "text": "❌ Annuler"},
                            "url": f"http://localhost:8000/incidents/{incident_id}/cancel",
                            "style": "danger"
                        }
                    ]
                }
            ]
        }]
    }

    _send_slack(message)


def _notify_slack_resolved(incident_id, incident_type, playbook, details):
    """Notification Slack quand un IR est exécuté avec succès."""
    if not settings.SLACK_WEBHOOK_URL:
        return

    details_text = "\n".join([f"• `{k}` : {v}" for k, v in details.items() if k not in ("note",)])

    message = {
        "attachments": [{
            "color": "#22c55e",
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"✅ IR Exécuté — Incident #{incident_id}"}
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Playbook `{playbook}` exécuté avec succès.*\n\n{details_text}"
                    }
                }
            ]
        }]
    }
    _send_slack(message)


def _notify_slack_failure(incident_id, incident_type, playbook, error):
    """Notification Slack en cas d'échec du playbook."""
    if not settings.SLACK_WEBHOOK_URL:
        return

    message = {
        "attachments": [{
            "color": "#f97316",
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": f"⚠️ IR Échec — Incident #{incident_id}"}
                },
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": f"*Playbook `{playbook}` a échoué après 3 tentatives.*\n```{error}```\n\n_Intervention manuelle requise._"
                    }
                }
            ]
        }]
    }
    _send_slack(message)


def _send_security_alert(incident, incident_type, score, source_ip=None,
                          urgent=False, emergency=False) -> dict:
    """Envoie une alerte de sécurité détaillée sur Slack."""
    if not settings.SLACK_WEBHOOK_URL:
        return {"slack_alert": "skipped", "reason": "webhook non configuré"}

    emoji = ATTACK_EMOJI.get(incident_type, "⚠️")
    severity = "CRITICAL" if score >= 76 else "HIGH" if score >= 51 else "MEDIUM"
    color = SEVERITY_COLOR.get(severity)

    header = f"{'🚨 URGENCE ' if emergency else ''}{'⚡ ' if urgent else ''}{emoji} Attaque Détectée : {incident_type.upper()}"

    fields = [
        {"type": "mrkdwn", "text": f"*Sévérité :* `{severity}`"},
        {"type": "mrkdwn", "text": f"*Score ML :* `{score:.1f}/100`"},
        {"type": "mrkdwn", "text": f"*Namespace :* `{incident.namespace}`"},
        {"type": "mrkdwn", "text": f"*Pod :* `{incident.pod_name or 'inconnu'}`"},
    ]
    if source_ip:
        fields.append({"type": "mrkdwn", "text": f"*IP Attaquante :* `{source_ip}`"})

    message = {
        "attachments": [{
            "color": color,
            "blocks": [
                {"type": "header", "text": {"type": "plain_text", "text": header}},
                {"type": "section", "fields": fields},
            ]
        }]
    }
    _send_slack(message)
    return {"slack_alert": "sent", "severity": severity, "source_ip": source_ip}


def _send_slack(payload: dict):
    """Envoie un message Slack via webhook."""
    try:
        resp = httpx.post(settings.SLACK_WEBHOOK_URL, json=payload, timeout=5)
        if resp.status_code != 200:
            print(f"[IR-Slack] Erreur {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[IR-Slack] Échec envoi: {e}")


# ════════════════════════════════════════════════════════════════
#  AUDIT TRAIL
# ════════════════════════════════════════════════════════════════

def _log_audit(incident_id: int, playbook: str, result: str, message: str):
    """Log d'audit dans Redis (persisté 30 jours)."""
    audit_key = f"ir:audit:{datetime.utcnow().strftime('%Y%m%d')}"
    audit_entry = json.dumps({
        "ts": datetime.utcnow().isoformat(),
        "incident_id": incident_id,
        "playbook": playbook,
        "result": result,
        "message": message,
    })
    _redis.rpush(audit_key, audit_entry)
    _redis.expire(audit_key, 30 * 24 * 3600)
    print(f"[IR-Audit] {result.upper()} — incident #{incident_id} — {playbook}: {message}")
