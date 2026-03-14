"""
blind_users router
  - Admin / Caregiver : creează cont orb (bastonul se crează automat)
  - Blind user        : citește bastonul propriu
"""
from typing import Optional, List
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user, hash_password
import models
import schemas

router = APIRouter()


def require_caregiver_or_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role not in ("caregiver", "admin"):
        raise HTTPException(status_code=403, detail="Acces permis doar aparținătorilor.")
    return current_user


@router.post("/", response_model=schemas.BlindUserCreatedOut, summary="Creează cont utilizator nevăzător + baston automat")
def create_blind_user(
    data: schemas.BlindUserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_caregiver_or_admin),
):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email-ul este deja folosit.")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă cel puțin 6 caractere.")

    # Determine which caregiver owns this blind user's cane
    if data.caregiver_id:
        if current_user.role != "admin":
            raise HTTPException(status_code=403, detail="Doar administratorul poate asigna un aparținător.")
        caregiver = db.query(models.User).filter(
            models.User.id == data.caregiver_id,
            models.User.role == "caregiver",
        ).first()
        if not caregiver:
            raise HTTPException(status_code=404, detail="Aparținătorul selectat nu a fost găsit.")
        owner_id = caregiver.id
    else:
        owner_id = current_user.id

    # 1. Create blind user account
    blind_user = models.User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role="blind_user",
    )
    db.add(blind_user)
    db.flush()

    # 2. Auto-create a cane for this blind user
    cane_id = f"cane_{uuid.uuid4().hex[:12]}"
    cane = models.Cane(id=cane_id, name=data.cane_name or "Baston")
    db.add(cane)
    db.flush()

    # 3. Link blind user ↔ cane
    db.add(models.BlindUserCane(
        blind_user_id=blind_user.id,
        cane_id=cane_id,
        linked_by=current_user.id,
    ))

    # 4. Give the assigned caregiver access to the cane
    db.add(models.CaneAccess(
        caregiver_id=owner_id,
        cane_id=cane_id,
    ))

    db.commit()
    db.refresh(blind_user)
    db.refresh(cane)
    return {"user": blind_user, "cane": cane}


@router.get("/my-users", response_model=List[schemas.UserOut], summary="Nevăzătorii legați de bastoanele aparținătorului")
def get_my_blind_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_caregiver_or_admin),
):
    if current_user.role == "admin":
        return db.query(models.User).filter(models.User.role == "blind_user").all()

    cane_ids = [
        row.cane_id
        for row in db.query(models.CaneAccess)
        .filter(models.CaneAccess.caregiver_id == current_user.id)
        .all()
    ]
    if not cane_ids:
        return []

    blind_user_ids = [
        row.blind_user_id
        for row in db.query(models.BlindUserCane)
        .filter(models.BlindUserCane.cane_id.in_(cane_ids))
        .all()
    ]
    if not blind_user_ids:
        return []

    return (
        db.query(models.User)
        .filter(models.User.id.in_(blind_user_ids), models.User.role == "blind_user")
        .all()
    )


@router.get("/{user_id}/cane", response_model=Optional[schemas.CaneOut], summary="Bastonul unui nevăzător (aparținător/admin)")
def get_blind_user_cane(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_caregiver_or_admin),
):
    link = (
        db.query(models.BlindUserCane)
        .filter(models.BlindUserCane.blind_user_id == user_id)
        .first()
    )
    if not link:
        return None
    return db.query(models.Cane).filter(models.Cane.id == link.cane_id).first()


@router.get("/me/cane", response_model=Optional[schemas.CaneOut], summary="Bastonul utilizatorului nevăzător")
def get_my_cane(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if current_user.role != "blind_user":
        raise HTTPException(status_code=403, detail="Acces permis doar utilizatorilor nevăzători.")
    link = (
        db.query(models.BlindUserCane)
        .filter(models.BlindUserCane.blind_user_id == current_user.id)
        .first()
    )
    if not link:
        return None
    return db.query(models.Cane).filter(models.Cane.id == link.cane_id).first()
