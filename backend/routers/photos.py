"""
조립체 사진 관리 API
- 로컬 모드: frontend/public/assembly_photos/ 에 저장
- 클라우드 모드: Supabase Storage에 저장 (DATABASE_URL 환경변수 있을 때)
"""
from fastapi import APIRouter, HTTPException, UploadFile, File
from pathlib import Path
from config.settings import DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET
from database.connection import get_connection
import json, time, shutil, httpx

router = APIRouter(prefix="/api/bom/nodes", tags=["photos"])

PHOTO_DIR  = Path(__file__).parent.parent.parent / "frontend" / "public" / "assembly_photos"
INDEX_FILE = PHOTO_DIR / "index.json"
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

USE_SUPABASE = bool(DATABASE_URL and SUPABASE_URL and SUPABASE_SERVICE_KEY)


# ── Supabase Storage 헬퍼 ───────────────────────────────────────────────────────
def _supabase_upload(filename: str, data: bytes, content_type: str) -> str:
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}"
    headers = {
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    r = httpx.put(url, content=data, headers=headers)
    if r.status_code not in (200, 201):
        raise HTTPException(500, f"Storage 업로드 실패: {r.text}")
    return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/{filename}"


def _supabase_delete(filename: str):
    url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/{filename}"
    headers = {"Authorization": f"Bearer {SUPABASE_SERVICE_KEY}"}
    httpx.delete(url, headers=headers)


# ── 로컬 파일 헬퍼 ──────────────────────────────────────────────────────────────
def _load_index() -> dict:
    if INDEX_FILE.exists():
        return json.loads(INDEX_FILE.read_text(encoding="utf-8"))
    return {}


def _save_index(idx: dict):
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    INDEX_FILE.write_text(json.dumps(idx, ensure_ascii=False, indent=2), encoding="utf-8")


# ── 목록 ────────────────────────────────────────────────────────────────────────
@router.get("/{node_id}/photos")
def list_photos(node_id: int):
    if USE_SUPABASE:
        conn = get_connection()
        try:
            rows = conn.execute(
                "SELECT filename, storage_url FROM node_photos WHERE node_id = %s ORDER BY created_at",
                (node_id,)
            ).fetchall()
            return [{"filename": r["filename"], "url": r["storage_url"]} for r in rows]
        finally:
            conn.close()
    else:
        idx = _load_index()
        filenames = idx.get(str(node_id), [])
        return [{"filename": f, "url": f"/assembly_photos/{f}"} for f in filenames]


# ── 업로드 ──────────────────────────────────────────────────────────────────────
@router.post("/{node_id}/photos")
async def upload_photo(node_id: int, file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if not ext:
        ext = ".jpg"
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"허용되지 않는 파일 형식: {ext}")

    seq = int(time.time() * 1000) % 10_000_000
    filename = f"node_{node_id}_{seq}{ext}"
    data = await file.read()
    content_type = file.content_type or "image/jpeg"

    if USE_SUPABASE:
        storage_url = _supabase_upload(filename, data, content_type)
        conn = get_connection()
        try:
            conn.execute(
                "INSERT INTO node_photos (node_id, filename, storage_url) VALUES (%s, %s, %s)",
                (node_id, filename, storage_url)
            )
            conn.commit()
        finally:
            conn.close()
        return {"filename": filename, "url": storage_url}
    else:
        PHOTO_DIR.mkdir(parents=True, exist_ok=True)
        dest = PHOTO_DIR / filename
        dest.write_bytes(data)
        idx = _load_index()
        idx.setdefault(str(node_id), []).append(filename)
        _save_index(idx)
        return {"filename": filename, "url": f"/assembly_photos/{filename}"}


# ── 삭제 ────────────────────────────────────────────────────────────────────────
@router.delete("/{node_id}/photos/{filename}")
def delete_photo(node_id: int, filename: str):
    if any(c in filename for c in ("/", "\\", "..")):
        raise HTTPException(400, "잘못된 파일명")

    if USE_SUPABASE:
        _supabase_delete(filename)
        conn = get_connection()
        try:
            conn.execute(
                "DELETE FROM node_photos WHERE node_id = %s AND filename = %s",
                (node_id, filename)
            )
            conn.commit()
        finally:
            conn.close()
    else:
        dest = PHOTO_DIR / filename
        if dest.exists():
            dest.unlink()
        idx = _load_index()
        key = str(node_id)
        if key in idx:
            idx[key] = [f for f in idx[key] if f != filename]
            if not idx[key]:
                del idx[key]
        _save_index(idx)

    return {"ok": True}
