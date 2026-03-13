from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models
import schemas

router = APIRouter()


@router.get("/", response_model=List[schemas.CaneOut], summary="Lista bastoane asociate")
def list_canes(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    accesses = (
        db.query(models.CaneAccess)
        .filter(models.CaneAccess.caregiver_id == current_user.id)
        .all()
    )
    cane_ids = [a.cane_id for a in accesses]
    if not cane_ids:
        return []
    return db.query(models.Cane).filter(models.Cane.id.in_(cane_ids)).all()


@router.post("/enroll", response_model=schemas.CaneOut, summary="Înrolează baston via cod QR")
def enroll_cane(
    data: schemas.CaneCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cane = db.query(models.Cane).filter(models.Cane.id == data.id).first()
    if not cane:
        cane = models.Cane(id=data.id, name=data.name or "Baston")
        db.add(cane)
        db.flush()

    already_linked = (
        db.query(models.CaneAccess)
        .filter(
            models.CaneAccess.caregiver_id == current_user.id,
            models.CaneAccess.cane_id == data.id,
        )
        .first()
    )
    if already_linked:
        raise HTTPException(status_code=400, detail="Bastonul este deja asociat contului tău.")

    db.add(models.CaneAccess(caregiver_id=current_user.id, cane_id=data.id))
    db.commit()
    db.refresh(cane)
    return cane


@router.delete("/{cane_id}", status_code=204, summary="Dezasociază baston")
def unlink_cane(
    cane_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    access = (
        db.query(models.CaneAccess)
        .filter(
            models.CaneAccess.caregiver_id == current_user.id,
            models.CaneAccess.cane_id == cane_id,
        )
        .first()
    )
    if not access:
        raise HTTPException(status_code=404, detail="Asocierea nu a fost găsită.")
    db.delete(access)
    db.commit()
