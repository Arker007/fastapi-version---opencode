import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.app.config import JWT_SECRET, JWT_ALGORITHM, TOKEN_EXPIRE_HOURS, PBKDF2_ITERATIONS
from backend.app.database import fetch_one

security = HTTPBearer(auto_error=False)

# hash password
def hash_password(password, salt=None):
    pwd_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        pwd_salt.encode("utf-8"),
        PBKDF2_ITERATIONS,
    ).hex()
    return pwd_salt, digest

# check password
def verify_password(password, pwd_salt, expected_hash):
    _, candidate = hash_password(password, pwd_salt)
    return hmac.compare_digest(candidate, expected_hash)

# create token
def create_access_token(user):
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    payload = {
        "sub": str(user["id"]),
        "username": user["username"],
        "role": user["role"],
        "fullname": user["fullname"],
        "exp": exp,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# check login
def get_current_user(credentials=Depends(security)):
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token required")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    
    user = fetch_one("SELECT id, username, fullname, role, created_at FROM users WHERE id = ?", (user_id,))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    return user

# check admin role
def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user

