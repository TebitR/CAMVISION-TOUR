import os
from sqlalchemy.orm import Session
from database import SessionLocal
from models import TouristObject
from vision import get_vision_engine
from main import get_qdrant_client, COLLECTION_NAME
from qdrant_client.models import PointStruct, VectorParams, Distance

# Galerie multi-angles pour améliorer le matching (hors colonne DB)
EXTRA_IMAGES_BY_CODE = {
    "MON-REUNIF-001": [
        "sample_images/monument_reunification.jpg",
        "sample_images/monument_reunification_tour.jpg",
        "sample_images/monument_reunification_statue.jpg",
    ],
}


def resolve_image_bytes(image_url: str):
    possible_paths = [
        image_url,
        os.path.join("/app", image_url),
        os.path.join("/app/backend", image_url),
    ]
    for path in possible_paths:
        if os.path.exists(path) and os.path.isfile(path):
            with open(path, "rb") as f:
                return f.read(), path
    return None, None


def display_name(obj):
    raw = obj.name_fr
    if isinstance(raw, dict):
        return raw.get("fr") or next(iter(raw.values()), "Objet")
    return str(raw) if raw else "Objet"


def reset_collection(client):
    """Purge les vecteurs orphelins (anciens IDs) avant réindexation propre."""
    try:
        client.delete_collection(COLLECTION_NAME)
        print(f"Collection '{COLLECTION_NAME}' supprimée (nettoyage).")
    except Exception as e:
        print(f"Suppression collection (ok si absente): {e}")

    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=VectorParams(size=512, distance=Distance.COSINE),
    )
    print(f"Collection '{COLLECTION_NAME}' recréée (512-dim Cosine).")


def index_tourist_objects():
    db: Session = SessionLocal()
    client = get_qdrant_client()
    vision_engine = get_vision_engine()
    vision_engine.load_model()

    reset_collection(client)

    objects = db.query(TouristObject).all()
    print(f"Trouvé {len(objects)} objet(s) à indexer dans Qdrant...")

    points = []
    for obj in objects:
        name = display_name(obj)
        extras = EXTRA_IMAGES_BY_CODE.get(obj.code, [])
        image_list = []
        if obj.image_url:
            image_list.append(obj.image_url)
        for img in extras:
            if img not in image_list:
                image_list.append(img)

        if not image_list:
            print(f"Aucune image pour : {name}")
            continue

        primary_indexed = False
        for idx, image_url in enumerate(image_list):
            image_bytes, path = resolve_image_bytes(image_url)
            if not image_bytes:
                print(f"Image introuvable pour {name}: {image_url}")
                continue

            vector = vision_engine.extract_image_embedding(image_bytes)
            point_id = obj.id if idx == 0 else obj.id * 1000 + idx

            points.append(
                PointStruct(
                    id=point_id,
                    vector=vector,
                    payload={
                        "object_id": obj.id,
                        "name_fr": name,
                        "site_id": obj.site_id,
                        "category": getattr(obj, "category", "general"),
                        "region": getattr(obj, "region", None),
                        "code": getattr(obj, "code", None),
                        "image_path": image_url,
                    },
                )
            )
            print(f"Vectorisé : {name} ← {path}")
            if idx == 0:
                obj.vector_id = str(obj.id)
                primary_indexed = True

        if not primary_indexed and image_list:
            obj.vector_id = str(obj.id)

    if points:
        client.upsert(collection_name=COLLECTION_NAME, points=points)
        db.commit()
        print(f"Indexation de {len(points)} point(s) terminée dans Qdrant !")
    else:
        print("Aucun point n'a été inséré.")

    db.close()


if __name__ == "__main__":
    index_tourist_objects()
