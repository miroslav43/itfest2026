from pydantic import BaseModel, EmailStr
from typing import Optional, Literal
from datetime import datetime
import uuid

RoleType = Literal["admin", "caregiver", "blind_user"]


# ─── Auth ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str
    role: str


# ─── Admin ────────────────────────────────────────────────────────────────────

class RoleUpdate(BaseModel):
    role: RoleType


# ─── Canes ────────────────────────────────────────────────────────────────────

class CaneCreate(BaseModel):
    id: str
    name: Optional[str] = "Baston"


class CaneOut(BaseModel):
    id: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Blind users ──────────────────────────────────────────────────────────────

class BlindUserCreate(BaseModel):
    email: EmailStr
    password: str
    cane_id: str
    display_name: Optional[str] = None


class BlindUserCaneOut(BaseModel):
    id: str
    name: str

    model_config = {"from_attributes": True}


# ─── Destinations ─────────────────────────────────────────────────────────────

class DestinationIn(BaseModel):
    name: str
    latitude: float
    longitude: float
    cane_id: str


class DestinationOut(BaseModel):
    id: uuid.UUID
    blind_user_id: uuid.UUID
    cane_id: str
    name: str
    latitude: float
    longitude: float
    active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Locations ────────────────────────────────────────────────────────────────

class LocationIn(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    source: Optional[str] = "simulator"


class LocationOut(BaseModel):
    cane_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float]
    recorded_at: datetime
    source: str

    model_config = {"from_attributes": True}


class LocationHistoryOut(BaseModel):
    id: uuid.UUID
    cane_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float]
    recorded_at: datetime
    source: str

    model_config = {"from_attributes": True}
