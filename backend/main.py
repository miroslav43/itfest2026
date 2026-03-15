import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import auth, users, canes, locations, admin, blind_users, destinations, tts

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = os.getenv("DATABASE_URL", "")
    if not db_url or "user:password@host" in db_url or db_url == "":
        logger.error(
            "❌ DATABASE_URL nu e configurata in backend/.env!\n"
            "   Mergi la https://console.neon.tech → proiectul tau → Connection Details\n"
            "   Copiaza Connection string si pune-l in backend/.env"
        )
        # Porneste serverul fara DB — rutele care cer DB vor returna 503
        yield
        return

    try:
        from database import engine, Base
        import models  # noqa: F401
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Conexiune Neon OK – tabele verificate.")
    except Exception as e:
        logger.error(
            f"❌ Eroare conectare baza de date: {e}\n"
            "   Verifica DATABASE_URL in backend/.env"
        )
        # Nu crapa la startup — porneste serverul oricum, DB va da eroare pe cereri
        yield
        return
    yield


app = FastAPI(
    title="Solemtrix API",
    version="0.2.0",
    description="Backend pentru aplicația de monitorizare baston inteligent.",
    lifespan=lifespan,
)

# Default origins include the web dev server and all Capacitor WebView origins.
# In production, set ALLOWED_ORIGINS in the .env to your deployed frontend URL.
_default_origins = [
    "http://localhost:3000",
    "https://localhost",
    "http://localhost",
    "capacitor://localhost",
]
_env_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
allowed_origins = (
    [o.strip() for o in _env_origins.split(",") if o.strip()]
    if _env_origins
    else _default_origins
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["Autentificare"])
app.include_router(users.router, prefix="/users", tags=["Utilizatori"])
app.include_router(canes.router, prefix="/canes", tags=["Bastoane"])
app.include_router(locations.router, prefix="/locations", tags=["Locații"])
app.include_router(admin.router, prefix="/admin", tags=["Admin"])
app.include_router(blind_users.router, prefix="/blind-users", tags=["Utilizatori Nevăzători"])
app.include_router(destinations.router, prefix="/destinations", tags=["Destinații"])
app.include_router(tts.router, prefix="/tts", tags=["TTS"])


@app.get("/", tags=["Health"])
def root():
    db_url = os.getenv("DATABASE_URL", "")
    db_ok = bool(db_url) and "user:password@host" not in db_url
    return {
        "status": "ok",
        "app": "Solemtrix API",
        "version": "0.2.0",
        "database": "configured" if db_ok else "NOT CONFIGURED — editeaza backend/.env",
    }
