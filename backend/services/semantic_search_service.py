"""Recherche sémantique texte → Qdrant (OpenCLIP) → Postgres."""
from __future__ import annotations

import math
from typing import List, Optional

from sqlalchemy.orm import Session

from models import TouristObject
from schemas.itinerary import SemanticSearchHit, SemanticSearchResponse
from vision import get_vision_engine

COLLECTION_NAME = "camvision_artifacts"


def _haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _lang_key(lang: str) -> str:
    key = (lang or "fr").lower().replace("_", "-").split("-")[0]
    return key if key in ("fr", "en", "es", "de", "zh", "ar") else "fr"


def semantic_search_monuments(
    *,
    db: Session,
    qdrant_client,
    query: str,
    user_lat: Optional[float],
    user_lng: Optional[float],
    limit: int = 8,
    lang: str = "fr",
) -> SemanticSearchResponse:
    vision = get_vision_engine()
    vector = vision.extract_text_embedding(query)
    hits = qdrant_client.search(
        collection_name=COLLECTION_NAME,
        query_vector=vector,
        limit=max(limit * 3, 12),
    )

    lang_k = _lang_key(lang)
    monuments: List[SemanticSearchHit] = []
    seen = set()

    for hit in hits:
        obj_id = hit.payload.get("object_id") or hit.id
        if obj_id in seen:
            continue
        obj = db.query(TouristObject).filter(TouristObject.id == obj_id).first()
        if not obj or obj.latitude is None or obj.longitude is None:
            continue
        seen.add(obj_id)

        dist_km = None
        dist_m = None
        if user_lat is not None and user_lng is not None:
            dist_km = round(_haversine_km(user_lat, user_lng, obj.latitude, obj.longitude), 3)
            dist_m = int(round(dist_km * 1000))

        monuments.append(
            SemanticSearchHit(
                id=obj.id,
                code=obj.code,
                title=obj.localized(obj.name, lang_k, "Monument"),
                category=obj.category or "artifact",
                region=obj.region,
                city=obj.city_name,
                latitude=obj.latitude,
                longitude=obj.longitude,
                distance_km=dist_km,
                distance_m=dist_m,
                image_url=obj.image_url,
                explanation=obj.localized(obj.description, lang_k, ""),
                history=obj.localized(obj.history, lang_k, ""),
                score=round(float(hit.score or 0), 4),
            )
        )
        if len(monuments) >= limit:
            break

    if user_lat is not None and user_lng is not None:
        monuments.sort(key=lambda m: ( -(m.score or 0), m.distance_km or 1e9))

    return SemanticSearchResponse(count=len(monuments), query=query, monuments=monuments)
