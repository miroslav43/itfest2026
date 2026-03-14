"""
Destinations router
  - Aparținător / Admin : adaugă, șterge și listează destinații pentru orice blind_user
  - Blind user          : vede doar propriile destinații și activează una
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models
import schemas

router = APIRouter()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def require_caregiver_or_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("caregiver", "admin"):
        raise HTTPException(status_code=403, detail="Acces permis doar aparținătorilor.")
    return current_user


def require_blind_user(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "blind_user":
        raise HTTPException(status_code=403, detail="Acces permis doar utilizatorilor nevăzători.")
    return current_user


# ─── Aparținător: gestionează destinații ─────────────────────────────────────

@router.get(
    "/for/{blind_user_id}",
    response_model=List[schemas.DestinationOut],
    summary="[Aparținător] Listează destinațiile unui nevăzător",
)
def list_for_blind_user(
    blind_user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_caregiver_or_admin),
):
    # Verify caregiver has a cane linked to this blind user
    if current_user.role != "admin":
        link = (
            db.query(models.BlindUserCane)
            .filter(models.BlindUserCane.blind_user_id == blind_user_id)
            .join(
                models.CaneAccess,
                (models.CaneAccess.cane_id == models.BlindUserCane.cane_id)
                & (models.CaneAccess.caregiver_id == current_user.id),
            )
            .first()
        )
        if not link:
            raise HTTPException(status_code=403, detail="Nu ai acces la acest utilizator.")

    return (
        db.query(models.Destination)
        .filter(models.Destination.blind_user_id == blind_user_id)
        .order_by(models.Destination.created_at.desc())
        .all()
    )


@router.post(
    "/",
    response_model=schemas.DestinationOut,
    summary="[Aparținător] Adaugă destinație pentru un nevăzător",
)
def add_destination(
    data: schemas.CaregiverDestinationIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_caregiver_or_admin),
):
    # Verify blind user exists and has role blind_user
    blind_user = db.query(models.User).filter(
        models.User.id == data.blind_user_id,
        models.User.role == "blind_user",
    ).first()
    if not blind_user:
        raise HTTPException(status_code=404, detail="Utilizatorul nevăzător nu a fost găsit.")

    # Caregiver must own the cane
    if current_user.role != "admin":
        access = db.query(models.CaneAccess).filter(
            models.CaneAccess.caregiver_id == current_user.id,
            models.CaneAccess.cane_id == data.cane_id,
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="Nu ai acces la acest baston.")

    dest = models.Destination(
        blind_user_id=data.blind_user_id,
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


@router.delete(
    "/{dest_id}",
    status_code=204,
    summary="[Aparținător] Șterge destinație",
)
def delete_destination(
    dest_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_caregiver_or_admin),
):
    dest = db.query(models.Destination).filter(models.Destination.id == dest_id).first()
    if not dest:
        raise HTTPException(status_code=404, detail="Destinația nu a fost găsită.")

    if current_user.role != "admin":
        access = db.query(models.CaneAccess).filter(
            models.CaneAccess.caregiver_id == current_user.id,
            models.CaneAccess.cane_id == dest.cane_id,
        ).first()
        if not access:
            raise HTTPException(status_code=403, detail="Nu ai acces la această destinație.")

    db.delete(dest)
    db.commit()


# ─── Blind user: citește și activează ────────────────────────────────────────

@router.get(
    "/mine",
    response_model=List[schemas.DestinationOut],
    summary="[Nevăzător] Propriile destinații",
)
def my_destinations(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_blind_user),
):
    return (
        db.query(models.Destination)
        .filter(models.Destination.blind_user_id == current_user.id)
        .order_by(models.Destination.created_at.desc())
        .all()
    )


@router.put(
    "/{dest_id}/activate",
    response_model=schemas.DestinationOut,
    summary="[Nevăzător] Activează destinație",
)
def activate_destination(
    dest_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_blind_user),
):
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


@router.put(
    "/{dest_id}/deactivate",
    response_model=schemas.DestinationOut,
    summary="[Nevăzător] Dezactivează destinație",
)
def deactivate_destination(
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
    dest.active = False
    db.commit()
    db.refresh(dest)
    return dest
