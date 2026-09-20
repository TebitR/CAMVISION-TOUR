import os
import math
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, Query, Form
from fastapi.responses import Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from database import engine, Base, get_db
from models import Site, User, TouristObject
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

# Images patrimoniaxes (sample_images/...) accessibles depuis le mobile
_sample_dir = os.path.join(os.path.dirname(__file__), "sample_images")
if os.path.isdir(_sample_dir):
    app.mount("/sample_images", StaticFiles(directory=_sample_dir), name="sample_images")

QDRANT_HOST = os.getenv("QDRANT_HOST", "vector-db")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "camvision_artifacts"
CONFIDENCE_THRESHOLD = 0.60


def get_qdrant_client() -> QdrantClient:
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)


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


@app.get("/api/monuments/nearby", summary="Monuments / objets patrimoniaux à proximité")
async def get_nearby_monuments(
    lat: float = Query(..., description="Latitude GPS du touriste"),
    lng: float = Query(..., description="Longitude GPS du touriste"),
    radius: float = Query(300.0, description="Rayon en km (défaut 300 pour couverture régionale)"),
    lang: str = Query("fr", description="Langue des métadonnées"),
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
        nearby.append({
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
            "image_url": obj.image_url,
            "explanation": obj.localized(obj.description, lang_key, ""),
            "history": obj.localized(obj.history, lang_key, ""),
        })

    nearby.sort(key=lambda x: x["distance_km"])
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
            obj_id = hit.payload.get("object_id") or hit.id
            obj = db.query(TouristObject).filter(TouristObject.id == obj_id).first()
            if obj:
                results.append({
                    "object_id": obj.id,
                    "name": obj.name,
                    "description": obj.description,
                    "category": obj.category,
                    "image_url": obj.image_url,
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
            obj_id = hit.payload.get("object_id") or hit.id
            candidate = db.query(TouristObject).filter(TouristObject.id == obj_id).first()
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
                "image_url": obj.image_url,
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
