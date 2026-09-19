import os
from fastapi import HTTPException
from elevenlabs.client import ElevenLabs

DEFAULT_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb").strip()
DEFAULT_MODEL_ID = os.getenv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5").strip()


def get_elevenlabs_client() -> ElevenLabs:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="ELEVENLABS_API_KEY manquante ou non chargée dans l'environnement Docker.",
        )
    return ElevenLabs(api_key=api_key)


def generate_speech_elevenlabs(text: str, voice_id: str = None) -> bytes:
    """
    Génère un flux MP3 via le SDK officiel ElevenLabs (modèle eleven_flash_v2_5).
    Aucun moteur TTS natif/système — ElevenLabs uniquement.
    """
    if not voice_id:
        voice_id = DEFAULT_VOICE_ID

    try:
        client = get_elevenlabs_client()
        audio_stream = client.text_to_speech.convert(
            voice_id=voice_id,
            model_id=DEFAULT_MODEL_ID,
            text=text,
        )
        audio_bytes = b"".join(chunk for chunk in audio_stream if chunk)
        if not audio_bytes:
            raise HTTPException(status_code=500, detail="ElevenLabs a retourné un flux audio vide.")
        return audio_bytes
    except HTTPException:
        raise
    except Exception as e:
        err_str = str(e)
        lowered = err_str.lower()
        if "paid_plan_required" in lowered or "library voices" in lowered:
            raise HTTPException(
                status_code=402,
                detail=(
                    "ElevenLabs Free : cette voix « library » est interdite via l'API. "
                    "Utilisez une voix de votre compte (Voices → My Voices) ou un plan payant, "
                    "puis mettez à jour ELEVENLABS_VOICE_ID dans backend/.env."
                ),
            )
        if "402" in err_str or "quota" in lowered or "payment_required" in lowered:
            raise HTTPException(
                status_code=402,
                detail="Erreur ElevenLabs (402) : quota épuisé ou paiement requis.",
            )
        if "voice_not_found" in lowered:
            raise HTTPException(
                status_code=404,
                detail=f"Voix ElevenLabs introuvable ({voice_id}). Vérifiez ELEVENLABS_VOICE_ID.",
            )
        raise HTTPException(
            status_code=500,
            detail=f"Erreur ElevenLabs : {err_str}",
        )
