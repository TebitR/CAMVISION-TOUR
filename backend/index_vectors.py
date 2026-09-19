import os
from sqlalchemy.orm import Session
from database import SessionLocal
from models import TouristObject
from vision import get_vision_engine
from main import get_qdrant_client, COLLECTION_NAME
from qdrant_client.models import PointStruct

def index_tourist_objects():
    db: Session = SessionLocal()
    client = get_qdrant_client()
    vision_engine = get_vision_engine()
    
    vision_engine.load_model()
    
    objects = db.query(TouristObject).all()
    print(f"Trouvé {len(objects)} objet(s) à indexer dans Qdrant...")
    
    points = []
    for obj in objects:
        image_bytes = None
        
        if obj.image_url:
            # Tester le chemin tel quel, puis relatif au dossier /app
            possible_paths = [
                obj.image_url,
                os.path.join("/app", obj.image_url),
                os.path.join("/app/backend", obj.image_url)
            ]
            
            for path in possible_paths:
                if os.path.exists(path) and os.path.isfile(path):
                    with open(path, "rb") as f:
                        image_bytes = f.read()
                    print(f"Image trouvée pour {obj.name_fr} sur le chemin : {path}")
                    break

        if image_bytes:
            vector = vision_engine.extract_image_embedding(image_bytes)
            obj.vector_id = str(obj.id)
            
            points.append(
                PointStruct(
                    id=obj.id,
                    vector=vector,
                    payload={
                        "object_id": obj.id,
                        "name_fr": obj.name_fr,
                        "site_id": obj.site_id,
                        "category": obj.category
                    }
                )
            )
            print(f"Vectorisé avec succès : {obj.name_fr}")
        else:
            print(f"Aucune image valide trouvée sur le disque pour : {obj.name_fr} (chemin cherché: {obj.image_url})")
            
    if points:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
        db.commit()
        print(f"Indexation de {len(points)} point(s) terminée dans Qdrant !")
    else:
        print("Aucun point n'a été inséré.")
        
    db.close()

if __name__ == "__main__":
    index_tourist_objects()
