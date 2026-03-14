import uuid
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, UniqueConstraint, Boolean, func
from sqlalchemy.dialects.postgresql import UUID
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, nullable=False, default="caregiver")  # admin | caregiver | blind_user
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Cane(Base):
    __tablename__ = "canes"

    id = Column(String, primary_key=True)
    name = Column(String, nullable=False, default="Baston")
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class CaneAccess(Base):
    __tablename__ = "cane_access"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    caregiver_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    cane_id = Column(
        String, ForeignKey("canes.id", ondelete="CASCADE"), nullable=False
    )
    linked_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("caregiver_id", "cane_id"),)


class BlindUserCane(Base):
    __tablename__ = "blind_user_cane"

    blind_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    cane_id = Column(
        String, ForeignKey("canes.id", ondelete="CASCADE"), primary_key=True
    )
    linked_by = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    linked_at = Column(DateTime(timezone=True), server_default=func.now())


class Destination(Base):
    __tablename__ = "destinations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blind_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    cane_id = Column(
        String, ForeignKey("canes.id", ondelete="CASCADE"), nullable=False
    )
    name = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    active = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LatestLocation(Base):
    __tablename__ = "latest_locations"

    cane_id = Column(
        String, ForeignKey("canes.id", ondelete="CASCADE"), primary_key=True
    )
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    source = Column(String, default="unknown")


class LocationHistory(Base):
    __tablename__ = "location_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cane_id = Column(
        String, ForeignKey("canes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    source = Column(String, default="unknown")
