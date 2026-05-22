from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database.connection import get_connection

router = APIRouter(prefix="/api/failure-cases", tags=["failure-cases"])


class FailureCaseCreate(BaseModel):
    node_id: int
    title: str
    symptom: Optional[str] = None
    cause: Optional[str] = None
    action: Optional[str] = None
    author: Optional[str] = None


class FailureCaseUpdate(BaseModel):
    title: Optional[str] = None
    symptom: Optional[str] = None
    cause: Optional[str] = None
    action: Optional[str] = None


@router.get("/node/{node_id}")
def list_by_node(node_id: int):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM failure_cases WHERE node_id=? ORDER BY created_at DESC",
            (node_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("", status_code=201)
def create(body: FailureCaseCreate):
    conn = get_connection()
    try:
        node = conn.execute("SELECT id FROM bom_nodes WHERE id=?", (body.node_id,)).fetchone()
        if not node:
            raise HTTPException(404, "Node not found")
        cur = conn.execute(
            """INSERT INTO failure_cases (node_id, title, symptom, cause, action, author)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (body.node_id, body.title, body.symptom, body.cause, body.action, body.author)
        )
        conn.commit()
        return {"id": cur.lastrowid}
    finally:
        conn.close()


@router.patch("/{fid}")
def update(fid: int, body: FailureCaseUpdate):
    conn = get_connection()
    try:
        row = conn.execute("SELECT id FROM failure_cases WHERE id=?", (fid,)).fetchone()
        if not row:
            raise HTTPException(404, "Not found")
        fields = {k: v for k, v in body.model_dump().items() if v is not None}
        if fields:
            sets = ", ".join(f"{k}=?" for k in fields)
            conn.execute(
                f"UPDATE failure_cases SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                (*fields.values(), fid)
            )
            conn.commit()
        return {"id": fid}
    finally:
        conn.close()


@router.delete("/{fid}")
def delete(fid: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM failure_cases WHERE id=?", (fid,))
        conn.commit()
        return {"id": fid}
    finally:
        conn.close()
