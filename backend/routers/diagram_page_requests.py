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
    requester_name: Optional[str] = None
    requester_note: Optional[str] = None


class ReviewBody(BaseModel):
    reviewer_note: Optional[str] = None


def _ensure_table(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS diagram_page_requests (
            id              SERIAL PRIMARY KEY,
            page_id         INTEGER,
            vehicle         TEXT,
            file_no         INTEGER,
            assembly        TEXT,
            request_type    TEXT,
            current_value   TEXT,
            requested_value TEXT,
            requester_name  TEXT,
            requester_note  TEXT,
            status          TEXT DEFAULT 'pending',
            created_at      TIMESTAMPTZ DEFAULT NOW(),
            reviewed_at     TIMESTAMPTZ,
            reviewer_note   TEXT
        )
    """)
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
                current_value, requested_value, requester_name, requester_note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.page_id, body.vehicle, body.file_no, body.assembly,
             body.request_type, body.current_value, body.requested_value,
             body.requester_name, body.requester_note),
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
        if dict(req)["status"] != "pending":
            raise HTTPException(400, f"Already {dict(req)['status']}")
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
