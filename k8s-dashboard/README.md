# Kubernetes Runtime Analysis Platform — Dashboard

## Stack
- **Backend** : FastAPI · PostgreSQL 15 · Redis · Celery · SQLAlchemy · Alembic
- **Frontend** : React 18 · React Query · Zustand · Recharts · Tailwind CSS
- **Infra locale** : Docker Compose (7 services)

---

## Prérequis à installer

| Outil | Version minimale | Commande de vérification |
|---|---|---|
| Docker Desktop | ≥ 24.0 | `docker --version` |
| Docker Compose | ≥ 2.20 | `docker compose version` |
| Python | 3.10+ | `python --version` |
| Node.js | 18+ | `node --version` |
| Git | ≥ 2.40 | `git --version` |

---

## Démarrage rapide (local)

```bash
# 1. Cloner le projet
git clone <repo-url>
cd k8s-dashboard

# 2. Copier les variables d'environnement
cp .env.example .env

# 3. Démarrer toute la stack
docker compose up --build

# 4. Appliquer les migrations DB (premier démarrage)
docker compose exec api alembic upgrade head

# 5. (Optionnel) Injecter des données de démo
docker compose exec api python scripts/seed_demo.py
```

### URLs locales
| Service | URL |
|---|---|
| Dashboard React | http://localhost:3000 |
| API FastAPI | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| Service ML | http://localhost:8001 |
| Flower (Celery monitor) | http://localhost:5555 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

---

## Structure du projet

```
k8s-dashboard/
├── docker-compose.yml
├── .env.example
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/versions/
│   └── app/
│       ├── main.py              # FastAPI app + CORS
│       ├── config.py            # Settings Pydantic
│       ├── database.py          # SQLAlchemy engine + session
│       ├── models/
│       │   ├── incident.py      # ORM incidents, risk_scores, timers
│       │   └── log.py           # ORM raw_logs, blocked_ips
│       ├── api/
│       │   ├── dashboard.py     # GET /dashboard/summary
│       │   ├── incidents.py     # GET/POST incidents + IR
│       │   ├── logs.py          # POST /logs/ingest
│       │   ├── risk_score.py    # GET /risk-score
│       │   └── auth.py          # JWT login/refresh
│       └── services/
│           ├── ml_client.py     # Appel HTTP vers service ML
│           ├── celery_app.py    # Config Celery + Redis
│           ├── ir_tasks.py      # Playbooks IR (Celery tasks)
│           └── circuit_breaker.py
├── ml/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI ML service
│       └── scorer.py            # Isolation Forest + OWASP rules
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tailwind.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── api/                 # React Query hooks
        │   └── client.js
        ├── stores/
        │   └── filterStore.js   # Zustand global state
        ├── hooks/
        │   ├── useRiskScore.js
        │   ├── useIncidents.js
        │   └── useIRLive.js
        └── components/
            ├── dashboard/
            │   ├── RiskScoreGauge.jsx
            │   ├── IncidentTable.jsx
            │   ├── IncidentTimeline.jsx
            │   ├── ServiceHeatmap.jsx
            │   └── DashboardSummary.jsx
            ├── ir/
            │   ├── IRLivePanel.jsx
            │   └── IRTimer.jsx
            └── layout/
                ├── Sidebar.jsx
                └── FilterBar.jsx
```

---

## Développement sans Docker

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Démarrer PostgreSQL et Redis localement, puis :
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev                     # http://localhost:3000
```

### Variables d'environnement importantes (.env)
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/k8s_platform
REDIS_URL=redis://localhost:6379/0
JWT_SECRET=changeme-in-production-32chars-min
ML_SERVICE_URL=http://localhost:8001
```
