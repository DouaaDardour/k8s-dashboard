"""
Client HTTP vers le service ML (port 8001).
Utilisé en BackgroundTask depuis l'API d'ingestion.
"""
import httpx
from app.config import settings


async def score_log(log_data: dict) -> dict:
    """
    Envoie un log au service ML et retourne le score.
    En cas d'échec, retourne un score neutre (pas de crash).
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{settings.ML_SERVICE_URL}/predict",
                json=log_data,
            )
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        print(f"[ML Client] Erreur appel ML service: {e}")
        # Fallback : score neutre, pas d'incident créé
        return {
            "score": 0,
            "type": "unknown",
            "category": "reliability",
            "security_score": 0,
            "reliability_score": 0,
            "frequency_score": 0,
        }
