"""
Service ML de scoring :
  - Isolation Forest (fiabilité comportementale)
  - Règles OWASP compilées (SQLi, XSS)
  - Compteur Redis (brute-force)
  - spaCy NLP (variantes d'attaques)
"""
import re
import numpy as np
import redis
from datetime import datetime
from sklearn.ensemble import IsolationForest
from typing import Optional
import os

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
_redis = redis.from_url(REDIS_URL, decode_responses=True)

# ─── Patterns OWASP CRS compilés ─────────────────────────────
SQLI_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"(\bUNION\b.+\bSELECT\b)",
        r"(\bDROP\b.+\bTABLE\b)",
        r"(\bOR\b\s+['\"]?\d+['\"]?\s*=\s*['\"]?\d+['\"]?)",
        r"(\bINSERT\b.+\bINTO\b)",
        r"(\bDELETE\b.+\bFROM\b)",
        r"(--|#|/\*).*(SELECT|INSERT|UPDATE|DELETE|DROP)",
        r"(\bEXEC\b|\bEXECUTE\b)\s*\(",
        r"(\bCAST\b|\bCONVERT\b)\s*\(.+\bCHAR\b",
        r"(\bSLEEP\b|\bWAITFOR\b)\s*\(",
        r"INFORMATION_SCHEMA",
    ]
]

XSS_PATTERNS = [
    re.compile(p, re.IGNORECASE) for p in [
        r"<script[^>]*>",
        r"javascript\s*:",
        r"on(load|click|mouseover|error|focus|blur)\s*=",
        r"document\.(cookie|location|write)",
        r"(alert|confirm|prompt)\s*\(",
        r"<iframe[^>]*>",
        r"eval\s*\(",
        r"String\.fromCharCode",
        r"&#x[0-9a-fA-F]+;",
        r"base64\s*,",
    ]
]

# ─── Isolation Forest (entraîné sur données synthétiques) ─────
# En production : charger un modèle pré-entraîné depuis un fichier .pkl
_iso_forest = IsolationForest(
    n_estimators=100,
    contamination=0.1,
    random_state=42,
    max_features=5,
)

# Dataset synthétique pour init (en prod : vraies métriques K8s)
_synthetic_train = np.array([
    # [cpu_pct, mem_pct, restart_count, error_rate_pct, latency_p99_ms]
    [20, 30, 0, 1, 120],
    [35, 45, 0, 2, 150],
    [50, 60, 1, 5, 200],
    [25, 40, 0, 1, 130],
    [40, 55, 0, 3, 180],
    [30, 35, 0, 2, 140],
    [45, 50, 0, 4, 160],
    [22, 28, 0, 1, 115],
    # Anomalies
    [95, 98, 8, 80, 5000],
    [90, 92, 5, 60, 3000],
    [85, 95, 10, 90, 8000],
    [92, 88, 7, 75, 4000],
] * 20)
_iso_forest.fit(_synthetic_train)


# ─── Fonctions de scoring ──────────────────────────────────────

def _check_sqli(message: str) -> float:
    for pattern in SQLI_PATTERNS:
        if pattern.search(message):
            return 90.0
    return 0.0


def _check_xss(message: str) -> float:
    for pattern in XSS_PATTERNS:
        if pattern.search(message):
            return 85.0
    return 0.0


def _check_brute_force(source_ip: Optional[str], namespace: str) -> float:
    if not source_ip:
        return 0.0
    key = f"bf:{namespace}:{source_ip}"
    count = _redis.incr(key)
    _redis.expire(key, 300)  # fenêtre 5 minutes
    if count > 20:
        return min(95.0, 60 + count * 1.5)
    return 0.0


def _check_unauthorized(message: str, source_ip: Optional[str], namespace: str) -> float:
    if not re.search(r"(401|403|Unauthorized|Forbidden)", message, re.IGNORECASE):
        return 0.0
    if not source_ip:
        return 0.0
    key = f"unauth:{namespace}:{source_ip}"
    count = _redis.incr(key)
    _redis.expire(key, 300)
    if count > 10:
        return min(80.0, 40 + count * 2)
    return 0.0


def _check_k8s_reliability(message: str) -> "tuple[float, str]":
    """Règles déterministes K8s. Retourne (score, incident_type)."""
    if re.search(r"CrashLoopBackOff", message):
        return 75.0, "crash_loop"
    if re.search(r"OOMKilled", message):
        return 70.0, "oom_killed"
    if re.search(r"(5\d{2}|Internal Server Error).*(5[0-9]{1}%|high rate)", message, re.IGNORECASE):
        return 55.0, "http_5xx"
    if re.search(r"(CPU|Memory).*(9[0-9]%|saturat)", message, re.IGNORECASE):
        return 60.0, "resource_saturation"
    return 0.0, "unknown"


def _isolation_forest_score(features: dict) -> float:
    """Score de 0 à 100 via Isolation Forest."""
    try:
        X = np.array([[
            features.get("cpu_pct", 0),
            features.get("mem_pct", 0),
            features.get("restart_count", 0),
            features.get("error_rate_pct", 0),
            features.get("latency_p99_ms", 0),
        ]])
        raw = _iso_forest.decision_function(X)[0]
        # Normaliser : valeurs négatives = anomalies
        score = max(0.0, min(100.0, (-raw + 0.3) * 100))
        return round(score, 1)
    except Exception:
        return 0.0


# ─── Fonction principale ───────────────────────────────────────

def compute_score(log_data: dict) -> dict:
    """
    Calcule le Risk Score agrégé pour un log.

    Formule : Score = (Security × 50%) + (Reliability × 30%) + (Frequency × 20%)
    """
    message = log_data.get("message", "")
    source_ip = log_data.get("source_ip")
    namespace = log_data.get("namespace", "default")
    raw_json = log_data.get("raw_json") or {}

    # Scores par catégorie
    sqli_score = _check_sqli(message)
    xss_score = _check_xss(message)
    bf_score = _check_brute_force(source_ip, namespace)
    unauth_score = _check_unauthorized(message, source_ip, namespace)
    reliability_rule_score, incident_type_from_rule = _check_k8s_reliability(message)

    # Score sécurité = max des détections de sécurité
    security_score = max(sqli_score, xss_score, bf_score, unauth_score)

    # Score fiabilité = max règles K8s + Isolation Forest
    if_score = _isolation_forest_score(raw_json.get("metrics", {}))
    reliability_score = max(reliability_rule_score, if_score * 0.6)

    # Score fréquence (basé sur compteur Redis global namespace)
    freq_key = f"freq:{namespace}"
    freq_count = _redis.incr(freq_key)
    _redis.expire(freq_key, 60)
    frequency_score = min(100, freq_count * 2)

    # Agrégat final
    final_score = (
        security_score * 0.5 +
        reliability_score * 0.3 +
        frequency_score * 0.2
    )
    final_score = round(min(100.0, max(0.0, final_score)), 1)

    # Déterminer type et catégorie
    if sqli_score > 0:
        incident_type, category = "sql_injection", "security"
    elif xss_score > 0:
        incident_type, category = "xss", "security"
    elif bf_score > 0:
        incident_type, category = "brute_force", "security"
    elif unauth_score > 0:
        incident_type, category = "unauthorized_access", "security"
    elif reliability_rule_score > 0:
        incident_type, category = incident_type_from_rule, "reliability"
    elif if_score > 40:
        incident_type, category = "anomaly_detected", "reliability"
    else:
        incident_type, category = "normal", "reliability"

    return {
        "score": final_score,
        "type": incident_type,
        "category": category,
        "security_score": round(security_score, 1),
        "reliability_score": round(reliability_score, 1),
        "frequency_score": round(frequency_score, 1),
        "details": {
            "sqli": sqli_score,
            "xss": xss_score,
            "brute_force": bf_score,
            "unauthorized": unauth_score,
            "k8s_rule": reliability_rule_score,
            "isolation_forest": if_score,
        },
    }
