from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models
import schemas

router = APIRouter()


def require_admin(current_user: models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acces permis doar administratorilor.")
    return current_user


@router.get("/users", response_model=List[schemas.UserOut], summary="Lista tuturor utilizatorilor")
def list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    return db.query(models.User).order_by(models.User.created_at).all()


@router.put("/users/{user_id}/role", response_model=schemas.UserOut, summary="Schimbă rolul unui utilizator")
def update_role(
    user_id: str,
    data: schemas.RoleUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit.")
    if str(user.id) == str(current_user.id):
        raise HTTPException(status_code=400, detail="Nu îți poți schimba propriul rol.")
    user.role = data.role
    db.commit()
    db.refresh(user)
    return user


@router.get("/canes", response_model=List[schemas.CaneOut], summary="Lista tuturor bastoanelor")
def list_all_canes(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    return db.query(models.Cane).order_by(models.Cane.created_at).all()


@router.get("/stats", summary="Statistici generale")
def get_stats(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
):
    return {
        "total_users": db.query(models.User).count(),
        "total_caregivers": db.query(models.User).filter(models.User.role == "caregiver").count(),
        "total_blind_users": db.query(models.User).filter(models.User.role == "blind_user").count(),
        "total_canes": db.query(models.Cane).count(),
    }
