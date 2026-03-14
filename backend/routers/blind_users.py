from typing import Optional
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


@router.post("/", response_model=schemas.UserOut, summary="Creează cont utilizator nevăzător")
def create_blind_user(
    data: schemas.BlindUserCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_caregiver_or_admin),
):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email-ul este deja folosit.")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă cel puțin 6 caractere.")

    # Verify caregiver has access to that cane
    access = (
        db.query(models.CaneAccess)
        .filter(
            models.CaneAccess.caregiver_id == current_user.id,
            models.CaneAccess.cane_id == data.cane_id,
        )
        .first()
    )
    if not access and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Nu ai acces la acest baston.")

    blind_user = models.User(
        email=data.email,
        hashed_password=hash_password(data.password),
        role="blind_user",
    )
    db.add(blind_user)
    db.flush()

    db.add(
        models.BlindUserCane(
            blind_user_id=blind_user.id,
            cane_id=data.cane_id,
            linked_by=current_user.id,
        )
    )
    db.commit()
    db.refresh(blind_user)
    return blind_user


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
