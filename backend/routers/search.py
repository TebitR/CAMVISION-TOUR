import os

from fastapi import APIRouter, Depends, HTTPException
from qdrant_client import QdrantClient
from sqlalchemy.orm import Session

from database import get_db
from schemas.itinerary import SemanticSearchRequest, SemanticSearchResponse
from services.semantic_search_service import semantic_search_monuments

router = APIRouter(prefix="/api/v1/search", tags=["search"])


def _get_qdrant() -> QdrantClient:
    host = os.getenv("QDRANT_HOST", "vector-db")
    port = int(os.getenv("QDRANT_PORT", "6333"))
    return QdrantClient(host=host, port=port)


@router.post("/semantic", response_model=SemanticSearchResponse)
def semantic_search(body: SemanticSearchRequest, db: Session = Depends(get_db)):
    query = (body.query or "").strip()
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Saisissez une recherche plus précise.")
    try:
        client = _get_qdrant()
        return semantic_search_monuments(
            db=db,
            qdrant_client=client,
            query=query,
            user_lat=body.user_lat,
            user_lng=body.user_lng,
            limit=body.limit,
            lang=body.lang,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recherche sémantique impossible : {e}") from e
