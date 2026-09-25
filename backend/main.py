import os
import math
import threading
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from database import engine, Base, get_db, SessionLocal
from models import Site, User, TouristObject, Category
from vision import get_vision_engine
from services.tts_service import generate_speech_elevenlabs, DEFAULT_VOICE_ID
from services.rag_service import (
    build_monument_context,
    ask_gemini,
    extractive_answer,
    qdrant_monument_hits,
)
from migrate_enrich import ensure_enriched_columns
import asyncio

from routers import search as search_router
from routers import itinerary as itinerary_router
from routers import auth as auth_router
from routers import admin_categories as admin_categories_router
from routers import admin_monuments as admin_monuments_router

Base.metadata.create_all(bind=engine)
try:
    ensure_enriched_columns()
except Exception as e:
    print(f"Migration enrichissement: {e}")

app = FastAPI(
    title="CAMVISION TOUR API",
    version="2.0.0",
    description="Backend Orchestrateur - Vision, GPS, Multilingue & ElevenLabs"
)

_cors_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search_router.router)
app.include_router(itinerary_router.router)
app.include_router(auth_router.router)
app.include_router(admin_categories_router.router)
app.include_router(admin_monuments_router.router)


def seed_default_categories():
    """Crée les catégories de base + sync depuis les slugs déjà présents sur les objets."""
    defaults = [
        ("Monument", "monument", "Sites et monuments patrimoniaux"),
        ("Musée", "musee", "Musées et collections"),
        ("Masque", "masque", "Masques traditionnels"),
        ("Sculpture", "sculpture", "Sculptures et arts"),
        ("Nature", "nature", "Sites naturels"),
        ("Hôtel", "hotel", "Hébergements"),
        ("Artefact", "artifact", "Objets / artefacts"),
    ]
    db = SessionLocal()
    try:
        existing = {c.slug for c in db.query(Category).all()}
        for name, slug, desc in defaults:
            if slug not in existing:
                db.add(Category(name=name, slug=slug, description=desc))
                existing.add(slug)
        # Sync des catégories déjà utilisées sur TouristObject
        used = {
            (row[0] or "").strip().lower()
            for row in db.query(TouristObject.category).distinct().all()
            if row[0]
        }
        for slug in used:
            if slug and slug not in existing:
                db.add(
                    Category(
                        name=slug.replace("-", " ").title(),
                        slug=slug,
                        description=None,
                    )
                )
                existing.add(slug)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Seed catégories: {e}")
    finally:
        db.close()


try:
    seed_default_categories()
except Exception as e:
    print(f"Seed catégories (boot): {e}")

# Images patrimoniaxes (sample_images/...) accessibles depuis le mobile
_sample_dir = os.path.join(os.path.dirname(__file__), "sample_images")
if os.path.isdir(_sample_dir):
    app.mount("/sample_images", StaticFiles(directory=_sample_dir), name="sample_images")

QDRANT_HOST = os.getenv("QDRANT_HOST", "vector-db")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "camvision_artifacts"
CONFIDENCE_THRESHOLD = 0.55


def get_qdrant_client() -> QdrantClient:
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)


def _hit_object_id(hit) -> int | None:
    """object_id payload, sinon déduit de l'id du point (galerie idx > 0)."""
    payload = hit.payload or {}
    raw = payload.get("object_id")
    if raw is not None:
        try:
            return int(raw)
        except (TypeError, ValueError):
            pass
    try:
        hid = int(hit.id)
    except (TypeError, ValueError):
        return None
    if hid < 1000:
        return hid
    if hid >= 10000:
        return hid // 10000
    return hid // 1000


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


@app.on_event("startup")
def startup_event():
    try:
        client = get_qdrant_client()
        collections = [c.name for c in client.get_collections().collections]
        if COLLECTION_NAME not in collections:
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=512, distance=Distance.COSINE)
            )
            print(f"Collection Qdrant '{COLLECTION_NAME}' initialisée (512-dim Cosine).")
    except Exception as e:
        print(f"Erreur Qdrant au démarrage : {e}")

    try:
        get_vision_engine().warmup()
    except Exception as e:
        print(f"Erreur warmup OpenCLIP au démarrage : {e}")

    def _index_pending():
        try:
            from services.vision_index import ensure_indexed

            ensure_indexed()
        except Exception as e:
            print(f"Index vision (startup): {e}")

    threading.Thread(target=_index_pending, daemon=True).start()


@app.get("/")
def read_root():
    return {"status": "online", "project": "CAMVISION TOUR", "version": "2.0.0"}


@app.get("/health")
def health_check():
    client = get_qdrant_client()
    return {
        "postgres": "ready",
        "qdrant": COLLECTION_NAME,
        "vision_engine": "OpenCLIP ViT-B/32",
        "tts": "ElevenLabs",
        "status": "healthy"
    }


@app.get("/api/sites")
def get_sites(db: Session = Depends(get_db)):
    sites = db.query(Site).all()
    return {"count": len(sites), "sites": sites}


@app.get("/api/sites/nearby", summary="Rechercher des sites à proximité")
async def get_nearby_sites(
    latitude: float = Query(..., description="Latitude actuelle"),
    longitude: float = Query(..., description="Longitude actuelle"),
    radius_km: float = Query(5.0, description="Rayon de recherche en km"),
    db: Session = Depends(get_db)
):
    sites = db.query(Site).all()
    nearby = []
    for site in sites:
        dist = haversine(latitude, longitude, site.latitude, site.longitude)
        if dist <= radius_km:
            nearby.append({
                "id": site.id,
                "name": site.name,
                "latitude": site.latitude,
                "longitude": site.longitude,
                "distance_km": round(dist, 2)
            })
    nearby.sort(key=lambda x: x["distance_km"])
    return {"count": len(nearby), "sites": nearby}


def _gallery_urls(obj) -> list[str]:
    urls: list[str] = []
    raw = getattr(obj, "image_urls", None)
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str) and item.strip():
                urls.append(item.strip())
            elif isinstance(item, dict) and item.get("url"):
                urls.append(str(item["url"]).strip())
    cover = getattr(obj, "image_url", None)
    if cover and cover not in urls:
        urls.insert(0, cover)
    return urls


def _cover_image(obj) -> str | None:
    urls = _gallery_urls(obj)
    return urls[0] if urls else None


@app.get("/api/monuments", summary="Catalogue des monuments patrimoniaux")
async def list_monuments(
    lang: str = Query("fr", description="Langue des métadonnées"),
    q: str = Query("", description="Recherche nom / ville / région"),
    limit: int = Query(60, ge=1, le=200),
    light: bool = Query(True, description="Payload allégé"),
    db: Session = Depends(get_db),
):
    """Liste catalogue (sans GPS) pour l'onglet Explorer / Accueil."""
    lang_key = (lang or "fr").lower().replace("_", "-").split("-")[0]
    if lang_key not in ("fr", "en", "es", "de", "zh", "ar"):
        lang_key = "fr"

    query = (q or "").strip().lower()
    objects = db.query(TouristObject).all()
    results = []
    for obj in objects:
        title = obj.localized(obj.name, lang_key, "Monument")
        city = obj.city_name or ""
        region = obj.region or ""
        if query:
            blob = f"{title} {city} {region} {obj.code or ''} {obj.category or ''}".lower()
            if query not in blob:
                # match also other language names lightly
                if isinstance(obj.name, dict):
                    if not any(query in str(v).lower() for v in obj.name.values()):
                        continue
                else:
                    continue
        explanation = obj.localized(obj.description, lang_key, "") or ""
        if light and len(explanation) > 220:
            explanation = explanation[:217].rstrip() + "…"
        hist = obj.localized(obj.history, lang_key, "") or ""
        if light and len(hist) > 280:
            hist = hist[:277].rstrip() + "…"
        gallery = _gallery_urls(obj)
        results.append(
            {
                "id": obj.id,
                "code": obj.code,
                "title": title,
                "category": obj.category or "artifact",
                "region": region or None,
                "city": city or None,
                "latitude": obj.latitude,
                "longitude": obj.longitude,
                "image_url": gallery[0] if gallery else None,
                "image_urls": gallery,
                "explanation": explanation,
                "history": hist,
                "audio_available": bool(obj.audio_story_url)
                or bool(explanation)
                or bool(hist),
            }
        )

    results.sort(key=lambda x: (x["title"] or "").lower())
    results = results[:limit]
    return {"count": len(results), "monuments": results}


@app.get("/api/monuments/nearby", summary="Monuments / objets patrimoniaux à proximité")
async def get_nearby_monuments(
    lat: float = Query(..., description="Latitude GPS du touriste"),
    lng: float = Query(..., description="Longitude GPS du touriste"),
    radius: float = Query(300.0, description="Rayon en km (défaut 300 pour couverture régionale)"),
    lang: str = Query("fr", description="Langue des métadonnées"),
    limit: int = Query(30, ge=1, le=100, description="Nombre max de résultats (plus proches)"),
    light: bool = Query(True, description="Payload carte allégé (sans history longue)"),
    db: Session = Depends(get_db),
):
    lang_key = (lang or "fr").lower().replace("_", "-").split("-")[0]
    if lang_key not in ("fr", "en", "es", "de", "zh", "ar"):
        lang_key = "fr"

    objects = (
        db.query(TouristObject)
        .filter(TouristObject.latitude.isnot(None), TouristObject.longitude.isnot(None))
        .all()
    )
    nearby = []
    for obj in objects:
        dist = haversine(lat, lng, obj.latitude, obj.longitude)
        if dist > radius:
            continue
        explanation = obj.localized(obj.description, lang_key, "") or ""
        if light and len(explanation) > 220:
            explanation = explanation[:217].rstrip() + "…"
        item = {
            "id": obj.id,
            "code": obj.code,
            "title": obj.localized(obj.name, lang_key, "Monument"),
            "category": obj.category or "artifact",
            "region": obj.region,
            "city": obj.city_name,
            "latitude": obj.latitude,
            "longitude": obj.longitude,
            "distance_km": round(dist, 3),
            "distance_m": round(dist * 1000),
            "image_url": _cover_image(obj),
            "image_urls": _gallery_urls(obj),
            "explanation": explanation,
        }
        if not light:
            item["history"] = obj.localized(obj.history, lang_key, "")
        else:
            # Extrait court pour TTS / fiche — évite de renvoyer tout l'historique
            hist = obj.localized(obj.history, lang_key, "") or ""
            item["history"] = (hist[:280] + "…") if len(hist) > 280 else hist
        nearby.append(item)

    nearby.sort(key=lambda x: x["distance_km"])
    nearby = nearby[:limit]
    return {
        "count": len(nearby),
        "lat": lat,
        "lng": lng,
        "radius_km": radius,
        "monuments": nearby,
    }


@app.post("/api/vision/extract")
async def extract_vector(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier fourni doit être une image.")
    image_bytes = await file.read()
    vision = get_vision_engine()
    vector = vision.extract_image_embedding(image_bytes)
    return {
        "filename": file.filename,
        "vector_dimensions": len(vector),
        "sample": vector[:5]
    }


@app.post("/api/vision/search", summary="Recherche par similarité visuelle")
async def search_similar_objects(
    file: UploadFile = File(...),
    limit: int = 5,
    db: Session = Depends(get_db)
):
    try:
        image_bytes = await file.read()
        vision_engine = get_vision_engine()
        query_vector = vision_engine.extract_image_embedding(image_bytes)
        client = get_qdrant_client()
        search_result = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=limit
        )
        results = []
        for hit in search_result:
            obj_id = _hit_object_id(hit)
            obj = db.query(TouristObject).filter(TouristObject.id == obj_id).first() if obj_id else None
            if obj:
                results.append({
                    "object_id": obj.id,
                    "name": obj.name,
                    "description": obj.description,
                    "category": obj.category,
                    "image_url": _cover_image(obj),
                    "score": round(hit.score, 4)
                })
            else:
                results.append({
                    "object_id": hit.id,
                    "name": hit.payload.get("name_fr", "Objet inconnu"),
                    "score": round(hit.score, 4)
                })
        return {"success": True, "count": len(results), "results": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la recherche visuelle : {str(e)}")


@app.post("/api/vision/analyze", summary="Pipeline Scan complet")
async def analyze_and_explain(
    file: UploadFile = File(...),
    lang: str = Form("fr"),
    user_interest: str = Form("general"),
    db: Session = Depends(get_db),
):
    """
    1. OpenCLIP → embedding
    2. Qdrant → matching
    3. PostgreSQL → métadonnées patrimoniales
    4. Texte adapté à la langue
    """
    try:
        image_bytes = await file.read()
        vision_engine = get_vision_engine()
        query_vector = vision_engine.extract_image_embedding(image_bytes)

        client = get_qdrant_client()
        hits = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=5,
        )

        if not hits:
            return {
                "found": False,
                "message": "Aucun artefact ou monument reconnu avec une confiance suffisante.",
            }

        # Prendre le meilleur hit dont l'object_id existe encore en Postgres
        # (ignore les vecteurs orphelins d'anciens seed)
        top = None
        obj = None
        for hit in hits:
            if hit.score < CONFIDENCE_THRESHOLD:
                continue
            obj_id = _hit_object_id(hit)
            candidate = (
                db.query(TouristObject).filter(TouristObject.id == obj_id).first()
                if obj_id
                else None
            )
            if candidate:
                top = hit
                obj = candidate
                break

        if not top or not obj:
            best = hits[0]
            return {
                "found": False,
                "score": round(best.score, 4),
                "message": "Aucun artefact ou monument reconnu avec une confiance suffisante.",
            }

        lang_key = (lang or "fr").lower().replace("_", "-").split("-")[0]
        if lang_key not in ("fr", "en", "es", "de", "zh", "ar"):
            lang_key = "fr"
        title = obj.localized(obj.name, lang_key, "Artefact")
        explanation = obj.localized(obj.description, lang_key, "")
        history = obj.localized(obj.history, lang_key, "")
        anecdotes = obj.localized(obj.anecdotes, lang_key, "")

        # Légère adaptation selon l'intérêt utilisateur
        if user_interest and user_interest != "general" and history:
            explanation = f"{explanation}\n\n{history}"

        return {
            "found": True,
            "score": round(top.score, 4),
            "artifact": {
                "id": obj.id,
                "code": obj.code,
                "title": title,
                "category": obj.category or "artifact",
                "region": obj.region or "Cameroun",
                "city": obj.city_name,
                "image_url": _cover_image(obj),
                "image_urls": _gallery_urls(obj),
                "voice_id": DEFAULT_VOICE_ID,
                "coordinates": {
                    "latitude": obj.latitude,
                    "longitude": obj.longitude,
                },
                "explanation": explanation,
                "history": history,
                "anecdotes": anecdotes,
                "lang": lang_key,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur analyse: {str(e)}")


class TTSPayload(BaseModel):
    text: str
    voice_id: str | None = None


class RagAskPayload(BaseModel):
    monument_id: int
    query: str
    language: str = "fr"


@app.post("/api/rag/ask", summary="Q&A RAG sur un monument (Qdrant + Gemini)")
async def rag_ask(payload: RagAskPayload, db: Session = Depends(get_db)):
    query = (payload.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="La question est obligatoire.")
    if len(query) > 500:
        query = query[:500]

    lang_key = (payload.language or "fr").lower().replace("_", "-").split("-")[0]
    if lang_key not in ("fr", "en", "es", "de", "zh", "ar"):
        lang_key = "fr"

    obj = db.query(TouristObject).filter(TouristObject.id == payload.monument_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Monument introuvable.")

    context = build_monument_context(obj, lang_key)

    # Recherche vectorielle CLIP texte→image filtrée sur ce monument
    relevance = None
    try:
        vision = get_vision_engine()
        query_vector = await asyncio.to_thread(vision.extract_text_embedding, query)
        client = get_qdrant_client()
        hits = await asyncio.to_thread(
            qdrant_monument_hits, client, COLLECTION_NAME, obj.id, query_vector, 3
        )
        if hits:
            relevance = round(float(hits[0].score), 4)
    except Exception as e:
        print(f"RAG Qdrant: {e}")

    answer = await asyncio.to_thread(ask_gemini, context, query, lang_key)
    source = "gemini"
    if not answer:
        answer = extractive_answer(context, query, lang_key)
        source = "extractive"

    return {
        "success": True,
        "monument_id": obj.id,
        "language": lang_key,
        "answer": answer,
        "relevance": relevance,
        "source": source,
    }


@app.post("/api/tts/generate", summary="Synthèse vocale ElevenLabs (SDK uniquement)")
async def generate_audio(payload: TTSPayload):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Le texte est obligatoire.")

    # Limiter la taille pour contrôler coût / latence
    if len(text) > 2500:
        text = text[:2500]

    voice_id = (payload.voice_id or DEFAULT_VOICE_ID or "").strip() or None
    audio_bytes = await asyncio.to_thread(generate_speech_elevenlabs, text, voice_id)
    return Response(content=audio_bytes, media_type="audio/mpeg")
