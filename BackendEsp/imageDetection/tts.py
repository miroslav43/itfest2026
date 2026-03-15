"""
Text-to-Speech via OpenAI TTS API (tts-1 — cel mai ieftin model).

Flow:
  1. Hash textul → cache key.
  2. Daca MP3 nu e in cache → apeleaza OpenAI API → salveaza in tts_cache/.
  3. Reda MP3 cu `afplay` (macOS). afplay trimite audio la dispozitivul implicit
     — seteaza-l in System Settings → Sound la boxele Bluetooth ale ESP32.

Modele disponibile:
  tts-1      ~$0.015 / 1K caractere  (default — ieftin, latenta mica)
  tts-1-hd   ~$0.030 / 1K caractere  (calitate superioara)

Voci recomandate pentru romana: nova, shimmer, alloy
"""
import hashlib
import subprocess
import threading
from pathlib import Path

from openai import OpenAI

from config import OPENAI_API_KEY, TTS_CACHE_DIR, TTS_MODEL, TTS_VOICE

TTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)

_client: OpenAI | None = None
_tts_lock = threading.Lock()   # un singur request / playback la un moment dat


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def _cache_path(text: str) -> Path:
    key = hashlib.md5(f"{TTS_MODEL}:{TTS_VOICE}:{text}".encode()).hexdigest()
    return TTS_CACHE_DIR / f"{key}.mp3"


def _generate_mp3(text: str, dest: Path) -> bool:
    """Apeleaza OpenAI TTS si scrie MP3-ul in dest. Returneaza True la succes."""
    try:
        response = _get_client().audio.speech.create(
            model=TTS_MODEL,
            voice=TTS_VOICE,
            input=text,
            response_format="mp3",
        )
        dest.write_bytes(response.content)
        return True
    except Exception as exc:
        print(f"[TTS] OpenAI API error: {exc}")
        return False


def speak(text: str, blocking: bool = False) -> None:
    """
    Genereaza (sau reutilizeaza cache-ul) MP3 pentru `text` si il reda.
    Implicit ruleaza intr-un thread daemon — caller-ul nu e blocat.
    """
    def _run() -> None:
        with _tts_lock:
            mp3 = _cache_path(text)
            if not mp3.exists():
                print(f"[TTS] Generez: {text!r}")
                if not _generate_mp3(text, mp3):
                    return
            else:
                print(f"[TTS] Cache hit: {text!r}")

            try:
                subprocess.run(["afplay", str(mp3)], check=True)
            except Exception as exc:
                print(f"[TTS] afplay error: {exc}")

    if blocking:
        _run()
    else:
        threading.Thread(target=_run, daemon=True).start()


def speak_face(name: str) -> None:
    """Anunt recunoastere fata in romana."""
    speak(f"{name} e în fața ta")


def clear_cache() -> int:
    """Sterge toate fisierele MP3 din cache. Returneaza numarul de fisiere sterse."""
    removed = 0
    for f in TTS_CACHE_DIR.glob("*.mp3"):
        f.unlink()
        removed += 1
    return removed
