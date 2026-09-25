"""CRUD admin — lieux patrimoniaux (TouristObject)."""
from __future__ import annotations

import io
import json
import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

from PIL import Image, UnidentifiedImageError

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from database import get_db
from models import Category, ScanHistory, Site, TouristObject
from schemas.admin import DashboardStats, MonumentOut, MonumentUpdate
from security import verify_admin_token
from services.vision_index import delete_object_vectors, index_tourist_object

router = APIRouter(
    prefix="/api/v1/admin",
    tags=["Admin Lieux"],
    dependencies=[Depends(verify_admin_token)],
)

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "sample_images" / "uploads"
ALLOWED_IMAGE_EXT = {
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".gif",
    ".jfif",
    ".heic",
    ".heif",
    ".avif",
    ".bmp",
}
CONTENT_TYPE_EXT = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/pjpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif",
    "image/avif": ".avif",
    "image/bmp": ".bmp",
}


def _parse_coord(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip().replace(",", ".")
    if not text or text.lower() in ("nan", "undefined", "null"):
        return None
    try:
        return float(text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Coordonnée invalide: {value}") from exc


def _is_upload(item) -> bool:
    return (
        item is not None
        and not isinstance(item, (str, bytes))
        and hasattr(item, "read")
        and hasattr(item, "filename")
    )


def _as_uploads(files) -> list:
    if not files:
        return []
    if isinstance(files, list):
        return [f for f in files if _is_upload(f)]
    if _is_upload(files):
        return [files]
    return []


def _form_str(form, key: str, default: Optional[str] = None) -> Optional[str]:
    value = form.get(key)
    if value is None:
        return default
    if isinstance(value, UploadFile):
        return default
    text = str(value)
    return text if text != "" or default is None else default


async def _images_from_form(form) -> list[UploadFile]:
    keys = ("images", "images[]", "image", "file", "files")
    files: list[UploadFile] = []
    seen: set[int] = set()

    def add(item) -> None:
        is_file = hasattr(item, "filename") and hasattr(item, "read") and not isinstance(
            item, (str, bytes)
        )
        if not is_file:
            return
        ident = id(item)
        if ident in seen:
            return
        if not (getattr(item, "filename", None) or getattr(item, "content_type", None)):
            return
        seen.add(ident)
        files.append(item)

    for key in keys:
        for item in form.getlist(key):
            add(item)
    if not files:
        for _, value in form.multi_items():
            add(value)

    if files:
        print(f"Uploads reçus: {[f.filename for f in files]}")
    return files


def _file_ext(file: UploadFile) -> str:
    ext = Path(file.filename or "").suffix.lower()
    if ext in ALLOWED_IMAGE_EXT:
        return ext
    guessed = CONTENT_TYPE_EXT.get((file.content_type or "").split(";")[0].strip().lower())
    if guessed:
        return guessed
    return ext


def _title_fr_from_str(title: str) -> dict:
    t = (title or "").strip()
    if not t:
        raise HTTPException(status_code=400, detail="Le titre (FR) est requis")
    return {"fr": t}


def _slugify(value: str) -> str:
    slug = value.strip().lower()
    slug = re.sub(r"[^\w\s-]", "", slug, flags=re.UNICODE)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug or "lieu"


def _auto_code(db: Session, title: str, category: str) -> str:
    cat = (category or "lieu").strip().lower()[:8] or "lieu"
    base = _slugify(title)[:28] or "item"
    candidate = f"{cat}-{base}"[:50]
    n = 1
    code = candidate
    while db.query(TouristObject).filter(TouristObject.code == code).first():
        n += 1
        code = f"{candidate}-{n}"[:50]
    return code


def _default_site_id(db: Session) -> int:
    site = db.query(Site).order_by(Site.id.asc()).first()
    if not site:
        raise HTTPException(
            status_code=400,
            detail="Aucun site de rattachement. Lancez d'abord le seed (seed.py).",
        )
    return site.id


def _existing_from_form(form) -> list[str]:
    raw = _form_str(form, "existing_images")
    if raw is None:
        return []
    try:
        return _normalize_gallery(json.loads(raw or "[]"))
    except json.JSONDecodeError:
        return []


def _normalize_gallery(raw) -> list:
    if not raw:
        return []
    if isinstance(raw, list):
        out = []
        for item in raw:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
            elif isinstance(item, dict) and item.get("url"):
                out.append(str(item["url"]).strip())
        return out
    return []


def _try_index(obj: TouristObject, db: Session, context: str) -> int:
    try:
        n = index_tourist_object(obj, db)
        print(f"Index vision ({context} {obj.id}): {n} point(s)")
        return n
    except Exception as e:
        import traceback

        print(f"Index vision ({context} {obj.id}): {e}")
        traceback.print_exc()
        return 0


def _serialize(obj: TouristObject) -> MonumentOut:
    gallery = _normalize_gallery(obj.image_urls)
    if obj.image_url and obj.image_url not in gallery:
        gallery = [obj.image_url, *gallery]
    data = MonumentOut.model_validate(obj)
    data.image_urls = gallery
    if not data.image_url and gallery:
        data.image_url = gallery[0]
    return data


def _to_jpeg_bytes(content: bytes) -> bytes:
    try:
        img = Image.open(io.BytesIO(content))
        img.load()
    except UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=400,
            detail="Fichier image illisible. Utilisez JPG, PNG, WEBP ou GIF.",
        ) from exc
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=86, optimize=True)
    return buf.getvalue()


async def _save_uploads(files: Optional[List[UploadFile] | UploadFile]) -> list[str]:
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    urls: list[str] = []
    for file in _as_uploads(files):
        if not file:
            continue
        filename = (file.filename or "").strip()
        if not filename and not file.content_type:
            continue
        ext = _file_ext(file)
        if ext in {".heic", ".heif"}:
            raise HTTPException(
                status_code=400,
                detail="Les photos iPhone HEIC ne sont pas acceptées. Exportez en JPG ou PNG.",
            )
        if ext not in ALLOWED_IMAGE_EXT:
            raise HTTPException(
                status_code=400,
                detail=f"Format non supporté ({ext or file.content_type or 'inconnu'}). jpg, png, webp, gif.",
            )
        if hasattr(file, "seek"):
            try:
                await file.seek(0)
            except TypeError:
                file.file.seek(0)
        content = await file.read()
        if not content:
            print(f"Fichier vide ignoré: {getattr(file, 'filename', None)}")
            continue
        jpeg = _to_jpeg_bytes(content)
        dest_name = f"{uuid.uuid4().hex}.jpg"
        dest = UPLOAD_DIR / dest_name
        dest.write_bytes(jpeg)
        urls.append(f"sample_images/uploads/{dest_name}")
        print(f"Image enregistrée: {dest} ({len(jpeg)} octets)")
    return urls


@router.get("/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db)):
    return DashboardStats(
        monuments=db.query(TouristObject).count(),
        categories=db.query(Category).count(),
        sites=db.query(Site).count(),
        scans=db.query(ScanHistory).count(),
    )


@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    urls = await _save_uploads([file])
    if not urls:
        raise HTTPException(status_code=400, detail="Fichier vide")
    return {"url": urls[0], "filename": Path(urls[0]).name}


@router.get("/monuments", response_model=list[MonumentOut])
def list_monuments(
    q: str = Query(""),
    category: str = Query(""),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    objects = db.query(TouristObject).order_by(TouristObject.id.desc()).all()
    query = (q or "").strip().lower()
    cat = (category or "").strip().lower()
    results = []
    for obj in objects:
        if cat and (obj.category or "").lower() != cat:
            continue
        if query:
            title_blob = ""
            if isinstance(obj.name, dict):
                title_blob = " ".join(str(v) for v in obj.name.values() if v)
            else:
                title_blob = str(obj.name or "")
            blob = (
                f"{obj.code or ''} {title_blob} {obj.city_name or ''} "
                f"{obj.region or ''} {obj.category or ''}"
            ).lower()
            if query not in blob:
                continue
        results.append(_serialize(obj))
        if len(results) >= limit:
            break
    return results


@router.get("/monuments/{monument_id}", response_model=MonumentOut)
def get_monument(monument_id: int, db: Session = Depends(get_db)):
    obj = db.query(TouristObject).filter(TouristObject.id == monument_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    return _serialize(obj)


@router.post("/monuments", response_model=MonumentOut, status_code=status.HTTP_201_CREATED)
async def create_monument(
    request: Request,
    db: Session = Depends(get_db),
):
    """Création lieu via multipart/form-data (galerie + GPS)."""
    form = await request.form(max_files=40, max_fields=80)
    name = _form_str(form, "name") or ""
    name_dict = _title_fr_from_str(name)
    description = (_form_str(form, "description") or "").strip()
    history = (_form_str(form, "history") or "").strip()
    desc_dict = {"fr": description} if description else {}
    hist_dict = {"fr": history} if history else {}
    cat = ((_form_str(form, "category") or "artifact")).strip().lower()
    site_id = _default_site_id(db)
    code = _auto_code(db, name.strip(), cat)

    kept = _existing_from_form(form)
    saved = await _save_uploads(await _images_from_form(form))
    gallery = [*kept, *saved]
    cover = gallery[0] if gallery else None

    obj = TouristObject(
        site_id=site_id,
        code=code,
        name=name_dict,
        description=desc_dict,
        history=hist_dict,
        anecdotes={},
        category=cat,
        image_url=cover,
        image_urls=gallery,
        region=(_form_str(form, "region") or "").strip() or None,
        city_name=(_form_str(form, "city") or "").strip() or None,
        latitude=_parse_coord(_form_str(form, "latitude")),
        longitude=_parse_coord(_form_str(form, "longitude")),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID"),
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    _try_index(obj, db, "create")
    db.refresh(obj)
    return _serialize(obj)


@router.api_route(
    "/monuments/{monument_id}",
    methods=["PUT", "POST"],
    response_model=MonumentOut,
)
async def update_monument(
    monument_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Mise à jour multipart (conserve la galerie + ajoute des photos)."""
    obj = db.query(TouristObject).filter(TouristObject.id == monument_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lieu introuvable")

    form = await request.form(max_files=40, max_fields=80)
    name = _form_str(form, "name")
    category = _form_str(form, "category")
    city = _form_str(form, "city")
    region = _form_str(form, "region")
    description = _form_str(form, "description")
    history = _form_str(form, "history")
    existing_images = _form_str(form, "existing_images")

    if name is not None and name.strip():
        base = dict(obj.name) if isinstance(obj.name, dict) else {}
        base["fr"] = name.strip()
        obj.name = base
    if category is not None and category.strip():
        obj.category = category.strip().lower()
    if city is not None:
        obj.city_name = city.strip() or None
    if region is not None:
        obj.region = region.strip() or None
    if description is not None:
        base = dict(obj.description) if isinstance(obj.description, dict) else {}
        if description.strip():
            base["fr"] = description.strip()
        obj.description = base
    if history is not None:
        base = dict(obj.history) if isinstance(obj.history, dict) else {}
        if history.strip():
            base["fr"] = history.strip()
        obj.history = base
    if "latitude" in form:
        obj.latitude = _parse_coord(_form_str(form, "latitude"))
    if "longitude" in form:
        obj.longitude = _parse_coord(_form_str(form, "longitude"))

    kept: list[str] = []
    if existing_images is not None:
        try:
            parsed = json.loads(existing_images or "[]")
            kept = _normalize_gallery(parsed)
        except json.JSONDecodeError:
            kept = _normalize_gallery(obj.image_urls)
    else:
        kept = _normalize_gallery(obj.image_urls)

    new_urls = await _save_uploads(await _images_from_form(form))
    gallery = [*kept, *new_urls]
    obj.image_urls = gallery
    obj.image_url = gallery[0] if gallery else None
    flag_modified(obj, "image_urls")
    flag_modified(obj, "name")

    db.commit()
    db.refresh(obj)
    _try_index(obj, db, "update")
    db.refresh(obj)
    return _serialize(obj)


@router.patch("/monuments/{monument_id}", response_model=MonumentOut)
def patch_monument_json(
    monument_id: int,
    payload: MonumentUpdate,
    db: Session = Depends(get_db),
):
    """Patch JSON (compat / scripts)."""
    obj = db.query(TouristObject).filter(TouristObject.id == monument_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    data = payload.model_dump(exclude_unset=True)
    if "category" in data and data["category"]:
        data["category"] = data["category"].strip().lower()
    for key, value in data.items():
        setattr(obj, key, value)
    if "image_urls" in data:
        flag_modified(obj, "image_urls")
    db.commit()
    db.refresh(obj)
    _try_index(obj, db, "patch")
    db.refresh(obj)
    return _serialize(obj)


@router.delete("/monuments/{monument_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_monument(monument_id: int, db: Session = Depends(get_db)):
    obj = db.query(TouristObject).filter(TouristObject.id == monument_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Lieu introuvable")
    db.query(ScanHistory).filter(ScanHistory.object_id == monument_id).delete(
        synchronize_session=False
    )
    try:
        delete_object_vectors(monument_id)
    except Exception as e:
        print(f"Qdrant delete {monument_id}: {e}")
    db.delete(obj)
    db.commit()
    return None
