from sqlalchemy.orm import Session
from database import SessionLocal
from models import Site, TouristObject
from migrate_enrich import ensure_enriched_columns

DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"


def seed_data():
    try:
        ensure_enriched_columns()
    except Exception as e:
        print(f"Migration: {e}")

    db: Session = SessionLocal()

    # Nettoyage pour éviter les doublons
    db.query(TouristObject).delete()
    db.commit()

    site = db.query(Site).first()
    if not site:
        print("Aucun site trouvé. Exécute d'abord seed.py.")
        db.close()
        return

    objects_data = [
        {
            "code": "MASK-BATCHAM-001",
            "name": {
                "fr": "Masque Batcham",
                "en": "Batcham Mask",
                "de": "Batcham-Maske",
            },
            "description": {
                "fr": "Masque de cérémonie en bois sculpté des Grassfields, symbole de puissance et de protection spirituelle.",
                "en": "Ceremonial carved wooden mask from the Grassfields, a symbol of power and spiritual protection.",
                "de": "Zeremonielle geschnitzte Holzmaske aus den Grassfields, Symbol für Macht und spirituellen Schutz.",
            },
            "history": {
                "fr": "Issu des traditions Bamileké, ce type de masque était porté lors des danses royales et des rites d'intronisation.",
                "en": "From Bamileke traditions, this mask type was worn during royal dances and enthronement rites.",
                "de": "Aus bamileke Traditionen stammend, wurde dieser Maskentyp bei königlichen Tänzen getragen.",
            },
            "anecdotes": {
                "fr": "Les crêtes horizontales du masque évoquent la force du félin et le prestige du chef.",
                "en": "The horizontal ridges evoke feline strength and chiefly prestige.",
                "de": "Die horizontalen Kämme erinnern an feline Kraft und das Prestige des Häuptlings.",
            },
            "category": "masque",
            "image_url": "sample_images/masque_batcham.jpg",
            "region": "Ouest",
            "city_name": "Batcham / Yaoundé",
            "latitude": 5.5167,
            "longitude": 10.4000,
            "voice_id": DEFAULT_VOICE,
        },
        {
            "code": "THRONE-NSANGU-001",
            "name": {
                "fr": "Trône Bamoun du Roi Nsangu",
                "en": "Bamoun Throne of King Nsangu",
                "de": "Bamoun-Thron von König Nsangu",
            },
            "description": {
                "fr": "Siège royal anthropomorphe orné de perles et de cauris, symbole du royaume Bamoun.",
                "en": "Anthropomorphic royal seat adorned with beads and cowries, symbol of the Bamoun kingdom.",
                "de": "Anthropomorpher Königssitz mit Perlen und Kauris, Symbol des Bamoun-Königreichs.",
            },
            "history": {
                "fr": "Attribué au règne du roi Nsangu, ce trône incarne l'autorité politique et spirituelle de Foumban.",
                "en": "Attributed to King Nsangu's reign, this throne embodies political and spiritual authority in Foumban.",
                "de": "Dem König Nsangu zugeschrieben, verkörpert dieser Thron politische und spirituelle Autorität in Foumban.",
            },
            "anecdotes": {
                "fr": "Les cauris représentaient autrefois une monnaie et un signe de richesse royale.",
                "en": "Cowries once served as currency and a mark of royal wealth.",
                "de": "Kauris dienten einst als Währung und Zeichen königlichen Reichtums.",
            },
            "category": "sculpture",
            "image_url": "sample_images/throne_nsangu.jpg",
            "region": "Ouest",
            "city_name": "Foumban / Yaoundé",
            "latitude": 5.7167,
            "longitude": 10.9000,
            "voice_id": DEFAULT_VOICE,
        },
        {
            "code": "MON-REUNIF-001",
            "name": {
                "fr": "Monument de la Réunification",
                "en": "Reunification Monument",
                "de": "Wiedervereinigungsdenkmal",
            },
            "description": {
                "fr": "Le Monument de la Réunification, inauguré en 1974 à Yaoundé, est une œuvre symbolique conçue pour commémorer l’unification du Cameroun francophone et anglophone en 1961. Il se compose d’une tour en spirale imaginée par Mgr Engelbert Mveng et l’architecte Armand Salomon, ainsi qu’une statue monumentale sculptée par Gédéon Mpando.",
                "en": "The Reunification Monument, inaugurated in 1974 in Yaoundé, commemorates the 1961 unification of Francophone and Anglophone Cameroon. It features a spiral tower by Mgr Engelbert Mveng and architect Armand Salomon, and a monumental statue by Gédéon Mpando.",
                "de": "Das 1974 in Yaoundé eingeweihte Wiedervereinigungsdenkmal erinnert an die Vereinigung des frankophonen und anglophonen Kamerun 1961. Es besteht aus einem spiralförmigen Turm von Mgr Engelbert Mveng und Armand Salomon sowie einer Monumentalstatue von Gédéon Mpando.",
            },
            "history": {
                "fr": "Situé au cœur de Yaoundé, ce monument est l’un des symboles les plus forts de l’unité nationale camerounaise. Il rappelle la réunification entre le Cameroun oriental (francophone), devenu indépendant en 1960, et une partie du Cameroun occidental (anglophone) qui a rejoint la République en 1961.",
                "en": "Located in the heart of Yaoundé, it is one of the strongest symbols of Cameroonian national unity, recalling the reunification of East Cameroon (Francophone, independent in 1960) and part of West Cameroon (Anglophone) that joined the Republic in 1961.",
                "de": "Im Herzen Yaoundés gelegen, ist es eines der stärksten Symbole der kamerunischen Einheit und erinnert an die Wiedervereinigung Ostkameruns (frankophon, unabhängig 1960) mit einem Teil Westkameruns (anglophon) 1961.",
            },
            "anecdotes": {
                "fr": "La tour spiralée évoque le chemin vers l’unité ; la statue d’un homme à la torche entouré d’enfants symbolise la transmission aux générations futures.",
                "en": "The spiral tower evokes the path to unity; the torch-bearing man surrounded by children symbolizes transmission to future generations.",
                "de": "Der spiralförmige Turm steht für den Weg zur Einheit; der Mann mit Fackel und Kindern symbolisiert die Weitergabe an künftige Generationen.",
            },
            "category": "monument",
            "image_url": "sample_images/monument_reunification.jpg",
            "extra_images": [
                "sample_images/monument_reunification_tour.jpg",
                "sample_images/monument_reunification_statue.jpg",
            ],
            "region": "Centre",
            "city_name": "Yaoundé",
            "latitude": 3.8667,
            "longitude": 11.5167,
            "voice_id": DEFAULT_VOICE,
        },
    ]

    for obj_info in objects_data:
        obj = TouristObject(
            site_id=site.id,
            code=obj_info["code"],
            name=obj_info["name"],
            description=obj_info["description"],
            history=obj_info["history"],
            anecdotes=obj_info["anecdotes"],
            category=obj_info["category"],
            image_url=obj_info["image_url"],
            region=obj_info["region"],
            city_name=obj_info["city_name"],
            latitude=obj_info["latitude"],
            longitude=obj_info["longitude"],
            voice_id=obj_info["voice_id"],
        )
        db.add(obj)
        print(f"Ajouté : {obj_info['name']['fr']}")

    db.commit()
    db.close()
    print("Seeding patrimonial enrichi terminé.")


if __name__ == "__main__":
    seed_data()
