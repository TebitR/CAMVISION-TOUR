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

    db.query(TouristObject).delete()
    db.commit()

    site = db.query(Site).first()
    if not site:
        print("Aucun site trouvé. Exécute d'abord seed.py.")
        db.close()
        return

    # Noms : on traduit le type (Masque/Trône/Monument), les noms propres restent
    objects_data = [
        {
            "code": "MASK-BATCHAM-001",
            "name": {
                "fr": "Masque Batcham",
                "en": "Batcham Mask",
                "es": "Máscara Batcham",
                "de": "Batcham-Maske",
                "zh": "面具 Batcham",
                "ar": "قناع Batcham",
            },
            "description": {
                "fr": "Masque de cérémonie en bois sculpté des Grassfields, symbole de puissance et de protection spirituelle.",
                "en": "Ceremonial carved wooden mask from the Grassfields, a symbol of power and spiritual protection.",
                "es": "Máscara ceremonial de madera tallada de los Grassfields, símbolo de poder y protección espiritual.",
                "de": "Zeremonielle geschnitzte Holzmaske aus den Grassfields, Symbol für Macht und spirituellen Schutz.",
                "zh": "来自 Grassfields 的仪式木雕面具，象征力量与精神守护。",
                "ar": "قناع احتفالي من الخشب المنحوت من منطقة Grassfields، رمز للقوة والحماية الروحية.",
            },
            "history": {
                "fr": "Issu des traditions Bamileké, ce type de masque était porté lors des danses royales et des rites d'intronisation.",
                "en": "From Bamileke traditions, this mask type was worn during royal dances and enthronement rites.",
                "es": "De las tradiciones Bamileké, este tipo de máscara se usaba en danzas reales y ritos de entronización.",
                "de": "Aus bamileke Traditionen stammend, wurde dieser Maskentyp bei königlichen Tänzen und Inthronisationsriten getragen.",
                "zh": "源自 Bamileké 传统，这类面具在王室舞蹈与登基仪式上佩戴。",
                "ar": "من تقاليد Bamileké، كان هذا النوع من الأقنعة يُلبس في الرقصات الملكية وطقوس التنصيب.",
            },
            "anecdotes": {
                "fr": "Les crêtes horizontales du masque évoquent la force du félin et le prestige du chef.",
                "en": "The horizontal ridges evoke feline strength and chiefly prestige.",
                "es": "Las crestas horizontales evocan la fuerza del felino y el prestigio del jefe.",
                "de": "Die horizontalen Kämme erinnern an feline Kraft und das Prestige des Häuptlings.",
                "zh": "水平脊纹象征猫科动物的力量与酋长的威望。",
                "ar": "النتوءات الأفقية ترمز إلى قوة القطبة وهيبة الزعيم.",
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
                "es": "Trono Bamoun del Rey Nsangu",
                "de": "Bamoun-Thron von König Nsangu",
                "zh": "Bamoun 国王 Nsangu 的宝座",
                "ar": "عرش Bamoun للملك Nsangu",
            },
            "description": {
                "fr": "Siège royal anthropomorphe orné de perles et de cauris, symbole du royaume Bamoun.",
                "en": "Anthropomorphic royal seat adorned with beads and cowries, symbol of the Bamoun kingdom.",
                "es": "Asiento real antropomorfo adornado con cuentas y cauríes, símbolo del reino Bamoun.",
                "de": "Anthropomorpher Königssitz mit Perlen und Kauris, Symbol des Bamoun-Königreichs.",
                "zh": "饰有珠饰与贝壳的拟人王椅，象征 Bamoun 王国。",
                "ar": "مقعد ملكي مجسّم مزيّن بالخرز والقواقع، رمز مملكة Bamoun.",
            },
            "history": {
                "fr": "Attribué au règne du roi Nsangu, ce trône incarne l'autorité politique et spirituelle de Foumban.",
                "en": "Attributed to King Nsangu's reign, this throne embodies political and spiritual authority in Foumban.",
                "es": "Atribuido al reinado del rey Nsangu, este trono encarna la autoridad política y espiritual de Foumban.",
                "de": "Dem König Nsangu zugeschrieben, verkörpert dieser Thron politische und spirituelle Autorität in Foumban.",
                "zh": "归于国王 Nsangu 统治时期，这座宝座体现 Foumban 的政治与精神权威。",
                "ar": "يُنسب إلى عهد الملك Nsangu، ويجسّد هذا العرش السلطة السياسية والروحية في Foumban.",
            },
            "anecdotes": {
                "fr": "Les cauris représentaient autrefois une monnaie et un signe de richesse royale.",
                "en": "Cowries once served as currency and a mark of royal wealth.",
                "es": "Los cauríes fueron antaño moneda y señal de riqueza real.",
                "de": "Kauris dienten einst als Währung und Zeichen königlichen Reichtums.",
                "zh": "贝壳曾作为货币，也是王室财富的标志。",
                "ar": "كانت القواقع عملة قديماً وعلامة على الثروة الملكية.",
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
                "es": "Monumento de la Reunificación",
                "de": "Wiedervereinigungsdenkmal",
                "zh": "统一纪念碑",
                "ar": "نصب إعادة التوحيد",
            },
            "description": {
                "fr": "Le Monument de la Réunification, inauguré en 1974 à Yaoundé, est une œuvre symbolique conçue pour commémorer l’unification du Cameroun francophone et anglophone en 1961. Il se compose d’une tour en spirale imaginée par Mgr Engelbert Mveng et l’architecte Armand Salomon, ainsi qu’une statue monumentale sculptée par Gédéon Mpando.",
                "en": "The Reunification Monument, inaugurated in 1974 in Yaoundé, commemorates the 1961 unification of Francophone and Anglophone Cameroon. It features a spiral tower by Mgr Engelbert Mveng and architect Armand Salomon, and a monumental statue by Gédéon Mpando.",
                "es": "El Monumento de la Reunificación, inaugurado en 1974 en Yaoundé, conmemora la unificación de Camerún francófono y anglófono en 1961. Incluye una torre espiral de Mgr Engelbert Mveng y el arquitecto Armand Salomon, y una estatua monumental de Gédéon Mpando.",
                "de": "Das 1974 in Yaoundé eingeweihte Wiedervereinigungsdenkmal erinnert an die Vereinigung des frankophonen und anglophonen Kamerun 1961. Es besteht aus einem spiralförmigen Turm von Mgr Engelbert Mveng und Armand Salomon sowie einer Monumentalstatue von Gédéon Mpando.",
                "zh": "统一纪念碑于 1974 年在 Yaoundé 落成，纪念 1961 年法语区与英语区喀麦隆的统一。它包括 Mgr Engelbert Mveng 与建筑师 Armand Salomon 设计的螺旋塔，以及 Gédéon Mpando 雕刻的纪念雕像。",
                "ar": "نُصُب إعادة التوحيد، الذي افتُتح عام 1974 في Yaoundé، عمل رمزي لتخليد توحيد الكاميرون الناطقة بالفرنسية والإنجليزية عام 1961. يتألف من برج حلزوني من تصميم Mgr Engelbert Mveng والمهندس Armand Salomon، وتمثال ضخم نحته Gédéon Mpando.",
            },
            "history": {
                "fr": "Situé au cœur de Yaoundé, ce monument est l’un des symboles les plus forts de l’unité nationale camerounaise. Il rappelle la réunification entre le Cameroun oriental (francophone), devenu indépendant en 1960, et une partie du Cameroun occidental (anglophone) qui a rejoint la République en 1961.",
                "en": "Located in the heart of Yaoundé, it is one of the strongest symbols of Cameroonian national unity, recalling the reunification of East Cameroon (Francophone, independent in 1960) and part of West Cameroon (Anglophone) that joined the Republic in 1961.",
                "es": "Situado en el corazón de Yaoundé, es uno de los símbolos más fuertes de la unidad nacional camerunesa. Recuerda la reunificación del Camerún oriental (francófono), independiente en 1960, y parte del Camerún occidental (anglófono) que se unió a la República en 1961.",
                "de": "Im Herzen Yaoundés gelegen, ist es eines der stärksten Symbole der kamerunischen Einheit und erinnert an die Wiedervereinigung Ostkameruns (frankophon, unabhängig 1960) mit einem Teil Westkameruns (anglophon) 1961.",
                "zh": "位于 Yaoundé 市中心，是喀麦隆国家统一最有力的象征之一，纪念 1960 年独立的东喀麦隆（法语区）与 1961 年加入共和国的西喀麦隆部分（英语区）的统一。",
                "ar": "يقع في قلب Yaoundé، وهو من أقوى رموز الوحدة الوطنية الكاميرونية. يذكّر بإعادة توحيد الكاميرون الشرقي (الناطق بالفرنسية) الذي استقل عام 1960، وجزء من الكاميرون الغربي (الناطق بالإنجليزية) الذي انضم إلى الجمهورية عام 1961.",
            },
            "anecdotes": {
                "fr": "La tour spiralée évoque le chemin vers l’unité ; la statue d’un homme à la torche entouré d’enfants symbolise la transmission aux générations futures.",
                "en": "The spiral tower evokes the path to unity; the torch-bearing man surrounded by children symbolizes transmission to future generations.",
                "es": "La torre espiral evoca el camino hacia la unidad; la estatua de un hombre con antorcha rodeado de niños simboliza la transmisión a las generaciones futuras.",
                "de": "Der spiralförmige Turm steht für den Weg zur Einheit; der Mann mit Fackel und Kindern symbolisiert die Weitergabe an künftige Generationen.",
                "zh": "螺旋塔象征通往团结之路；手持火炬、被孩子们环绕的雕像象征向后代传承。",
                "ar": "يرمز البرج الحلزوني إلى طريق الوحدة؛ وتمثال الرجل ذي الشعلة المحاط بالأطفال يرمز إلى نقل الإرث للأجيال القادمة.",
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
    print("Seeding patrimonial enrichi (fr/en/es/de/zh/ar) terminé.")


if __name__ == "__main__":
    seed_data()
