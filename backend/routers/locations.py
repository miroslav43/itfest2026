from typing import Optional, List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from auth import get_current_user
import models
import schemas

router = APIRouter()


def _verify_access(cane_id: str, user: models.User, db: Session):
    """Allow access if the user is:
    - a caregiver/admin with a CaneAccess entry for this cane, OR
    - the blind user whose cane this is (BlindUserCane link).
    """
    if user.role == "admin":
        return

    if user.role == "blind_user":
        link = (
            db.query(models.BlindUserCane)
            .filter(
                models.BlindUserCane.blind_user_id == user.id,
                models.BlindUserCane.cane_id == cane_id,
            )
            .first()
        )
        if link:
            return
    else:
        access = (
            db.query(models.CaneAccess)
            .filter(
                models.CaneAccess.caregiver_id == user.id,
                models.CaneAccess.cane_id == cane_id,
            )
            .first()
        )
        if access:
            return

    raise HTTPException(status_code=403, detail="Acces interzis pentru acest baston.")


@router.get(
    "/{cane_id}/latest",
    response_model=Optional[schemas.LocationOut],
    summary="Ultima locație a bastonului",
)
def get_latest_location(
    cane_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_access(cane_id, current_user, db)
    return db.query(models.LatestLocation).filter(
        models.LatestLocation.cane_id == cane_id
    ).first()


@router.post(
    "/{cane_id}/update",
    response_model=schemas.LocationOut,
    summary="Actualizează locația bastonului",
)
def update_location(
    cane_id: str,
    data: schemas.LocationIn,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_access(cane_id, current_user, db)
    now = datetime.now(timezone.utc)

    loc = db.query(models.LatestLocation).filter(
        models.LatestLocation.cane_id == cane_id
    ).first()

    if loc:
        loc.latitude = data.latitude
        loc.longitude = data.longitude
        loc.accuracy = data.accuracy
        loc.recorded_at = now
        loc.source = data.source or "simulator"
    else:
        loc = models.LatestLocation(
            cane_id=cane_id,
            latitude=data.latitude,
            longitude=data.longitude,
            accuracy=data.accuracy,
            recorded_at=now,
            source=data.source or "simulator",
        )
        db.add(loc)

    db.add(
        models.LocationHistory(
            cane_id=cane_id,
            latitude=data.latitude,
            longitude=data.longitude,
            accuracy=data.accuracy,
            recorded_at=now,
            source=data.source or "simulator",
        )
    )

    db.commit()
    db.refresh(loc)
    return loc


@router.delete(
    "/{cane_id}/clear",
    status_code=204,
    summary="Șterge ultima locație (oprire simulator)",
)
def clear_location(
    cane_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_access(cane_id, current_user, db)
    db.query(models.LatestLocation).filter(
        models.LatestLocation.cane_id == cane_id
    ).delete()
    db.commit()


@router.get(
    "/{cane_id}/history",
    response_model=List[schemas.LocationHistoryOut],
    summary="Istoric traseului bastonului",
)
def get_location_history(
    cane_id: str,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _verify_access(cane_id, current_user, db)
    return (
        db.query(models.LocationHistory)
        .filter(models.LocationHistory.cane_id == cane_id)
        .order_by(models.LocationHistory.recorded_at.desc())
        .limit(limit)
        .all()
    )
