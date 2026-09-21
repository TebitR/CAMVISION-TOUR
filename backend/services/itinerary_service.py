"""Génération d'itinéraire piéton multi-POI (NN + Mapbox Directions)."""
from __future__ import annotations

import math
import os
from typing import List, Optional, Set

import httpx
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models import TouristObject
from schemas.itinerary import ItineraryRequest, ItineraryResponse, POIStep

WALK_M_PER_MIN = 66.67  # ≈ 4 km/h

VISIT_MINUTES_BY_CATEGORY = {
    "monument": 25,
    "histoire": 25,
    "history": 25,
    "masque": 15,
    "sculpture": 15,
    "culture": 18,
    "art": 18,
    "artifact": 15,
    "nature": 30,
    "parc": 30,
    "park": 30,
    "gastronomie": 20,
    "food": 20,
}

PREF_CATEGORY_KEYS = {
    "histoire": ["monument", "histoire", "history", "patrimoine"],
    "history": ["monument", "histoire", "history", "patrimoine"],
    "nature": ["nature", "parc", "park", "jardin", "garden"],
    "culture": ["masque", "sculpture", "culture", "art", "artifact", "musee", "musée"],
    "gastronomie": ["gastronomie", "food", "restaurant", "cuisine"],
    "art": ["masque", "sculpture", "art", "culture"],
}


def _haversine_m(lat1, lon1, lat2, lon2) -> float:
    r = 6371000.0
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


def _visit_minutes(category: Optional[str]) -> int:
    cat = (category or "artifact").lower()
    for key, mins in VISIT_MINUTES_BY_CATEGORY.items():
        if key in cat:
            return mins
    return 20


def _matches_preferences(category: Optional[str], preferences: List[str]) -> bool:
    if not preferences:
        return True
    cat = (category or "").lower()
    for pref in preferences:
        keys = PREF_CATEGORY_KEYS.get(pref.lower().strip(), [pref.lower().strip()])
        if any(k in cat for k in keys):
            return True
    return False


def _fetch_mapbox_walking_geojson(coords_lng_lat: List[tuple]) -> Optional[dict]:
    token = (os.getenv("MAPBOX_ACCESS_TOKEN") or "").strip()
    if not token or token.startswith("votre_"):
        return None
    if len(coords_lng_lat) < 2:
        return None

    path = ";".join(f"{lng},{lat}" for lng, lat in coords_lng_lat)
    url = (
        f"https://api.mapbox.com/directions/v5/mapbox/walking/{path}"
        f"?geometries=geojson&overview=full&access_token={token}"
    )
    try:
        with httpx.Client(timeout=25.0) as client:
            r = client.get(url)
            r.raise_for_status()
            data = r.json()
        route = (data.get("routes") or [None])[0]
        if not route:
            return None
        return {
            "type": "Feature",
            "geometry": route.get("geometry"),
            "properties": {
                "distance": route.get("distance"),
                "duration": route.get("duration"),
            },
        }
    except Exception as e:
        print(f"Mapbox itinerary: {e}")
        return None


def generate_itinerary(db: Session, req: ItineraryRequest) -> ItineraryResponse:
    if req.max_duration_minutes < 15:
        raise HTTPException(
            status_code=400,
            detail="Augmentez la durée disponible (minimum 15 min) pour trouver des lieux à visiter.",
        )

    lang = _lang_key(req.lang)
    objects = (
        db.query(TouristObject)
        .filter(TouristObject.latitude.isnot(None), TouristObject.longitude.isnot(None))
        .all()
    )

    candidates = [
        o for o in objects if _matches_preferences(o.category, req.preferences or [])
    ]
    if not candidates:
        # Fallback : tous les POI si les préférences ne matchent rien (ex. Gastronomie)
        candidates = list(objects)

    if not candidates:
        raise HTTPException(
            status_code=404,
            detail="Aucun monument disponible. Réessayez avec d'autres thématiques ou une durée plus longue.",
        )

    remaining = float(req.max_duration_minutes)
    cur_lat, cur_lng = req.user_lat, req.user_lng
    used: Set[int] = set()
    steps: List[POIStep] = []
    total_walk_m = 0.0

    while len(steps) < req.max_pois and remaining > 5:
        best = None
        best_dist = float("inf")
        for obj in candidates:
            if obj.id in used:
                continue
            d = _haversine_m(cur_lat, cur_lng, obj.latitude, obj.longitude)
            if d < best_dist:
                best_dist = d
                best = obj
        if not best:
            break

        walk_min = best_dist / WALK_M_PER_MIN
        visit_min = _visit_minutes(best.category)
        needed = walk_min + visit_min
        if needed > remaining and steps:
            break
        if needed > remaining and not steps:
            # Au moins un POI si possible en réduisant la visite
            if walk_min + 10 > remaining:
                break
            visit_min = max(10, int(remaining - walk_min))

        used.add(best.id)
        remaining -= needed
        total_walk_m += best_dist
        steps.append(
            POIStep(
                id=best.id,
                title=best.localized(best.name, lang, "Monument"),
                category=best.category or "artifact",
                latitude=best.latitude,
                longitude=best.longitude,
                description=best.localized(best.description, lang, ""),
                image_url=best.image_url,
                estimated_visit_time_minutes=visit_min,
                distance_from_previous_meters=int(round(best_dist)),
                order=len(steps) + 1,
            )
        )
        cur_lat, cur_lng = best.latitude, best.longitude

    if not steps:
        raise HTTPException(
            status_code=404,
            detail="Aucun lieu ne tient dans cette durée. Augmentez la durée disponible pour trouver des lieux à visiter.",
        )

    coords = [(req.user_lng, req.user_lat)] + [(s.longitude, s.latitude) for s in steps]
    geo = _fetch_mapbox_walking_geojson(coords)

    mapbox_distance = total_walk_m
    mapbox_duration_min = total_walk_m / WALK_M_PER_MIN + sum(
        s.estimated_visit_time_minutes for s in steps
    )
    if geo and geo.get("properties"):
        if geo["properties"].get("distance") is not None:
            mapbox_distance = float(geo["properties"]["distance"])
        if geo["properties"].get("duration") is not None:
            walk_only = float(geo["properties"]["duration"]) / 60.0
            mapbox_duration_min = walk_only + sum(
                s.estimated_visit_time_minutes for s in steps
            )

    return ItineraryResponse(
        total_distance_meters=round(mapbox_distance, 1),
        total_duration_minutes=round(mapbox_duration_min, 1),
        waypoints=steps,
        route_geometry=geo,
        message=None,
    )
