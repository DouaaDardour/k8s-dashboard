from celery import Celery
from app.config import settings

celery_app = Celery(
    "k8s_ir",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.services.ir_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "app.services.ir_tasks.execute_playbook": {"queue": "ir"},
        "app.services.ir_tasks.dispatch_ir": {"queue": "ir"},
    },
)
