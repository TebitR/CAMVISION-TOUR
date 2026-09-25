"""Indexation incrémentale OpenCLIP → Qdrant pour un lieu admin."""
from __future__ import annotations

import os
from urllib.parse import urlparse
from urllib.request import urlopen

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    VectorParams,
)

from vision import get_vision_engine

COLLECTION_NAME = "camvision_artifacts"

EXTRA_IMAGES_BY_CODE = {
    "MON-REUNIF-001": [
        "sample_images/monument_reunification.jpg",
        "sample_images/monument_reunification_tour.jpg",
        "sample_images/monument_reunification_statue.jpg",
    ],
}


def get_qdrant_client() -> QdrantClient:
    host = os.getenv("QDRANT_HOST", "vector-db")
    port = int(os.getenv("QDRANT_PORT", "6333"))
    return QdrantClient(host=host, port=port)


def _backend_root() -> str:
    return os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _read_local(rel: str):
    rel = (rel or "").replace("\\", "/").lstrip("/")
    if not rel:
        return None, None
    candidates = [
        rel,
        os.path.join(os.getcwd(), rel),
        os.path.join(_backend_root(), rel),
        os.path.join("/app", rel),
        os.path.join("/app/backend", rel),
    ]
    for path in candidates:
        path = os.path.normpath(path)
        if os.path.isfile(path):
            with open(path, "rb") as f:
                return f.read(), path
    return None, None


def resolve_image_bytes(image_url: str):
    if not image_url:
        return None, None
    url = str(image_url).strip()
    if url.startswith(("http://", "https://")):
        parsed = urlparse(url)
        local, path = _read_local(parsed.path)
        if local:
            return local, path
        try:
            with urlopen(url, timeout=12) as resp:
                return resp.read(), url
        except Exception as e:
            print(f"Téléchargement image échoué ({url}): {e}")
            return None, None
    return _read_local(url)


def gallery_paths(obj) -> list[str]:
    paths: list[str] = []

    def add(url: str | None):
        if not url:
            return
        u = str(url).strip()
        if u and u not in paths:
            paths.append(u)

    raw = getattr(obj, "image_urls", None)
    if isinstance(raw, list):
        for item in raw:
            if isinstance(item, str):
                add(item)
            elif isinstance(item, dict):
                add(item.get("url"))
    add(getattr(obj, "image_url", None))
    for extra in EXTRA_IMAGES_BY_CODE.get(getattr(obj, "code", None) or "", []):
        add(extra)
    return paths


def _ensure_collection(client: QdrantClient):
    names = [c.name for c in client.get_collections().collections]
    if COLLECTION_NAME not in names:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=512, distance=Distance.COSINE),
        )
    try:
        client.create_payload_index(
            collection_name=COLLECTION_NAME,
            field_name="object_id",
            field_schema="integer",
        )
    except Exception:
        pass


def _display_name(obj) -> str:
    raw = getattr(obj, "name_fr", None) or getattr(obj, "name", None)
    if isinstance(raw, dict):
        return raw.get("fr") or next(iter(raw.values()), "Lieu")
    return str(raw) if raw else "Lieu"


def _point_ids_for(object_id: int, n: int = 80) -> list[int]:
    ids = [int(object_id)]
    for idx in range(1, n):
        ids.append(int(object_id) * 1000 + idx)
        ids.append(int(object_id) * 10000 + idx)
    return ids


def delete_object_vectors(object_id: int) -> None:
    if object_id is None:
        return
    client = get_qdrant_client()
    _ensure_collection(client)
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=_point_ids_for(int(object_id)),
        )
    except Exception as e:
        print(f"Qdrant delete ids object_id={object_id}: {e}")
    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="object_id",
                        match=MatchValue(value=int(object_id)),
                    )
                ]
            ),
        )
    except Exception as e:
        print(f"Qdrant delete filter object_id={object_id}: {e}")


def index_tourist_object(obj, db=None) -> int:
    """Vectorise toutes les images du lieu. Retourne le nombre de points upsert."""
    paths = gallery_paths(obj)
    client = get_qdrant_client()
    _ensure_collection(client)
    delete_object_vectors(obj.id)

    if not paths:
        if db is not None:
            obj.vector_id = None
            db.add(obj)
            db.commit()
        return 0

    vision = get_vision_engine()
    name = _display_name(obj)
    points: list[PointStruct] = []
    for idx, image_url in enumerate(paths):
        image_bytes, path = resolve_image_bytes(image_url)
        if not image_bytes:
            print(f"Image introuvable pour {name}: {image_url}")
            continue
        vector = vision.extract_image_embedding(image_bytes)
        point_id = int(obj.id) if idx == 0 else int(obj.id) * 10000 + idx
        points.append(
            PointStruct(
                id=point_id,
                vector=vector,
                payload={
                    "object_id": int(obj.id),
                    "name_fr": name,
                    "site_id": obj.site_id,
                    "category": getattr(obj, "category", None),
                    "region": getattr(obj, "region", None),
                    "code": getattr(obj, "code", None),
                    "image_path": image_url,
                },
            )
        )
        print(f"Indexé : {name} ← {path}")

    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        obj.vector_id = str(obj.id)
        if db is not None:
            db.add(obj)
            db.commit()
    elif db is not None:
        obj.vector_id = None
        db.add(obj)
        db.commit()
    return len(points)


def ensure_indexed(db=None) -> int:
    """Indexe les lieux qui ont des photos mais pas encore de vecteur (ou Qdrant vide)."""
    close = False
    if db is None:
        from database import SessionLocal
        from models import TouristObject

        db = SessionLocal()
        close = True
    else:
        from models import TouristObject

    total = 0
    try:
        client = get_qdrant_client()
        _ensure_collection(client)
        try:
            count = client.count(COLLECTION_NAME).count
        except Exception:
            count = 0
        objects = db.query(TouristObject).all()
        for obj in objects:
            if not gallery_paths(obj):
                continue
            if count > 0 and obj.vector_id:
                continue
            total += index_tourist_object(obj, db)
        print(f"Index vision (ensure): {total} point(s)")
        return total
    finally:
        if close:
            db.close()
