"""
Speech-to-Text via OpenAI Whisper API (whisper-1).

Utilizare:
  - transcribe_file(path)   → transcrie un fisier audio existent
  - transcribe_mic(sec)     → inregistreaza N secunde de la microfon si transcrie

Modele disponibile:
  whisper-1  → singurul model disponibil via API  ($0.006 / minut)
               Suporta >50 limbi, inclusiv romana (lang="ro").

Formate audio acceptate de API: mp3, mp4, mpeg, mpga, m4a, wav, webm
"""
import io
import tempfile
import threading
import wave
from pathlib import Path
from typing import Optional

from openai import OpenAI

from config import OPENAI_API_KEY, STT_LANGUAGE, STT_MODEL

_client: OpenAI | None = None
_mic_lock = threading.Lock()


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def transcribe_file(audio_path: str | Path, language: str = STT_LANGUAGE) -> str:
    """
    Transcrie un fisier audio si returneaza textul in romana.

    Args:
        audio_path: Calea catre fisierul audio (mp3, wav, m4a, etc.)
        language:   Codul limbii ISO-639-1 (default "ro" = romana)

    Returns:
        Textul transcris sau "" la eroare.
    """
    try:
        with open(audio_path, "rb") as f:
            transcript = _get_client().audio.transcriptions.create(
                model=STT_MODEL,
                file=f,
                language=language,
                response_format="text",
            )
        return transcript.strip() if isinstance(transcript, str) else transcript.text.strip()
    except Exception as exc:
        print(f"[STT] Eroare transcriere: {exc}")
        return ""


def transcribe_bytes(audio_bytes: bytes, filename: str = "audio.wav",
                     language: str = STT_LANGUAGE) -> str:
    """
    Transcrie audio din bytes (util pentru stream-uri sau date primite din retea).

    Args:
        audio_bytes: Datele audio raw
        filename:    Numele fictiv al fisierului (extensia determina formatul)
        language:    Codul limbii ISO-639-1

    Returns:
        Textul transcris sau "" la eroare.
    """
    try:
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = filename
        transcript = _get_client().audio.transcriptions.create(
            model=STT_MODEL,
            file=audio_file,
            language=language,
            response_format="text",
        )
        return transcript.strip() if isinstance(transcript, str) else transcript.text.strip()
    except Exception as exc:
        print(f"[STT] Eroare transcriere bytes: {exc}")
        return ""


def transcribe_mic(duration_sec: float = 5.0, language: str = STT_LANGUAGE) -> Optional[str]:
    """
    Inregistreaza de la microfon pentru `duration_sec` secunde si transcrie.
    Necesita `pyaudio` instalat: pip install pyaudio

    Args:
        duration_sec: Cat sa inregistreze (secunde)
        language:     Codul limbii ISO-639-1

    Returns:
        Textul transcris, None daca pyaudio nu e disponibil sau la eroare.
    """
    try:
        import pyaudio  # lazy import — optional dependency
    except ImportError:
        print("[STT] pyaudio nu e instalat. Ruleaza: pip install pyaudio")
        return None

    RATE = 16000
    CHUNK = 1024
    CHANNELS = 1

    with _mic_lock:
        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16,
            channels=CHANNELS,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK,
        )
        print(f"[STT] Inregistrez {duration_sec:.0f}s…")
        frames = []
        for _ in range(int(RATE / CHUNK * duration_sec)):
            frames.append(stream.read(CHUNK, exception_on_overflow=False))
        stream.stop_stream()
        stream.close()
        pa.terminate()

    # Scrie WAV intr-un fisier temporar
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tmp_path = Path(tmp.name)

    with wave.open(str(tmp_path), "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)  # paInt16 = 2 bytes
        wf.setframerate(RATE)
        wf.writeframes(b"".join(frames))

    try:
        result = transcribe_file(tmp_path, language=language)
        print(f"[STT] Transcris: {result!r}")
        return result
    finally:
        tmp_path.unlink(missing_ok=True)
