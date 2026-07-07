from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status

from backend.app.schemas import UserCreate, PasswordResetRequest, SettingsUpdate
from backend.app.database import fetch_all, fetch_one, execute_write, add_log
from backend.app.auth import require_admin, get_current_user, hash_password

router = APIRouter(tags=["Admin"])

@router.get("/api/admin/users")
def list_users(user = Depends(require_admin)):
    # get all registered users
    return fetch_all("SELECT id, username, fullname, role, created_at FROM users ORDER BY id ASC")

@router.post("/api/admin/users")
def create_user(data: UserCreate, user = Depends(require_admin)):
    # add new user account
    if data.role not in ("admin", "staff"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'staff'")
    existing = fetch_one("SELECT id FROM users WHERE username = ?", (data.username.strip(),))
    if existing:
        raise HTTPException(status_code=400, detail=f"Username '{data.username}' already exists")
    salt, digest = hash_password(data.password)
    user_id = execute_write(
        "INSERT INTO users (username, password_salt, password_hash, password_plaintext, fullname, role) VALUES (?, ?, ?, ?, ?, ?)",
        (data.username.strip(), salt, digest, data.password, data.fullname.strip(), data.role),
    )
    add_log(user["id"], "USER_CREATE", f"Created user '{data.username}' ({data.role})")
    return {"message": "User created", "id": user_id}

@router.delete("/api/admin/users/{user_id}")
def delete_user(user_id: int, user = Depends(require_admin)):
    # delete user account
    if user_id == user["id"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    user_row = fetch_one("SELECT id, username FROM users WHERE id = ?", (user_id,))
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
    execute_write("DELETE FROM users WHERE id = ?", (user_id,))
    add_log(user["id"], "USER_DELETE", f"Deleted user '{user_row['username']}'")
    return {"message": f"Deleted user '{user_row['username']}'"}

@router.post("/api/admin/users/{user_id}/reset-password")
def reset_user_password(user_id: int, data: PasswordResetRequest, user = Depends(require_admin)):
    # reset password for user
    user_row = fetch_one("SELECT id, username FROM users WHERE id = ?", (user_id,))
    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")
        
    salt, digest = hash_password(data.new_password)
    execute_write(
        "UPDATE users SET password_salt = ?, password_hash = ?, password_plaintext = ? WHERE id = ?",
        (salt, digest, data.new_password, user_id)
    )
    add_log(user["id"], "PASSWORD_RESET", f"Reset password for user '{user_row['username']}'")
    return {"message": f"Password reset for user '{user_row['username']}' successful"}

@router.get("/api/admin/logs")
def list_logs(user = Depends(require_admin)):
    # list system activity logs
    return fetch_all(
        """
        SELECT l.id, l.action, l.details, l.created_at, COALESCE(u.fullname, 'System') as username
        FROM logs l
        LEFT JOIN users u ON u.id = l.user_id
        ORDER BY l.created_at DESC
        LIMIT 200
        """
    )

@router.get("/api/settings")
def get_settings():
    # get company settings
    rows = fetch_all("SELECT key, value FROM settings")
    return {r["key"]: r["value"] for r in rows}

@router.put("/api/settings")
def update_settings(data: SettingsUpdate, user = Depends(require_admin)):
    # save custom settings
    for key, value in data.settings.items():
        existing = fetch_one("SELECT key FROM settings WHERE key = ?", (key,))
        if existing:
            execute_write("UPDATE settings SET value = ? WHERE key = ?", (value, key))
        else:
            execute_write("INSERT INTO settings (key, value) VALUES (?, ?)", (key, value))
    add_log(user["id"], "SETTINGS_UPDATE", f"Updated settings: {', '.join(data.settings.keys())}")
    return {"message": "Settings updated"}
