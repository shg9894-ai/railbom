"""관리자 문의/요청 API.
사용자가 시스템 어디서든 문의·요청을 보낼 수 있고, 관리자가 답변/상태 관리.
스크린샷은 파일 첨부 또는 클립보드 붙여넣기로 1장 받음.
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from pathlib import Path
from typing import Optional
import time, json, httpx
from config.settings import DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_BUCKET
from database.connection import get_connection
from routers.deps import require_user, require_admin

router = APIRouter(prefix="/api/inquiries", tags=["inquiries"])

LOCAL_DIR = Path(__file__).parent.parent.parent / "frontend" / "public" / "inquiry_screenshots"
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
USE_SUPABASE = bool(DATABASE_URL and SUPABASE_URL and SUPABASE_SERVICE_KEY)


def _ensure_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS inquiries (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            user_role TEXT,
            page_path TEXT,
            message TEXT NOT NULL,
            screenshot_url TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            admin_reply TEXT,
            replied_by TEXT,
            replied_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """)
    conn.commit()


def _save_screenshot(file: UploadFile) -> str:
    ext = Path(file.filename or '').suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"허용되지 않는 파일 형식: {ext}")
    filename = f"inq_{int(time.time() * 1000)}{ext}"
    data = file.file.read()
    if USE_SUPABASE:
        url = f"{SUPABASE_URL}/storage/v1/object/{SUPABASE_BUCKET}/inquiries/{filename}"
        r = httpx.put(url, content=data, headers={
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type": file.content_type or 'image/png',
            "x-upsert": "true",
        })
        if r.status_code not in (200, 201):
            raise HTTPException(500, f"스크린샷 업로드 실패: {r.text[:200]}")
        return f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_BUCKET}/inquiries/{filename}"
    else:
        LOCAL_DIR.mkdir(parents=True, exist_ok=True)
        (LOCAL_DIR / filename).write_bytes(data)
        return f"/inquiry_screenshots/{filename}"


@router.post("")
async def create_inquiry(
    message: str = Form(...),
    page_path: Optional[str] = Form(None),
    screenshot: Optional[UploadFile] = File(None),
    user=Depends(require_user),
):
    """문의 제출 — 로그인한 모든 사용자."""
    if not message.strip():
        raise HTTPException(400, "메시지를 입력해주세요")

    screenshot_url = _save_screenshot(screenshot) if screenshot else None

    conn = get_connection()
    try:
        _ensure_table(conn)
        cur = conn.execute("""
            INSERT INTO inquiries (user_id, user_role, page_path, message, screenshot_url)
            VALUES (?, ?, ?, ?, ?)
        """, (user.get('sub'), user.get('role'), page_path, message.strip(), screenshot_url))
        conn.commit()
        # PgWrapper의 INSERT는 자동 RETURNING id 추가
        try:
            new_id = cur.fetchone()['id']
        except Exception:
            new_id = None
        return {'id': new_id, 'status': 'pending'}
    finally:
        conn.close()


@router.get("")
def list_inquiries(
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    _=Depends(require_user),
):
    """모든 사용자 — 전체 문의 게시판 (답변·상태 변경은 관리자만)."""
    conn = get_connection()
    try:
        _ensure_table(conn)
        where = ''
        params = []
        if status:
            where = 'WHERE status = ?'
            params.append(status)
        rows = conn.execute(f"""
            SELECT id, user_id, user_role, page_path, message, screenshot_url,
                   status, admin_reply, replied_by, replied_at, created_at
            FROM inquiries {where}
            ORDER BY created_at DESC LIMIT ? OFFSET ?
        """, (*params, limit, offset)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/my")
def my_inquiries(user=Depends(require_user)):
    """본인이 보낸 문의 — 모든 사용자."""
    conn = get_connection()
    try:
        _ensure_table(conn)
        rows = conn.execute("""
            SELECT id, message, screenshot_url, status, admin_reply, replied_at, created_at
            FROM inquiries WHERE user_id = ?
            ORDER BY created_at DESC LIMIT 50
        """, (user.get('sub'),)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.put("/{inquiry_id}")
def reply_inquiry(
    inquiry_id: int,
    body: dict,
    admin=Depends(require_admin),
):
    """관리자 전용 — 답변/상태 변경."""
    status = body.get('status')
    reply = body.get('admin_reply')
    if status and status not in ('pending', 'in_progress', 'resolved', 'closed'):
        raise HTTPException(400, f"잘못된 상태: {status}")
    conn = get_connection()
    try:
        _ensure_table(conn)
        sets = []
        params = []
        if reply is not None:
            sets.append("admin_reply = ?")
            params.append(reply)
            sets.append("replied_by = ?")
            params.append(admin.get('sub'))
            sets.append("replied_at = NOW()")
        if status:
            sets.append("status = ?")
            params.append(status)
        if not sets:
            raise HTTPException(400, "변경할 필드가 없습니다")
        params.append(inquiry_id)
        conn.execute(f"UPDATE inquiries SET {', '.join(sets)} WHERE id = ?", tuple(params))
        conn.commit()
        return {'id': inquiry_id, 'status': 'updated'}
    finally:
        conn.close()
