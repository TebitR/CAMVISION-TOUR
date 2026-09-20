"""RAG touristique : contexte monument (Postgres) + similarité Qdrant + Gemini."""
from __future__ import annotations

import os
import re
from typing import Optional

import httpx
from qdrant_client.models import Filter, FieldCondition, MatchValue


LANG_NAMES = {
    "fr": "français",
    "en": "English",
    "es": "español",
    "de": "Deutsch",
    "zh": "中文",
    "ar": "العربية",
}


def build_monument_context(obj, lang: str) -> str:
    title = obj.localized(obj.name, lang, "Monument")
    description = obj.localized(obj.description, lang, "")
    history = obj.localized(obj.history, lang, "")
    anecdotes = obj.localized(obj.anecdotes, lang, "")
    parts = [
        f"Titre: {title}",
        f"Catégorie: {obj.category or 'artifact'}",
        f"Région: {obj.region or ''}",
        f"Ville: {obj.city_name or ''}",
        f"Description: {description}",
        f"Histoire: {history}",
        f"Anecdotes: {anecdotes}",
    ]
    return "\n".join(p for p in parts if p and not p.endswith(": "))


def extractive_answer(context: str, query: str, lang: str) -> str:
    """Fallback sans Gemini : paragraphe le plus pertinent + phrase d'intro."""
    paragraphs = [p.strip() for p in re.split(r"\n+", context) if len(p.strip()) > 40]
    if not paragraphs:
        return {
            "fr": "Je n'ai pas assez d'informations sur ce monument pour répondre.",
            "en": "I don't have enough information about this monument to answer.",
            "es": "No tengo suficiente información sobre este monumento para responder.",
            "de": "Ich habe nicht genug Informationen zu diesem Denkmal.",
            "zh": "关于这座纪念碑，我没有足够信息来回答。",
            "ar": "ليست لدي معلومات كافية عن هذا النصب للإجابة.",
        }.get(lang, "Informations insuffisantes.")

    tokens = [t.lower() for t in re.findall(r"\w+", query) if len(t) > 2]
    best = paragraphs[0]
    best_score = -1
    for p in paragraphs:
        pl = p.lower()
        score = sum(1 for t in tokens if t in pl)
        if score > best_score:
            best_score = score
            best = p
    # Retirer le préfixe "Description: " etc.
    return re.sub(r"^(Titre|Description|Histoire|Anecdotes|Catégorie|Région|Ville):\s*", "", best)


def ask_gemini(context: str, query: str, lang: str) -> Optional[str]:
    api_key = (os.getenv("GEMINI_API_KEY") or "").strip()
    if not api_key or api_key.startswith("votre_"):
        return None

    lang_name = LANG_NAMES.get(lang, "français")
    prompt = (
        f"Tu es un guide culturel camerounais concis et précis.\n"
        f"Réponds UNIQUEMENT en {lang_name}, en 2 à 4 phrases maximum.\n"
        f"Base-toi exclusivement sur le CONTEXTE fourni. "
        f"Si la réponse n'y figure pas, dis-le poliment.\n"
        f"Conserve les noms propres (Batcham, Nsangu, Bamoun, Yaoundé, etc.).\n\n"
        f"CONTEXTE:\n{context}\n\n"
        f"QUESTION DU TOURISTE:\n{query}\n"
    )

    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"gemini-2.0-flash:generateContent?key={api_key}"
    )
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400},
    }
    try:
        with httpx.Client(timeout=45.0) as client:
            r = client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
        parts = data["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts).strip()
        return text or None
    except Exception as e:
        print(f"Gemini RAG erreur: {e}")
        return None


def qdrant_monument_hits(client, collection: str, object_id: int, query_vector: list, limit: int = 3):
    """Recherche vectorielle restreinte au monument (payload object_id)."""
    try:
        return client.search(
            collection_name=collection,
            query_vector=query_vector,
            query_filter=Filter(
                must=[FieldCondition(key="object_id", match=MatchValue(value=object_id))]
            ),
            limit=limit,
        )
    except Exception as e:
        print(f"Qdrant RAG filter: {e}")
        try:
            return client.search(
                collection_name=collection,
                query_vector=query_vector,
                limit=limit,
            )
        except Exception as e2:
            print(f"Qdrant RAG fallback: {e2}")
            return []
