import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from routers import auth, users, canes, locations

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Import here so any error is visible in logs before crashing
    try:
        from database import engine, Base
        import models  # noqa: F401 – registers all ORM models
        Base.metadata.create_all(bind=engine)
        logger.info("✅ Conexiune Neon OK – tabele verificate.")
    except Exception as e:
        logger.error(f"❌ Eroare conectare baza de date: {e}")
        raise
    yield


app = FastAPI(
    title="Solemtrix API",
    version="0.1.0",
    description="Backend pentru aplicația de monitorizare baston inteligent.",
    lifespan=lifespan,
)

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

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


@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": "Solemtrix API", "version": "0.1.0"}
