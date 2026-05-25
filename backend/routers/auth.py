from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from jose import jwt
from datetime import datetime, timedelta
from database.connection import get_connection
import os

router = APIRouter(prefix="/api/auth", tags=["auth"])

SECRET_KEY          = os.environ.get("SECRET_KEY",    "railway-bom-secret-2026")
ALGORITHM           = "HS256"
TOKEN_EXPIRE_HOURS  = 12

ADMIN_ID            = os.environ.get("ADMIN_ID",      "0417")
ADMIN_PW            = os.environ.get("ADMIN_PW",      "asdf12345!@")
STAFF_PW            = os.environ.get("STAFF_PW",      "korail7788")
ALLOWED_PLANT_CODES = set(os.environ.get("ALLOWED_PLANT_CODES", "1000,5100,5200,5300,5400,5500").split(","))


class LoginRequest(BaseModel):
    user_id: str
    password: str


def create_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "role": role, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except Exception:
        raise HTTPException(401, "Invalid or expired token")


@router.post("/login")
def login(body: LoginRequest, request: Request):
    uid = body.user_id.strip()
    pw = body.password

    if uid == ADMIN_ID and pw == ADMIN_PW:
        role = "admin"
    elif uid in ALLOWED_PLANT_CODES and pw == STAFF_PW:
        role = "staff"
    else:
        raise HTTPException(401, "아이디 또는 비밀번호가 올바르지 않습니다")

    ip = request.client.host if request.client else "unknown"
    conn = get_connection()
    try:
        conn.execute(
            "INSERT INTO login_logs (user_id, role, ip) VALUES (?, ?, ?)",
            (uid, role, ip)
        )
        conn.commit()
    finally:
        conn.close()

    token = create_token(uid, role)
    return {"token": token, "role": role, "user_id": uid}


@router.get("/me")
def me(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "No token")
    payload = decode_token(auth[7:])
    return {"user_id": payload["sub"], "role": payload["role"]}


@router.get("/login-logs")
def login_logs(request: Request, limit: int = 200):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "No token")
    payload = decode_token(auth[7:])
    if payload.get("role") != "admin":
        raise HTTPException(403, "관리자만 접근 가능합니다")
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM login_logs ORDER BY logged_in_at DESC LIMIT ?",
            (limit,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
