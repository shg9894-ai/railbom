from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import sys

from config.settings import CORS_ORIGINS, LOG_LEVEL, DATABASE_URL
from database.connection import initialize_db
from routers import vehicles, formations, bom, compatibility, excel, photos, diagram_pages, change_requests, auth, failure_cases, repair_kits

# ── 로깅 설정 ──────────────────────────────────────────────────────────────────
logger.remove()
logger.add(sys.stderr, level=LOG_LEVEL, colorize=True,
           format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | {message}")
import os as _os
if not DATABASE_URL:
    logger.add("data/logs/bom.log", rotation="10 MB", retention="30 days",
               level=LOG_LEVEL, encoding="utf-8")

# ── DB 초기화 ──────────────────────────────────────────────────────────────────
logger.info("DB 초기화 시작")
initialize_db()
logger.info("DB 초기화 완료")

# ── FastAPI 앱 ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="철도차량 BOM 시스템",
    description="차종별 계층형 BOM 관리 API",
    version="1.0.0",
)

_allow_credentials = "*" not in CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(vehicles.router)
app.include_router(formations.router)
app.include_router(bom.router)
app.include_router(compatibility.router)
app.include_router(excel.router)
app.include_router(photos.router)
app.include_router(diagram_pages.router)
app.include_router(change_requests.router)
app.include_router(auth.router)
app.include_router(failure_cases.router)
app.include_router(repair_kits.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
