from sqlalchemy.orm import Session
from database import SessionLocal
from models import Site, TouristObject

def seed_data():
    db: Session = SessionLocal()
    
    # Nettoyage des anciens objets
    db.query(TouristObject).delete()
    db.commit()

    site = db.query(Site).first()
    if not site:
        print("Aucun site trouvé. Exécute d'abord seed.py.")
        db.close()
        return

    img1 = "sample_images/throne_nsangu.jpg"
    img2 = "sample_images/masque_batcham.jpg"

    objects_data = [
        {
            "name": {"fr": "Trône Bamoun du Roi Nsangu", "en": "Bamoun Throne of King Nsangu"},
            "description": {"fr": "Siège royal anthropomorphe orné de perles et de cauris.", "en": "Royal anthropomorphic seat decorated with beads."},
            "category": "Sculpture",
            "image_url": img1
        },
        {
            "name": {"fr": "Masque Batcham", "en": "Batcham Mask"},
            "description": {"fr": "Masque de cérémonie en bois sculpté des Grassfields.", "en": "Carved wooden ceremonial mask from the Grassfields."},
            "category": "Masque",
            "image_url": img2
        }
    ]

    for obj_info in objects_data:
        obj = TouristObject(
            site_id=site.id,
            name=obj_info["name"],
            description=obj_info["description"],
            category=obj_info["category"],
            image_url=obj_info["image_url"]
        )
        db.add(obj)
        print(f"Ajouté : {obj_info['name']['fr']}")
            
    db.commit()
    db.close()
    print("Seeding réinitialisé avec 2 objets.")

if __name__ == "__main__":
    seed_data()
