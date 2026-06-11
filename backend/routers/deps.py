"""
FastAPI 인증 의존성.
  require_user  : 유효한 토큰이면 통과 (staff / admin)
  require_admin : admin 토큰만 통과
"""
from fastapi import Depends, HTTPException, Request
from jose import jwt, JWTError
from config.settings import SECRET_KEY

ALGORITHM  = "HS256"


def _extract(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "로그인이 필요합니다")
    token = auth[7:]
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "토큰이 유효하지 않거나 만료되었습니다")


def require_user(request: Request) -> dict:
    return _extract(request)


def require_admin(request: Request) -> dict:
    payload = _extract(request)
    if payload.get("role") != "admin":
        raise HTTPException(403, "관리자만 접근 가능합니다")
    return payload
