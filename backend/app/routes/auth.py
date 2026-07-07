from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.schemas import LoginRequest
from backend.app.database import fetch_one, add_log
from backend.app.auth import verify_password, create_access_token, get_current_user

router = APIRouter(tags=["Auth"])

@router.post("/api/auth/login")
def login(data: LoginRequest):
    # verify user password and login
    user = fetch_one("SELECT * FROM users WHERE username = ?", (data.username.strip(),))
    if user is None or not verify_password(data.password, user["password_salt"], user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid username or password")

    token = create_access_token(user)
    add_log(user["id"], "LOGIN", f"User '{user['username']}' logged in")
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "fullname": user["fullname"],
            "role": user["role"],
        },
    }

@router.get("/api/auth/me")
def me(user = Depends(get_current_user)):
    # get active user session details
    return user
