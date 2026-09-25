from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, DateTime, JSON, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base

class UserRole(str, enum.Enum):
    TOURIST = "tourist"
    GUIDE = "guide"
    ADMIN = "admin"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)
    username = Column(String(100), unique=True, index=True, nullable=True)
    role = Column(String(20), default=UserRole.TOURIST)
    
    preferred_language = Column(String(10), default="fr")
    interests = Column(JSON, default=list)
    detail_level = Column(String(20), default="standard")
    
    created_at = Column(DateTime, default=datetime.utcnow)
    scans = relationship("ScanHistory", back_populates="user")

class Region(Base):
    __tablename__ = "regions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    country_code = Column(String(5), default="CM")
    
    cities = relationship("City", back_populates="region")

class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    region_id = Column(Integer, ForeignKey("regions.id"))
    name = Column(String(100), nullable=False)
    
    region = relationship("Region", back_populates="cities")
    sites = relationship("Site", back_populates="city")

class Site(Base):
    __tablename__ = "sites"

    id = Column(Integer, primary_key=True, index=True)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=True)
    
    name = Column(JSON, nullable=False)
    category = Column(String(50), index=True)
    description = Column(JSON)
    history_text = Column(JSON)
    
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    
    city = relationship("City", back_populates="sites")
    zones = relationship("Zone", back_populates="site")
    objects = relationship("TouristObject", back_populates="site")

class Zone(Base):
    __tablename__ = "zones"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"))
    name = Column(JSON, nullable=False)
    
    site = relationship("Site", back_populates="zones")
    objects = relationship("TouristObject", back_populates="zone")

class TouristObject(Base):
    __tablename__ = "objects"

    id = Column(Integer, primary_key=True, index=True)
    site_id = Column(Integer, ForeignKey("sites.id"))
    zone_id = Column(Integer, ForeignKey("zones.id"), nullable=True)

    code = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(JSON, nullable=False)
    description = Column(JSON)
    history = Column(JSON)
    anecdotes = Column(JSON)
    category = Column(String(100), default="artifact", index=True)
    image_url = Column(String(500), nullable=True)
    image_urls = Column(JSON, default=list)  # galerie [{url} ou strings]
    audio_story_url = Column(String(500), nullable=True)

    region = Column(String(100), nullable=True)
    city_name = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    voice_id = Column(String(100), nullable=True)
    vector_id = Column(String(100), unique=True, index=True)
    
    site = relationship("Site", back_populates="objects")
    zone = relationship("Zone", back_populates="objects")

    @property
    def name_fr(self):
        if isinstance(self.name, dict):
            return self.name.get("fr") or next(iter(self.name.values()), "Objet")
        return str(self.name) if self.name else "Objet"

    def localized(self, field, lang: str, fallback: str = "") -> str:
        if not isinstance(field, dict):
            return field or fallback
        return field.get(lang) or field.get("fr") or field.get("en") or fallback

class Category(Base):
    """Catégories dynamiques pour le back-office (slug stocké sur TouristObject.category)."""

    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    object_id = Column(Integer, ForeignKey("objects.id"))
    latitude = Column(Float)
    longitude = Column(Float)
    scanned_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="scans")
