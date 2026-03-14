from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models
import schemas

router = APIRouter()


def require_blind_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "blind_user":
        raise HTTPException(status_code=403, detail="Acces permis doar utilizatorilor nevăzători.")
    return current_user


@router.get("/", response_model=List[schemas.DestinationOut], summary="Destinațiile utilizatorului")
def list_destinations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_blind_user),
):
    return (
        db.query(models.Destination)
        .filter(models.Destination.blind_user_id == current_user.id)
        .order_by(models.Destination.created_at.desc())
        .all()
    )


@router.post("/", response_model=schemas.DestinationOut, summary="Adaugă destinație")
def add_destination(
    data: schemas.DestinationIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_blind_user),
):
    dest = models.Destination(
        blind_user_id=current_user.id,
        cane_id=data.cane_id,
        name=data.name,
        latitude=data.latitude,
        longitude=data.longitude,
        active=False,
    )
    db.add(dest)
    db.commit()
    db.refresh(dest)
    return dest


@router.put("/{dest_id}/activate", response_model=schemas.DestinationOut, summary="Activează destinație")
def activate_destination(
    dest_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_blind_user),
):
    # Deactivate all
    db.query(models.Destination).filter(
        models.Destination.blind_user_id == current_user.id
    ).update({"active": False})

    dest = (
        db.query(models.Destination)
        .filter(
            models.Destination.id == dest_id,
            models.Destination.blind_user_id == current_user.id,
        )
        .first()
    )
    if not dest:
        raise HTTPException(status_code=404, detail="Destinația nu a fost găsită.")
    dest.active = True
    db.commit()
    db.refresh(dest)
    return dest


@router.delete("/{dest_id}", status_code=204, summary="Șterge destinație")
def delete_destination(
    dest_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_blind_user),
):
    dest = (
        db.query(models.Destination)
        .filter(
            models.Destination.id == dest_id,
            models.Destination.blind_user_id == current_user.id,
        )
        .first()
    )
    if not dest:
        raise HTTPException(status_code=404, detail="Destinația nu a fost găsită.")
    db.delete(dest)
    db.commit()
