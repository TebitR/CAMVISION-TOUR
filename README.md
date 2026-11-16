# CAMVISION TOUR

Guide culturel intelligent pour le Cameroun.

Reconnaissance visuelle de lieux et monuments, fiches patrimoniales multilingues, guide vocal et back-office d’administration — le tout conçu pour tourner en local via **Docker Compose**.

| Couche | Techno |
|--------|--------|
| API | FastAPI · PostgreSQL 16 · Qdrant · OpenCLIP |
| Admin | Next.js 15 · Tailwind · shadcn/ui |
| Mobile | Expo 57 · React Native (iOS & Android) |

Dépôt : [github.com/TebitR/CAMVISION-TOUR](https://github.com/TebitR/CAMVISION-TOUR)

---

## Démarrage rapide (collaborateur)

Objectif : cloner → lancer les services → peupler la base → ouvrir l’admin ou le mobile.

### 1. Cloner

```bash
git clone https://github.com/TebitR/CAMVISION-TOUR.git
cd CAMVISION-TOUR
```

### 2. Préparer les variables d’environnement

```bash
# Windows (PowerShell)
Copy-Item .env.example .env
Copy-Item backend\.env.example backend\.env

# macOS / Linux
cp .env.example .env
cp backend/.env.example backend/.env
```

Édite ensuite `.env` (racine) et `backend/.env` avec tes clés API.  
Les fichiers `.env` ne sont **jamais** commités.

Clés utiles :

| Variable | Où | Rôle |
|----------|-----|------|
| `ELEVENLABS_API_KEY` | `.env` + `backend/.env` | Guide vocal |
| `GEMINI_API_KEY` | `.env` + `backend/.env` | Q&A RAG (optionnel) |
| `MAPBOX_ACCESS_TOKEN` | `.env` | Carte admin + mobile |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `.env` | Connexion back-office |
| `JWT_SECRET_KEY` | `.env` | Tokens admin |

### 3. Lancer Docker Compose

```bash
docker compose up -d --build
```

Première construction : plusieurs minutes (Torch + OpenCLIP).  
Vérifie que tout tourne :

```bash
docker compose ps
curl http://localhost:8000/health
```

Tu dois voir `camvision_postgres`, `camvision_qdrant`, `camvision_backend` en **Up**.

### 4. Seed + indexation vision

```bash
docker compose exec backend python seed_objects.py
docker compose exec backend python index_vectors.py
```

- `seed_objects.py` — fiches patrimoniales (fr / en / es / de / zh / ar)  
- `index_vectors.py` — embeddings OpenCLIP → Qdrant (requis pour le scan)

### 5. Back-office admin

```bash
cd camvision-admin
npm install
npm run dev
```

→ [http://localhost:3000/admin/login](http://localhost:3000/admin/login)  
Identifiants par défaut : `admin@camvision.cm` / `motdepasseadmin`  
(ou ceux définis dans `.env`)

### 6. App mobile (Expo)

```bash
cd camvision-mobile
npm install
npx expo start
```

1. Installe **Expo Go** (SDK 57) sur le téléphone.  
2. Scanne le QR code.  
3. PC et téléphone sur le **même Wi‑Fi** ; autorise le port **8000** dans le pare-feu.

Astuces :

```bash
npx expo start -c        # cache vidé après un pull
npx expo start --tunnel  # réseaux Wi‑Fi différents
```

---

## Prérequis

| Outil | Version | Usage |
|-------|---------|--------|
| Git | ≥ 2.40 | Clone |
| Docker Desktop | ≥ 4.30 (Compose v2) | Postgres, Qdrant, API |
| Node.js | 20 LTS ou 22 LTS | Admin + mobile |
| npm | ≥ 10 | Dépendances front |
| Expo Go | SDK 57 | Tests téléphone |
| RAM | ≥ 8 Go (idéal 16 Go) | OpenCLIP |
| Disque | ≥ 15 Go libres | Images Docker + cache modèle |

Comptes externes (recommandés) : [ElevenLabs](https://elevenlabs.io/) · [Google AI Studio](https://aistudio.google.com/) · [Mapbox](https://www.mapbox.com/)

---

## Architecture

```
CAMVISION_TOUR/
├── docker-compose.yml     # db + vector-db + backend
├── .env.example           # modèle env racine
├── backend/               # FastAPI, vision, TTS, RAG, admin JWT
├── camvision-admin/       # Back-office Next.js
└── camvision-mobile/      # App Expo
```

| Service | URL / port |
|---------|------------|
| API FastAPI | http://localhost:8000 |
| Swagger | http://localhost:8000/docs |
| Admin | http://localhost:3000/admin |
| PostgreSQL | `5432` |
| Qdrant | `6333` (API), `6334` |

Flux principal :

1. L’admin crée / enrichit un lieu (photos, GPS, textes).  
2. Les images sont indexées dans Qdrant (OpenCLIP).  
3. Le mobile affiche le catalogue et reconnaît le lieu au scan.  
4. Le guide vocal (ElevenLabs) et le Q&A (Gemini / extractif) complètent la fiche.

---

## Commandes Docker du quotidien

```bash
# Démarrer
docker compose up -d

# Logs API (warmup OpenCLIP, erreurs upload, index)
docker compose logs -f backend

# Rebuild après changement Dockerfile / requirements
docker compose up -d --build

# Arrêt
docker compose stop

# Reset complet (⚠ efface Postgres + Qdrant + cache modèle)
docker compose down -v
```

Volumes persistants : `postgres_data`, `qdrant_data`, `openclip_cache`.

---

## API utiles

| Méthode | Route | Description |
|---------|--------|-------------|
| GET | `/health` | Postgres · Qdrant · vision · TTS |
| GET | `/api/monuments` | Catalogue lieux |
| GET | `/api/monuments/nearby` | Lieux à proximité GPS |
| POST | `/api/vision/analyze` | Scan image → fiche |
| POST | `/api/tts/generate` | Synthèse vocale |
| POST | `/api/rag/ask` | Question sur un lieu |
| POST | `/api/v1/auth/login` | Login admin (JWT) |
| CRUD | `/api/v1/admin/monuments` | Lieux (Bearer) |
| CRUD | `/api/v1/admin/categories` | Catégories (Bearer) |

Exemple RAG :

```bash
curl -X POST http://localhost:8000/api/rag/ask \
  -H "Content-Type: application/json" \
  -d "{\"monument_id\":13,\"query\":\"Pourquoi les crêtes ?\",\"language\":\"fr\"}"
```

---

## Collaboration

### Workflow Git

1. Crée une branche depuis `master` : `git checkout -b feat/ma-feature`  
2. Développe, teste en local (`docker compose` + admin / mobile).  
3. Commit clair, style existant (ex. *Ajouter…*, *Corriger…*, *Polir…*).  
4. Ouvre une Pull Request avec résumé + plan de test.  
5. Ne push jamais de `.env`, secrets ou photos uploadées dans `backend/sample_images/uploads/`.

### Qui fait quoi

| Zone | Dossier | Notes |
|------|---------|--------|
| API / vision / TTS | `backend/` | Relancer `index_vectors.py` après nouvelles images de seed |
| Back-office | `camvision-admin/` | `NEXT_PUBLIC_API_URL` pointe vers l’API |
| Mobile | `camvision-mobile/` | API résolue via l’hôte Expo / LAN |

### Conventions utiles

- Photos admin : **JPG / PNG / WEBP / GIF** (pas de HEIC).  
- Un lieu sans image n’est pas scannable ; dès qu’on ajoute des photos, l’indexation Qdrant part à l’enregistrement.  
- Langues supportées : fr, en, es, de, zh, ar.  
- En cas de doute API : ouvrir Swagger sur `/docs`.

---

## Dépannage

| Problème | Piste |
|----------|--------|
| Backend lent au 1er start | Normal : téléchargement / warmup OpenCLIP |
| Scan ne reconnaît rien | Relancer `index_vectors.py` ; vérifier les images du lieu |
| `402` ElevenLabs | Quota / `voice_id` — le scan et le texte restent OK |
| Expo n’atteint pas l’API | Même Wi‑Fi, IP, firewall port 8000, ou `--tunnel` |
| Admin 401 | Se reconnecter ; vérifier `ADMIN_*` et `JWT_SECRET_KEY` |
| Gemini absent | RAG bascule en mode extractif |
| Conteneurs instables | `docker compose down && docker compose up -d --build` |

---

## Licence & contact

Projet **CAMVISION TOUR** — usage éducatif et patrimonial.  
Forks et pull requests bienvenus.

Repository : [TebitR/CAMVISION-TOUR](https://github.com/TebitR/CAMVISION-TOUR)
