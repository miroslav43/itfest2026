from fastapi import APIRouter, Depends
from auth import get_current_user
import models
import schemas

router = APIRouter()


@router.get("/me", response_model=schemas.UserOut, summary="Profil utilizator curent")
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
