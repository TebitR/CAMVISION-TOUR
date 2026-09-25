"""Schémas Pydantic pour le back-office admin."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    slug: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class CategoryOut(CategoryBase):
    id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LocalizedText(BaseModel):
    fr: Optional[str] = None
    en: Optional[str] = None
    es: Optional[str] = None
    de: Optional[str] = None
    zh: Optional[str] = None
    ar: Optional[str] = None


class MonumentCreate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: Dict[str, Any]
    description: Optional[Dict[str, Any]] = None
    history: Optional[Dict[str, Any]] = None
    anecdotes: Optional[Dict[str, Any]] = None
    category: str = Field("artifact", max_length=100)
    image_url: Optional[str] = Field(None, max_length=500)
    audio_story_url: Optional[str] = Field(None, max_length=500)
    region: Optional[str] = Field(None, max_length=100)
    city_name: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    voice_id: Optional[str] = Field(None, max_length=100)
    site_id: Optional[int] = None


class MonumentUpdate(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    name: Optional[Dict[str, Any]] = None
    description: Optional[Dict[str, Any]] = None
    history: Optional[Dict[str, Any]] = None
    anecdotes: Optional[Dict[str, Any]] = None
    category: Optional[str] = Field(None, max_length=100)
    image_url: Optional[str] = Field(None, max_length=500)
    image_urls: Optional[list] = None
    audio_story_url: Optional[str] = Field(None, max_length=500)
    region: Optional[str] = Field(None, max_length=100)
    city_name: Optional[str] = Field(None, max_length=100)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    voice_id: Optional[str] = Field(None, max_length=100)
    site_id: Optional[int] = None


class MonumentOut(BaseModel):
    id: int
    code: Optional[str] = None
    name: Dict[str, Any]
    description: Optional[Dict[str, Any]] = None
    history: Optional[Dict[str, Any]] = None
    anecdotes: Optional[Dict[str, Any]] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[list] = None
    audio_story_url: Optional[str] = None
    region: Optional[str] = None
    city_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    voice_id: Optional[str] = None
    site_id: Optional[int] = None
    vector_id: Optional[str] = None

    model_config = {"from_attributes": True}


class DashboardStats(BaseModel):
    monuments: int
    categories: int
    sites: int
    scans: int
