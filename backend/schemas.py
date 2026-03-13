from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
import uuid


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str


class CaneCreate(BaseModel):
    id: str
    name: Optional[str] = "Baston"


class CaneOut(BaseModel):
    id: str
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


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
