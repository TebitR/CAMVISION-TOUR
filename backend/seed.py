import os
from sqlalchemy.orm import Session
from database import engine, SessionLocal, Base
from models import Region, City, Site, TouristObject

def seed_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    try:
        if db.query(Region).first():
            print("Données de test déjà présentes.")
            return

        print("Injection des données de test pour le Cameroun...")
        
        region_centre = Region(name="Centre", country_code="CM")
        db.add(region_centre)
        db.commit()

        city_yaounde = City(name="Yaoundé", region_id=region_centre.id)
        db.add(city_yaounde)
        db.commit()

        musee_national = Site(
            city_id=city_yaounde.id,
            name={"fr": "Musée National du Cameroun", "en": "National Museum of Cameroon"},
            category="Musée",
            description={
                "fr": "Ancien palais présidentiel abritant l'histoire et les artefacts culturels des dix régions du Cameroun.",
                "en": "Former presidential palace housing history and cultural artifacts from the ten regions of Cameroon."
            },
            history_text={
                "fr": "Construit dans les années 1930, il est le symbole de la mémoire nationale.",
                "en": "Built in the 1930s, it stands as the symbol of national heritage."
            },
            latitude=3.8667,
            longitude=11.5167
        )
        db.add(musee_national)
        db.commit()

        print("Seeding terminé avec succès !")
    except Exception as e:
        print(f"Erreur durant le seeding : {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
