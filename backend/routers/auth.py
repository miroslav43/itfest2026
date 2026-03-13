from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token

router = APIRouter()


@router.post("/signup", response_model=schemas.Token, summary="Înregistrare cont nou")
def signup(data: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email-ul este deja folosit.")
    if len(data.password) < 6:
        raise HTTPException(status_code=400, detail="Parola trebuie să aibă cel puțin 6 caractere.")

    user = models.User(email=data.email, hashed_password=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}


@router.post("/login", response_model=schemas.Token, summary="Autentificare")
def login(data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email sau parolă incorectă.")
    return {"access_token": create_access_token(str(user.id)), "token_type": "bearer"}
