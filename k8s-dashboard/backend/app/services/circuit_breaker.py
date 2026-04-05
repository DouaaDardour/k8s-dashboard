"""
Circuit breaker : après 3 échecs consécutifs → mode manuel automatique.
Stocké en Redis pour persistance cross-workers.
"""
import redis
import json
from datetime import datetime, timedelta
from app.config import settings

_redis = redis.from_url(settings.REDIS_URL, decode_responses=True)

FAIL_THRESHOLD = settings.CIRCUIT_BREAKER_FAIL_THRESHOLD
RESET_TIMEOUT = settings.CIRCUIT_BREAKER_RESET_TIMEOUT


def _key(service: str) -> str:
    return f"circuit_breaker:{service}"


def circuit_breaker_check(service: str) -> bool:
    """Retourne True si l'action peut s'exécuter, False si circuit ouvert."""
    data = _redis.get(_key(service))
    if not data:
        return True

    state = json.loads(data)
    if state["state"] == "open":
        opened_at = datetime.fromisoformat(state["opened_at"])
        if (datetime.utcnow() - opened_at).total_seconds() > RESET_TIMEOUT:
            # Passage en half_open
            state["state"] = "half_open"
            _redis.set(_key(service), json.dumps(state), ex=RESET_TIMEOUT * 2)
            return True
        return False
    return True


def circuit_breaker_success(service: str):
    """Réinitialise le circuit breaker après un succès."""
    _redis.delete(_key(service))


def circuit_breaker_failure(service: str):
    """Enregistre un échec. Ouvre le circuit après FAIL_THRESHOLD."""
    data = _redis.get(_key(service))
    state = json.loads(data) if data else {"state": "closed", "fail_count": 0}

    state["fail_count"] = state.get("fail_count", 0) + 1

    if state["fail_count"] >= FAIL_THRESHOLD:
        state["state"] = "open"
        state["opened_at"] = datetime.utcnow().isoformat()
        print(f"[CircuitBreaker] OUVERT pour {service} après {state['fail_count']} échecs")

    _redis.set(_key(service), json.dumps(state), ex=RESET_TIMEOUT * 2)


def get_circuit_breaker_state(service: str) -> dict:
    data = _redis.get(_key(service))
    if not data:
        return {"service": service, "state": "closed", "fail_count": 0}
    return {**json.loads(data), "service": service}
