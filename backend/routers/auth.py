"""
routers/auth.py
Authentication endpoints: login and current-user info.
"""
import hashlib
from fastapi import APIRouter, HTTPException, Depends

from config import USERS
from dependencies import make_token, get_current_user
from models import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest):
    """
    Authenticate with email + password.
    Returns a JWT-style token valid for 24 hours.
    """
    user = USERS.get(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    expected_hash = hashlib.sha256(req.password.encode()).hexdigest()
    if user["password_hash"] != expected_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    return {
        "token": make_token(req.email),
        "user":  {"email": req.email, "name": user["name"],
                  "role": user["role"], "cert": user["cert"]},
    }


@router.get("/me", response_model=UserOut)
def me(user: dict = Depends(get_current_user)):
    """Return the currently authenticated pilot's profile."""
    return {"email": user["email"], "name": user["name"],
            "role": user["role"],   "cert": user["cert"]}
