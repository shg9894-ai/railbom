from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from database.connection import get_connection

router = APIRouter(prefix="/api/diagram-page-requests", tags=["diagram-page-requests"])


class DiagramPageRequestCreate(BaseModel):
    page_id: int
    vehicle: str
    file_no: int
    assembly: Optional[str] = None
    request_type: str   # 'assembly_add' | 'assembly_edit' | 'page_delete' | 'other'
    current_value: Optional[str] = None
    requested_value: Optional[str] = None
    requested_drawing_no: Optional[str] = None
    requester_name: Optional[str] = None
    requester_note: Optional[str] = None


class ReviewBody(BaseModel):
    reviewer_note: Optional[str] = None


def _ensure_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS diagram_page_requests (
            id                   SERIAL PRIMARY KEY,
            page_id              INTEGER,
            vehicle              TEXT,
            file_no              INTEGER,
            assembly             TEXT,
            request_type         TEXT,
            current_value        TEXT,
            requested_value      TEXT,
            requested_drawing_no TEXT,
            requester_name       TEXT,
            requester_note       TEXT,
            status               TEXT DEFAULT 'pending',
            created_at           TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at          TIMESTAMPTZ,
            reviewer_note        TEXT
        )
    """)
    # 기존 테이블에 컬럼이 없으면 추가
    try:
        conn.execute("ALTER TABLE diagram_page_requests ADD COLUMN IF NOT EXISTS requested_drawing_no TEXT")
        conn.commit()
    except Exception:
        pass
    try:
        conn.commit()
    except Exception:
        pass


@router.post("", status_code=201)
def create_request(body: DiagramPageRequestCreate):
    VALID_TYPES = {'assembly_add', 'assembly_edit', 'page_delete', 'other'}
    if body.request_type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid request_type: {body.request_type}")

    conn = get_connection()
    try:
        _ensure_table(conn)
        cur = conn.execute(
            """INSERT INTO diagram_page_requests
               (page_id, vehicle, file_no, assembly, request_type,
                current_value, requested_value, requested_drawing_no, requester_name, requester_note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.page_id, body.vehicle, body.file_no, body.assembly,
             body.request_type, body.current_value, body.requested_value,
             body.requested_drawing_no, body.requester_name, body.requester_note),
        )
        conn.commit()
        return {"id": cur.lastrowid, "status": "pending"}
    finally:
        conn.close()


@router.get("")
def list_requests(status: Optional[str] = Query(None)):
    conn = get_connection()
    try:
        _ensure_table(conn)
        if status:
            rows = conn.execute(
                "SELECT * FROM diagram_page_requests WHERE status = ? ORDER BY created_at DESC",
                (status,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM diagram_page_requests ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.patch("/{rid}/approve")
def approve_request(rid: int, body: ReviewBody = ReviewBody()):
    conn = get_connection()
    try:
        _ensure_table(conn)
        req = conn.execute("SELECT * FROM diagram_page_requests WHERE id = ?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "Request not found")
        req = dict(req)
        if req["status"] != "pending":
            raise HTTPException(400, f"Already {req['status']}")

        rtype = req["request_type"]
        new_val = req["requested_value"]

        # 부품명 추가/수정: diagram_pages.assembly 실제 반영
        if rtype in ("assembly_add", "assembly_edit") and new_val:
            conn.execute(
                "UPDATE diagram_pages SET assembly = ? WHERE id = ?",
                (new_val, req["page_id"]),
            )
        # 도면번호 수정
        new_drawing = req.get("requested_drawing_no")
        if new_drawing:
            conn.execute(
                "UPDATE diagram_pages SET drawing_no = ? WHERE id = ?",
                (new_drawing, req["page_id"]),
            )

        conn.execute(
            "UPDATE diagram_page_requests SET status='approved', reviewed_at=CURRENT_TIMESTAMP, reviewer_note=? WHERE id=?",
            (body.reviewer_note, rid),
        )
        conn.commit()
        return {"id": rid, "status": "approved"}
    finally:
        conn.close()


@router.patch("/{rid}/reject")
def reject_request(rid: int, body: ReviewBody = ReviewBody()):
    conn = get_connection()
    try:
        _ensure_table(conn)
        req = conn.execute("SELECT * FROM diagram_page_requests WHERE id = ?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "Request not found")
        if dict(req)["status"] != "pending":
            raise HTTPException(400, f"Already {dict(req)['status']}")
        conn.execute(
            "UPDATE diagram_page_requests SET status='rejected', reviewed_at=CURRENT_TIMESTAMP, reviewer_note=? WHERE id=?",
            (body.reviewer_note, rid),
        )
        conn.commit()
        return {"id": rid, "status": "rejected"}
    finally:
        conn.close()
