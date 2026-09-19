import os
import math
from fastapi import FastAPI, Depends, File, UploadFile, HTTPException, Query
from sqlalchemy.orm import Session
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance
from database import engine, Base, get_db
from models import Site, User, TouristObject
from vision import get_vision_engine

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CAMVISION TOUR API",
    version="1.0.0",
    description="Backend Orchestrateur - Vision, GPS & IA Contextuelle"
)

QDRANT_HOST = os.getenv("QDRANT_HOST", "vector-db")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))
COLLECTION_NAME = "camvision_artifacts"


def get_qdrant_client() -> QdrantClient:
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)


def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0  # Rayon de la Terre en km
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
    return {"status": "online", "project": "CAMVISION TOUR", "version": "1.0.0"}

@app.get("/health")
def health_check():
    client = get_qdrant_client()
    return {
        "postgres": "ready",
        "qdrant": COLLECTION_NAME,
        "vision_engine": "OpenCLIP ViT-B/32",
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
            
    return {"count": len(nearby), "sites": nearby}

@app.post("/api/vision/extract")
async def extract_vector(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Le fichier fourni doit être une image.")
    
    image_bytes = await file.read()
    engine = get_vision_engine()
    vector = engine.extract_image_embedding(image_bytes)
    
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
        # 1. Lecture de l'image uploadée
        image_bytes = await file.read()
        
        # 2. Extraction du vecteur embedding OpenCLIP (512-D)
        vision_engine = get_vision_engine()
        query_vector = vision_engine.extract_image_embedding(image_bytes)
        
        # 3. Interrogation de Qdrant pour trouver les plus proches voisins
        client = get_qdrant_client()
        search_result = client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=limit
        )
        
        # 4. Enrichissement des résultats avec les données PostgreSQL
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
                
        return {
            "success": True,
            "count": len(results),
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la recherche visuelle : {str(e)}")
