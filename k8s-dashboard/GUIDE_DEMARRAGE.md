# Guide de démarrage complet — K8s Runtime Platform Dashboard

## Étape 0 — Vérifier les prérequis

Ouvrez un terminal et vérifiez :

```bash
docker --version          # doit afficher ≥ 24.0
docker compose version    # doit afficher ≥ 2.20
node --version            # doit afficher ≥ v18
python --version          # doit afficher ≥ 3.10
git --version             # optionnel
```

Si Docker Desktop n'est pas installé :
- Téléchargez sur https://www.docker.com/products/docker-desktop/
- Lancez Docker Desktop et attendez que la baleine soit verte

---

## Étape 1 — Récupérer le projet

```bash
# Option A : si le projet est dans un dépôt Git
git clone <votre-repo-url>
cd k8s-dashboard

# Option B : si vous avez le dossier directement
cd k8s-dashboard        # naviguez vers le dossier du projet
```

---

## Étape 2 — Créer le fichier de configuration

```bash
# Copier le template
cp .env.example .env
```

Pour le développement local, les valeurs par défaut suffisent.
Vérifiez que `.env` contient bien :

```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=k8s_platform
REDIS_URL=redis://redis:6379/0
JWT_SECRET=change-me-in-production-use-32-chars-minimum
ML_SERVICE_URL=http://ml-service:8001
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/k8s_platform
```

---

## Étape 3 — Construire et démarrer tous les services

```bash
# Construction des images Docker (5-10 min la première fois)
docker compose build

# Démarrer tous les 7 services
docker compose up -d
```

Pour voir les logs en direct :
```bash
docker compose logs -f
# ou pour un service spécifique :
docker compose logs -f api
docker compose logs -f ml-service
docker compose logs -f frontend
```

Attendez que tous les services soient "healthy" :
```bash
docker compose ps
# Tous les services doivent afficher "running" ou "healthy"
```

---

## Étape 4 — Initialiser la base de données

```bash
# Créer les tables (la première fois uniquement)
docker compose exec api python -c "
from app.database import engine, Base
from app.models.incident import *
from app.models.log import *
Base.metadata.create_all(bind=engine)
print('Tables créées ✅')
"
```

---

## Étape 5 — Injecter des données de démo

```bash
# Injecte 80 incidents et 7 jours de Risk Scores
docker compose exec api python scripts/seed_demo.py
```

Vous devriez voir :
```
🌱 Injection des données de démo...
✅ 80 incidents créés
✅ 2016 risk scores créés
🎉 Données de démo injectées avec succès !
```

---

## Étape 6 — Ouvrir le dashboard

| Service | URL | Identifiants |
|---|---|---|
| **Dashboard React** | http://localhost:3000 | admin / admin123 |
| API Swagger (docs) | http://localhost:8000/docs | — |
| Flower (Celery) | http://localhost:5555 | — |
| ML Service | http://localhost:8001/docs | — |

Ouvrez http://localhost:3000 dans votre navigateur.
Connectez-vous avec `admin` / `admin123`.

---

## Commandes utiles au quotidien

### Démarrage / Arrêt
```bash
docker compose up -d        # démarrer en arrière-plan
docker compose down         # arrêter tous les services
docker compose restart api  # redémarrer un service
docker compose ps           # voir l'état des services
```

### Logs
```bash
docker compose logs -f api          # logs API en direct
docker compose logs -f celery-worker # logs workers IR
docker compose logs -f ml-service   # logs ML
docker compose logs --tail=50 api   # 50 dernières lignes
```

### Base de données
```bash
# Connexion directe à PostgreSQL
docker compose exec postgres psql -U postgres -d k8s_platform

# Requêtes utiles :
# SELECT count(*) FROM incidents;
# SELECT * FROM incidents ORDER BY detected_at DESC LIMIT 5;
# SELECT * FROM risk_scores ORDER BY computed_at DESC LIMIT 5;
```

### Reset complet
```bash
docker compose down -v      # arrête ET supprime les volumes (données perdues)
docker compose up -d        # repart de zéro
docker compose exec api python -c "from app.database import engine, Base; from app.models.incident import *; from app.models.log import *; Base.metadata.create_all(bind=engine)"
docker compose exec api python scripts/seed_demo.py
```

---

## Injecter un log de test (simuler un incident)

```bash
# 1. Obtenir un token JWT
TOKEN=$(curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Injecter un log SQL injection (score CRITICAL)
curl -X POST http://localhost:8000/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "namespace": "production",
    "pod_name": "api-server-7d9f",
    "message": "GET /api/users?id=1 UNION SELECT * FROM users-- HTTP/1.1 400",
    "source_ip": "192.168.1.42",
    "log_level": "ERROR"
  }'

# 3. Injecter un CrashLoopBackOff (score HIGH, IR immédiat)
curl -X POST http://localhost:8000/logs/ingest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "namespace": "production",
    "pod_name": "payment-svc-3k2l",
    "message": "Back-off restarting failed container: CrashLoopBackOff",
    "log_level": "ERROR"
  }'
```

Après injection, observez dans le dashboard :
- Le Risk Score monter en temps réel (polling 5s)
- L'incident apparaître dans la table (polling 10s)
- Le timer IR s'afficher dans le Live Panel (polling 2s)
- Le bouton "Annuler" disponible pendant le délai

---

## Architecture des flux de données

```
Fluent Bit (K8s pods)
        ↓ HTTPS + JWT
POST /logs/ingest  (FastAPI)
        ↓ stockage
PostgreSQL (raw_logs)
        ↓ BackgroundTask
POST /predict  (ML Service)
        ↓ score JSON
Création Incident en base
        ↓ si score > seuil
dispatch_ir.delay()  (Celery)
        ↓ countdown
execute_playbook()  (Celery)
        ↓ kubectl / NetworkPolicy
Résolution automatique
        ↓ notif
Slack Webhook + AWS SES
```

---

## Dépannage fréquent

### Port déjà utilisé
```bash
# Trouver le processus sur le port 3000
lsof -i :3000    # macOS/Linux
netstat -ano | findstr :3000  # Windows

# Changer le port dans docker-compose.yml si nécessaire
```

### Service qui ne démarre pas
```bash
docker compose logs api        # lire les erreurs
docker compose restart api     # redémarrer
```

### Base de données inaccessible
```bash
docker compose ps postgres     # vérifier qu'il est "healthy"
docker compose restart postgres
```

### ML service lent au démarrage
Le premier démarrage télécharge le modèle spaCy (`en_core_web_sm`).
Attendez 1-2 minutes et vérifiez :
```bash
curl http://localhost:8001/health
# doit retourner : {"status":"ok"}
```

### Reconstruire après modification du code
```bash
docker compose build api        # reconstruire l'API
docker compose up -d api        # redémarrer
# Pour le frontend, le hot-reload est automatique grâce au volume monté
```
