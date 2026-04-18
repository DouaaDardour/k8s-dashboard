"""
Monitoring & Performance API
Endpoints pour le suivi des ressources système (CPU, RAM, GPU, Storage)
et la fiabilité du cluster.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
from datetime import datetime, timedelta
import psutil
import os
import json

from app.api.auth import verify_token
from app.database import get_db
from sqlalchemy.orm import Session
from app.models.incident import Incident, RiskScore

router = APIRouter()

# ════════════════════════════════════════════════════════════════
#  MODÈLES DE DONNÉES
# ════════════════════════════════════════════════════════════════

class SystemMetrics(BaseModel):
    timestamp: str
    cpu: Dict
    memory: Dict
    disk: Dict
    network: Dict
    gpu: Optional[Dict] = None

class PodMetrics(BaseModel):
    pod_name: str
    namespace: str
    cpu_percent: float
    memory_percent: float
    memory_usage_mb: int
    status: str
    restart_count: int
    age_hours: float

class ClusterHealth(BaseModel):
    status: str
    node_count: int
    pod_count: int
    ready_pods: int
    pending_pods: int
    failed_pods: int
    avg_cpu_percent: float
    avg_memory_percent: float
    incidents_24h: int
    reliability_score: float

class ReliabilityMetrics(BaseModel):
    uptime_percent: float
    mttr_minutes: float  # Mean Time To Recovery
    mtbf_hours: float    # Mean Time Between Failures
    availability_percent: float
    incidents_trend: List[Dict]


# ════════════════════════════════════════════════════════════════
#  ENDPOINTS SYSTÈME LOCAL (Docker)
# ════════════════════════════════════════════════════════════════

@router.get("/system")
def get_system_metrics(_: dict = Depends(verify_token)):
    """
    Retourne les métriques système du conteneur/backend :
    - CPU usage (%)
    - RAM usage (MB et %)
    - Disk usage (GB et %)
    - Network I/O
    - GPU (si disponible)
    """
    try:
        # CPU
        cpu_percent = psutil.cpu_percent(interval=1)
        cpu_count = psutil.cpu_count()
        cpu_freq = psutil.cpu_freq()
        
        # Memory
        mem = psutil.virtual_memory()
        
        # Disk
        disk = psutil.disk_usage('/')
        
        # Network
        net_io = psutil.net_io_counters()
        
        # GPU (si nvidia-ml-py est installé)
        gpu_info = None
        try:
            import pynvml
            pynvml.nvmlInit()
            handle = pynvml.nvmlDeviceGetHandleByIndex(0)
            gpu_util = pynvml.nvmlDeviceGetUtilizationRates(handle)
            gpu_mem = pynvml.nvmlDeviceGetMemoryInfo(handle)
            gpu_temp = pynvml.nvmlDeviceGetTemperature(handle, pynvml.NVML_TEMPERATURE_GPU)
            gpu_name = pynvml.nvmlDeviceGetName(handle)
            
            gpu_info = {
                "name": gpu_name.decode('utf-8') if isinstance(gpu_name, bytes) else gpu_name,
                "utilization_percent": gpu_util.gpu,
                "memory_used_mb": gpu_mem.used // 1024 // 1024,
                "memory_total_mb": gpu_mem.total // 1024 // 1024,
                "temperature_c": gpu_temp,
                "driver_version": pynvml.nvmlSystemGetDriverVersion().decode('utf-8') if isinstance(pynvml.nvmlSystemGetDriverVersion(), bytes) else pynvml.nvmlSystemGetDriverVersion(),
            }
        except Exception:
            gpu_info = None
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "cpu": {
                "percent": cpu_percent,
                "count": cpu_count,
                "frequency_mhz": cpu_freq.current if cpu_freq else None,
                "load_avg": os.getloadavg() if hasattr(os, 'getloadavg') else None,
            },
            "memory": {
                "total_mb": mem.total // 1024 // 1024,
                "used_mb": mem.used // 1024 // 1024,
                "available_mb": mem.available // 1024 // 1024,
                "percent": mem.percent,
                "cached_mb": getattr(mem, 'cached', 0) // 1024 // 1024,
            },
            "disk": {
                "total_gb": disk.total // 1024 // 1024 // 1024,
                "used_gb": disk.used // 1024 // 1024 // 1024,
                "free_gb": disk.free // 1024 // 1024 // 1024,
                "percent": (disk.used / disk.total) * 100,
            },
            "network": {
                "bytes_sent_mb": net_io.bytes_sent // 1024 // 1024,
                "bytes_recv_mb": net_io.bytes_recv // 1024 // 1024,
                "packets_sent": net_io.packets_sent,
                "packets_recv": net_io.packets_recv,
                "errors_in": net_io.errin,
                "errors_out": net_io.errout,
            },
            "gpu": gpu_info,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur métriques système: {str(e)}")


@router.get("/cluster/health")
def get_cluster_health(db: Session = Depends(get_db), _: dict = Depends(verify_token)):
    """
    Retourne la santé globale du cluster K8s (simulé depuis les données d'incidents)
    """
    try:
        # Compter les incidents des dernières 24h
        since_24h = datetime.utcnow() - timedelta(hours=24)
        incidents_24h = db.query(Incident).filter(Incident.detected_at >= since_24h).count()
        
        # Récupérer les derniers risk scores
        latest_scores = db.query(RiskScore).order_by(RiskScore.computed_at.desc()).limit(10).all()
        
        avg_reliability = sum([s.reliability_score for s in latest_scores]) / len(latest_scores) if latest_scores else 0
        
        # Simuler des métriques de cluster basées sur les incidents
        # (Dans un vrai scénario, ces données viendraient de Prometheus/Metrics Server)
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "status": "healthy" if incidents_24h < 5 else "degraded" if incidents_24h < 15 else "critical",
            "node_count": 3,  # Simulé
            "pod_count": 12 + incidents_24h,  # Simulé
            "ready_pods": 12,
            "pending_pods": max(0, incidents_24h - 5),
            "failed_pods": min(3, incidents_24h // 3),
            "avg_cpu_percent": 35.0 + (incidents_24h * 2),
            "avg_memory_percent": 42.0 + (incidents_24h * 1.5),
            "incidents_24h": incidents_24h,
            "reliability_score": round(100 - (incidents_24h * 5), 1),
            "namespace_breakdown": [
                {"namespace": "production", "pods": 8, "cpu_avg": 45, "memory_avg": 52},
                {"namespace": "monitoring", "pods": 3, "cpu_avg": 25, "memory_avg": 30},
                {"namespace": "ingress-nginx", "pods": 2, "cpu_avg": 15, "memory_avg": 20},
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur santé cluster: {str(e)}")


@router.get("/cluster/reliability")
def get_reliability_metrics(db: Session = Depends(get_db), _: dict = Depends(verify_token)):
    """
    Retourne les métriques de fiabilité (SLA, MTTR, MTBF)
    """
    try:
        # Derniers 7 jours
        since_7d = datetime.utcnow() - timedelta(days=7)
        incidents_7d = db.query(Incident).filter(Incident.detected_at >= since_7d).all()
        
        # Calculer MTTR (Mean Time To Recovery)
        resolved_incidents = [i for i in incidents_7d if i.status == "resolved" and i.resolved_at]
        if resolved_incidents:
            total_resolution_time = sum([
                (i.resolved_at - i.detected_at).total_seconds() / 60
                for i in resolved_incidents
            ])
            mttr = total_resolution_time / len(resolved_incidents)
        else:
            mttr = 0
        
        # Calculer MTBF (Mean Time Between Failures)
        if len(incidents_7d) > 1:
            first_incident = min(incidents_7d, key=lambda x: x.detected_at)
            last_incident = max(incidents_7d, key=lambda x: x.detected_at)
            total_time = (last_incident.detected_at - first_incident.detected_at).total_seconds() / 3600
            mtbf = total_time / (len(incidents_7d) - 1) if len(incidents_7d) > 1 else 168
        else:
            mtbf = 168  # 1 semaine par défaut
        
        # Trend des incidents par jour
        daily_incidents = {}
        for i in incidents_7d:
            day = i.detected_at.strftime("%Y-%m-%d")
            daily_incidents[day] = daily_incidents.get(day, 0) + 1
        
        incidents_trend = [
            {"date": day, "count": count}
            for day, count in sorted(daily_incidents.items())
        ]
        
        # Uptime (simulé - 99.9% moins les pénalités d'incidents)
        uptime = max(95.0, 99.9 - (len(incidents_7d) * 0.1))
        
        return {
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_percent": round(uptime, 3),
            "mttr_minutes": round(mttr, 2),
            "mtbf_hours": round(mtbf, 2),
            "availability_percent": round(uptime, 3),
            "incidents_7d": len(incidents_7d),
            "resolved_7d": len(resolved_incidents),
            "resolution_rate": round(len(resolved_incidents) / len(incidents_7d) * 100, 1) if incidents_7d else 100,
            "incidents_trend": incidents_trend,
            "sla_target": 99.9,
            "sla_current": round(uptime, 3),
            "sla_status": "ok" if uptime >= 99.9 else "warning" if uptime >= 99.0 else "breach",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur métriques fiabilité: {str(e)}")


@router.get("/pods/metrics")
def get_pods_metrics(_: dict = Depends(verify_token)):
    """
    Retourne les métriques simulées des pods (dans un vrai système,
    viendrait de metrics-server ou Prometheus)
    """
    # Simuler des métriques de pods basées sur les logs reçus
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "pods": [
            {
                "pod_name": "api-server-7d9f4b8c5-x2v9p",
                "namespace": "production",
                "cpu_percent": 45.2,
                "memory_percent": 62.1,
                "memory_usage_mb": 512,
                "status": "Running",
                "restart_count": 0,
                "age_hours": 48.5,
                "node": "ip-10-0-11-62",
            },
            {
                "pod_name": "frontend-5c8f9d2a1-y4w6z",
                "namespace": "production",
                "cpu_percent": 32.8,
                "memory_percent": 48.3,
                "memory_usage_mb": 384,
                "status": "Running",
                "restart_count": 1,
                "age_hours": 24.2,
                "node": "ip-10-0-11-63",
            },
            {
                "pod_name": "postgres-0",
                "namespace": "production",
                "cpu_percent": 28.5,
                "memory_percent": 71.2,
                "memory_usage_mb": 2048,
                "status": "Running",
                "restart_count": 0,
                "age_hours": 72.0,
                "node": "ip-10-0-11-64",
            },
            {
                "pod_name": "redis-master-0",
                "namespace": "monitoring",
                "cpu_percent": 15.3,
                "memory_percent": 42.6,
                "memory_usage_mb": 256,
                "status": "Running",
                "restart_count": 0,
                "age_hours": 120.0,
                "node": "ip-10-0-11-62",
            },
            {
                "pod_name": "fluent-bit-twfw4",
                "namespace": "fluent-bit",
                "cpu_percent": 8.7,
                "memory_percent": 18.4,
                "memory_usage_mb": 128,
                "status": "Running",
                "restart_count": 2,
                "age_hours": 168.0,
                "node": "ip-10-0-11-63",
            },
            {
                "pod_name": "ingress-nginx-controller-9f8d7c6b4-k3m5n",
                "namespace": "ingress-nginx",
                "cpu_percent": 22.1,
                "memory_percent": 35.8,
                "memory_usage_mb": 320,
                "status": "Running",
                "restart_count": 0,
                "age_hours": 96.0,
                "node": "ip-10-0-11-62",
            },
        ],
        "summary": {
            "total": 6,
            "running": 6,
            "pending": 0,
            "failed": 0,
            "avg_cpu": 25.4,
            "avg_memory": 46.4,
        }
    }


@router.get("/history")
def get_metrics_history(hours: int = 24, _: dict = Depends(verify_token)):
    """
    Retourne l'historique des métriques système (simulé)
    """
    data = []
    now = datetime.utcnow()
    
    for i in range(hours):
        timestamp = now - timedelta(hours=i)
        # Simuler des variations
        base_cpu = 35 + (i % 10) * 2
        base_mem = 42 + (i % 8) * 1.5
        
        data.append({
            "timestamp": timestamp.isoformat(),
            "cpu_percent": round(base_cpu, 1),
            "memory_percent": round(base_mem, 1),
            "disk_percent": 45.0,
            "network_mbps": 12.5 + (i % 5),
        })
    
    return {
        "period_hours": hours,
        "data_points": len(data),
        "metrics": list(reversed(data))
    }
