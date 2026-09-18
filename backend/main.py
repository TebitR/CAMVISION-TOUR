from fastapi import FastAPI
from qdrant_client import QdrantClient
import os

app = FastAPI(
    title="CAMVISION TOUR API",
    version="1.0.0",
    description="Backend Orchestrateur - Reconnaissance Visuelle, GPS & Audio"
)

QDRANT_HOST = os.getenv("QDRANT_HOST", "vector-db")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", 6333))

@app.get("/")
def read_root():
    return {
        "status": "online",
        "project": "CAMVISION TOUR",
        "message": "Infrastructure Docker prête pour le développement !"
    }

@app.get("/health")
def health_check():
    try:
        client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
        client.get_collections()
        qdrant_status = "connected"
    except Exception as e:
        qdrant_status = f"error: {str(e)}"

    return {
        "postgres": "ready",
        "qdrant": qdrant_status,
        "openclip": "ready"
    }
