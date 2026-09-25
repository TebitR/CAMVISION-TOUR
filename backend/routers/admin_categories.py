"""CRUD admin — catégories dynamiques."""
from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models import Category, TouristObject
from schemas.admin import CategoryCreate, CategoryOut, CategoryUpdate
from security import verify_admin_token

router = APIRouter(
    prefix="/api/v1/admin/categories",
    tags=["Admin Categories"],
    dependencies=[Depends(verify_admin_token)],
)


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug, flags=re.UNICODE)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "categorie"


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.name.asc()).all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    slug = _slugify(payload.slug or payload.name)
    if db.query(Category).filter(Category.slug == slug).first():
        raise HTTPException(status_code=400, detail="Ce slug existe déjà")
    if db.query(Category).filter(Category.name == payload.name.strip()).first():
        raise HTTPException(status_code=400, detail="Ce nom existe déjà")
    cat = Category(
        name=payload.name.strip(),
        slug=slug,
        description=(payload.description or "").strip() or None,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    payload: CategoryUpdate,
    db: Session = Depends(get_db),
):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")

    old_slug = cat.slug
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"]:
        cat.name = data["name"].strip()
    if "slug" in data and data["slug"]:
        new_slug = _slugify(data["slug"])
        clash = (
            db.query(Category)
            .filter(Category.slug == new_slug, Category.id != category_id)
            .first()
        )
        if clash:
            raise HTTPException(status_code=400, detail="Ce slug existe déjà")
        cat.slug = new_slug
    if "description" in data:
        cat.description = (data["description"] or "").strip() or None

    # Propager le renommage de slug sur les objets
    if cat.slug != old_slug:
        db.query(TouristObject).filter(TouristObject.category == old_slug).update(
            {TouristObject.category: cat.slug},
            synchronize_session=False,
        )

    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(category_id: int, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == category_id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Catégorie introuvable")

    in_use = (
        db.query(TouristObject)
        .filter(TouristObject.category == cat.slug)
        .count()
    )
    if in_use:
        raise HTTPException(
            status_code=400,
            detail=f"Impossible de supprimer : {in_use} monument(s) utilisent cette catégorie",
        )

    db.delete(cat)
    db.commit()
    return None
