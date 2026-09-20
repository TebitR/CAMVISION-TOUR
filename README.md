# CAMVISION TOUR

Guide culturel intelligent pour le Cameroun : reconnaissance visuelle d’objets / monuments (OpenCLIP + Qdrant), fiches patrimoniales multilingues, guide vocal ElevenLabs, et questions-réponses RAG (Gemini).

Stack :
- **Backend** : FastAPI + PostgreSQL 16 + Qdrant + OpenCLIP (Docker)
- **Mobile** : Expo 57 / React Native (iOS & Android via Expo Go)

Dépôt : [https://github.com/TebitR/CAMVISION-TOUR](https://github.com/TebitR/CAMVISION-TOUR)

---

## Prérequis (versions recommandées)

| Outil | Version testée / cible | Rôle |
|--------|-------------------------|------|
| **Git** | ≥ 2.40 | Cloner le dépôt |
| **Docker Desktop** | ≥ 4.30 (Docker Engine ≥ 24, Compose v2) | Postgres, Qdrant, API |
| **Node.js** | **20 LTS** ou **22 LTS** (ex. v22.22) | App mobile Expo |
| **npm** | ≥ 10 (ex. 10.8) | Dépendances mobile |
| **Python** | **3.11** (image Docker `python:3.11-slim`) | Backend (dans le conteneur) |
| **Expo Go** | Compatible **SDK 57** | Tester sur téléphone |
| **RAM** | ≥ **8 Go** (idéal 16 Go) | Chargement OpenCLIP / Torch |
| **Disque** | ≥ **15 Go** libres | Images Docker + cache modèle |

Clés API à prévoir (comptes externes) :
- [ElevenLabs](https://elevenlabs.io/) — synthèse vocale
- [Google AI Studio / Gemini](https://aistudio.google.com/) — réponses RAG (optionnel mais recommandé)

---

## Architecture rapide

```
CAMVISION_TOUR/
├── docker-compose.yml      # db + vector-db + backend
├── .env                    # variables Docker (non versionné)
├── .env.example
├── backend/                # FastAPI, vision, TTS, RAG, seed
│   ├── Dockerfile          # Python 3.11
│   ├── requirements.txt
│   ├── .env / .env.example
│   ├── main.py
│   ├── seed_objects.py
│   └── index_vectors.py
└── camvision-mobile/       # Expo 57
    ├── package.json
    ├── App.js
    └── src/
```

Ports par défaut :
- API FastAPI : `http://localhost:8000`
- Docs Swagger : `http://localhost:8000/docs`
- PostgreSQL : `5432`
- Qdrant : `6333` (API), `6334`

---

## 1. Cloner le projet

```bash
git clone https://github.com/TebitR/CAMVISION-TOUR.git
cd CAMVISION-TOUR
```

---

## 2. Configurer les variables d’environnement

### Racine du projet (Docker Compose)

```bash
# Windows (PowerShell)
Copy-Item .env.example .env

# macOS / Linux
cp .env.example .env
```

Édite `.env` et renseigne au minimum :

```env
POSTGRES_USER=camvision_admin
POSTGRES_PASSWORD=camvision_secure_pass_2026
POSTGRES_DB=camvision_db
POSTGRES_PORT=5432
QDRANT_HOST=vector-db
QDRANT_PORT=6333
BACKEND_PORT=8000
GEMINI_API_KEY=ta_cle_gemini
ELEVENLABS_API_KEY=ta_cle_elevenlabs
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

### Backend (lu par le conteneur via `env_file`)

```bash
# Windows
Copy-Item backend\.env.example backend\.env

# macOS / Linux
cp backend/.env.example backend/.env
```

Édite `backend/.env` :

```env
ELEVENLABS_API_KEY=ta_cle_elevenlabs
ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
GEMINI_API_KEY=ta_cle_gemini
```

> Ne committe jamais les fichiers `.env` (déjà ignorés par `.gitignore`).

---

## 3. Lancer l’infrastructure backend (Docker)

### Première construction (peut prendre plusieurs minutes : Torch + OpenCLIP)

```bash
docker compose build
docker compose up -d
```

Vérifier les conteneurs :

```bash
docker compose ps
```

Tu dois voir `camvision_postgres`, `camvision_qdrant`, `camvision_backend` en état **Up**.

Santé API :

```bash
curl http://localhost:8000/health
# ou navigateur : http://localhost:8000/docs
```

Logs en cas de souci :

```bash
docker compose logs -f backend
```

### Seed des objets patrimoniaux + indexation Qdrant

Une fois le backend démarré et le warmup OpenCLIP terminé :

```bash
docker compose exec backend python seed_objects.py
docker compose exec backend python index_vectors.py
```

- `seed_objects.py` : charge les fiches (fr/en/es/de/zh/ar) dans PostgreSQL  
- `index_vectors.py` : purge / recrée la collection Qdrant et indexe les images (OpenCLIP ViT-B/32, 512-d)

---

## 4. Lancer l’application mobile (Expo)

Sur la **même machine** (ou une machine qui peut joindre l’IP du backend) :

```bash
cd camvision-mobile
npm install
npx expo start
```

Options utiles :

```bash
npx expo start -c          # cache vidé (recommandé après pull)
npx expo start --tunnel    # si téléphone et PC ne sont pas sur le même Wi‑Fi
```

1. Installe **Expo Go** (SDK 57) sur iPhone / Android.  
2. Scanne le QR code.  
3. L’app résout l’API via l’hôte Expo (`http://<IP-du-PC>:8000`).  
   - PC et téléphone **sur le même réseau local**.  
   - Pare-feu Windows : autoriser le port **8000** en entrée.

### Versions mobile (extrait)

| Package | Version |
|---------|---------|
| Expo SDK | ~57.0.24 |
| React | 19.2.3 |
| React Native | 0.86.3 |
| expo-camera / expo-audio / expo-file-system | alignés SDK 57 |

---

## 5. Déploiement sur une autre machine (checklist)

1. Installer **Git**, **Docker Desktop**, **Node 20 ou 22**.  
2. `git clone` + `cd CAMVISION-TOUR`.  
3. Copier et remplir `.env` et `backend/.env` (clés API).  
4. `docker compose build && docker compose up -d`.  
5. Attendre le message de warmup OpenCLIP dans les logs.  
6. `seed_objects.py` puis `index_vectors.py`.  
7. `cd camvision-mobile && npm install && npx expo start`.  
8. Tester `GET /health` et un scan depuis Expo Go.

### Arrêt / redémarrage

```bash
docker compose stop
docker compose start
# ou rebuild complet
docker compose down
docker compose up -d --build
```

### Données persistantes Docker

Volumes : `postgres_data`, `qdrant_data`, `openclip_cache`.  
Pour tout réinitialiser :

```bash
docker compose down -v
```

---

## 6. API utiles

| Méthode | Route | Description |
|---------|--------|-------------|
| GET | `/health` | État Postgres / Qdrant / vision / TTS |
| POST | `/api/vision/analyze` | Scan image → fiche localisée |
| POST | `/api/tts/generate` | Synthèse vocale ElevenLabs |
| POST | `/api/rag/ask` | Q&A RAG sur un monument |

Exemple RAG :

```bash
curl -X POST http://localhost:8000/api/rag/ask \
  -H "Content-Type: application/json" \
  -d "{\"monument_id\":13,\"query\":\"Pourquoi les crêtes ?\",\"language\":\"fr\"}"
```

---

## 7. Dépannage fréquent

| Problème | Piste |
|----------|--------|
| Backend lent au 1er démarrage | Normal : téléchargement / chargement OpenCLIP |
| `402` ElevenLabs | Plan / `voice_id` invalide — vérifier `ELEVENLABS_*` |
| Scan ne trouve rien | Relancer `index_vectors.py` ; images dans `backend/sample_images/` |
| Expo n’atteint pas l’API | Même Wi‑Fi ; IP ; firewall port 8000 ; `expo start --tunnel` |
| Disque plein (iPhone / Expo) | Libérer de l’espace ; l’app tente la lecture audio en mémoire |
| Gemini absent | RAG bascule en mode extractif (sans clé valide) |

---

## 8. Licence & contribution

Projet **CAMVISION TOUR** — usage éducatif / patrimonial.  
Forks et PR bienvenus sur le dépôt GitHub.

---

## Auteurs / contact

Repository : [TebitR/CAMVISION-TOUR](https://github.com/TebitR/CAMVISION-TOUR)
