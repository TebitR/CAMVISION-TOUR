"""Schémas Pydantic — parcours IA & recherche sémantique."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Recherche en langage naturel")
    user_lat: Optional[float] = None
    user_lng: Optional[float] = None
    limit: int = Field(8, ge=1, le=30)
    lang: str = "fr"


class SemanticSearchHit(BaseModel):
    id: int
    code: Optional[str] = None
    title: str
    category: Optional[str] = None
    region: Optional[str] = None
    city: Optional[str] = None
    latitude: float
    longitude: float
    distance_km: Optional[float] = None
    distance_m: Optional[int] = None
    image_url: Optional[str] = None
    explanation: Optional[str] = None
    history: Optional[str] = None
    score: float = 0.0


class SemanticSearchResponse(BaseModel):
    count: int
    query: str
    monuments: List[SemanticSearchHit]


class ItineraryRequest(BaseModel):
    user_lat: float
    user_lng: float
    max_duration_minutes: int = Field(60, ge=15, le=480)
    preferences: List[str] = Field(default_factory=list)
    max_pois: int = Field(6, ge=1, le=12)
    lang: str = "fr"


class POIStep(BaseModel):
    id: int
    title: str
    category: Optional[str] = None
    latitude: float
    longitude: float
    description: Optional[str] = None
    image_url: Optional[str] = None
    estimated_visit_time_minutes: int = 20
    distance_from_previous_meters: int = 0
    order: int = 1


class ItineraryResponse(BaseModel):
    total_distance_meters: float
    total_duration_minutes: float
    waypoints: List[POIStep]
    route_geometry: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
