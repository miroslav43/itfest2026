"""
TTS proxy — trimite textul la ElevenLabs și returnează audio/mpeg înapoi.
Cheia API rămâne pe server, nu e expusă în frontend.
"""
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx
from auth import get_current_user
import models

router = APIRouter()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "")
ELEVENLABS_URL = f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}"


class TTSRequest(BaseModel):
    text: str


@router.post(
    "/speak",
    summary="Generează audio TTS via ElevenLabs",
    response_class=StreamingResponse,
)
async def speak(
    data: TTSRequest,
    current_user: models.User = Depends(get_current_user),
):
    if not ELEVENLABS_API_KEY or not ELEVENLABS_VOICE_ID:
        raise HTTPException(status_code=503, detail="ElevenLabs nu este configurat pe server.")

    if not data.text.strip():
        raise HTTPException(status_code=400, detail="Textul nu poate fi gol.")

    payload = {
        "text": data.text,
        "model_id": "eleven_multilingual_v2",
        "voice_settings": {
            "stability": 0.5,
            "similarity_boost": 0.75,
            "speed": 0.95,
        },
    }

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            ELEVENLABS_URL,
            json=payload,
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
        )

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"ElevenLabs error {resp.status_code}: {resp.text[:200]}",
        )

    return StreamingResponse(
        iter([resp.content]),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache"},
    )
