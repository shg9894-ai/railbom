import json
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from database.connection import get_connection

router = APIRouter(prefix="/api/change-requests", tags=["change-requests"])

VALID_TYPES = {
    'corp_material_no_add', 'corp_material_no_edit', 'corp_material_no_delete',
    'bom_node_add', 'bom_node_edit', 'bom_node_delete', 'bom_node_revision',
    'photo_add', 'photo_delete',
}


class SimpleRequestCreate(BaseModel):
    node_id: int
    request_type: str
    current_value: Optional[str] = None
    requested_value: Optional[str] = None
    node_data: Optional[str] = None   # JSON string
    requester_name: Optional[str] = None
    requester_note: Optional[str] = None


class ReviewBody(BaseModel):
    reviewer_note: Optional[str] = None


@router.post("", status_code=201)
def create_request(body: SimpleRequestCreate):
    if body.request_type not in VALID_TYPES:
        raise HTTPException(400, f"Invalid request_type: {body.request_type}")

    conn = get_connection()
    try:
        node = conn.execute("SELECT id, name FROM bom_nodes WHERE id = ?", (body.node_id,)).fetchone()
        if not node:
            raise HTTPException(404, "Node not found")

        cur = conn.execute(
            """INSERT INTO change_requests
               (node_id, node_name, request_type, current_value, requested_value,
                node_data, requester_name, requester_note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (body.node_id, node['name'], body.request_type, body.current_value,
             body.requested_value, body.node_data, body.requester_name, body.requester_note),
        )
        conn.commit()
        return {"id": cur.lastrowid, "status": "pending"}
    finally:
        conn.close()


@router.post("/with-photo", status_code=201)
async def create_request_with_photo(
    node_id: int = Form(...),
    request_type: str = Form(...),
    requester_name: Optional[str] = Form(None),
    requester_note: Optional[str] = Form(None),
    current_value: Optional[str] = Form(None),
    photo: Optional[UploadFile] = File(None),
):
    if request_type not in ('photo_add', 'photo_delete'):
        raise HTTPException(400, "Use /with-photo only for photo requests")

    conn = get_connection()
    try:
        node = conn.execute("SELECT id, name FROM bom_nodes WHERE id = ?", (node_id,)).fetchone()
        if not node:
            raise HTTPException(404, "Node not found")

        photo_data = None
        photo_filename = None
        if photo:
            photo_data = await photo.read()
            photo_filename = photo.filename

        cur = conn.execute(
            """INSERT INTO change_requests
               (node_id, node_name, request_type, current_value,
                photo_filename, photo_data, requester_name, requester_note)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (node_id, node['name'], request_type, current_value,
             photo_filename, photo_data, requester_name, requester_note),
        )
        conn.commit()
        return {"id": cur.lastrowid, "status": "pending"}
    finally:
        conn.close()


@router.get("")
def list_requests(status: Optional[str] = None):
    conn = get_connection()
    try:
        where = "WHERE cr.status = ?" if status else ""
        params = (status,) if status else ()
        rows = conn.execute(
            f"""SELECT cr.id, cr.node_id, cr.node_name, cr.request_type,
                       cr.current_value, cr.requested_value, cr.node_data,
                       cr.photo_filename,
                       cr.requester_name, cr.requester_note,
                       cr.status, cr.created_at, cr.reviewed_at, cr.reviewer_note,
                       bn.vehicle_type_id,
                       vt.name AS vehicle_name,
                       bn.material_no, bn.corp_material_no
                FROM change_requests cr
                LEFT JOIN bom_nodes bn ON bn.id = cr.node_id
                LEFT JOIN vehicle_types vt ON vt.id = bn.vehicle_type_id
                {where}
                ORDER BY cr.created_at DESC""",
            params,
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/{rid}/photo")
def get_request_photo(rid: int):
    conn = get_connection()
    try:
        row = conn.execute("SELECT photo_data, photo_filename FROM change_requests WHERE id = ?", (rid,)).fetchone()
        if not row or not row['photo_data']:
            raise HTTPException(404, "No photo")
        from fastapi.responses import Response
        return Response(content=row['photo_data'], media_type="image/jpeg",
                        headers={"Content-Disposition": f"inline; filename={row['photo_filename'] or 'photo.jpg'}"})
    finally:
        conn.close()


@router.patch("/{rid}/approve")
def approve_request(rid: int, body: ReviewBody = ReviewBody()):
    conn = get_connection()
    try:
        req = conn.execute("SELECT * FROM change_requests WHERE id = ?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "Request not found")
        req = dict(req)
        if req["status"] != "pending":
            raise HTTPException(400, f"Already {req['status']}")

        node_id = req["node_id"]
        rtype = req["request_type"]
        val = req["requested_value"]

        if rtype == 'corp_material_no_add' or rtype == 'corp_material_no_edit':
            conn.execute("UPDATE bom_nodes SET corp_material_no=?, updated_at=CURRENT_TIMESTAMP WHERE id=?", (val, node_id))
        elif rtype == 'corp_material_no_delete':
            conn.execute("UPDATE bom_nodes SET corp_material_no=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?", (node_id,))
        elif rtype == 'bom_node_add':
            data = json.loads(req["node_data"] or "{}")
            parent = conn.execute("SELECT * FROM bom_nodes WHERE id=?", (node_id,)).fetchone()
            max_so = conn.execute(
                "SELECT COALESCE(MAX(sort_order),0) AS m FROM bom_nodes WHERE parent_id=?", (node_id,)
            ).fetchone()['m']
            sibling_cnt = conn.execute(
                "SELECT COUNT(*) AS c FROM bom_nodes WHERE parent_id=?", (node_id,)
            ).fetchone()['c']

            if data.get('kit'):
                # 수리키트: 기존 노드 ID 목록을 참조로 기록 (실제 노드 생성은 관리자가 검토 후)
                # 여기서는 kit_name으로 새 노드를 추가하고, node_data에 구성 정보를 보존
                kit_name = data.get('kit_name', '수리키트')
                mat = f"{parent['material_no']}-{sibling_cnt+1}" if parent and parent['material_no'] else None
                conn.execute("""
                    INSERT INTO bom_nodes
                    (vehicle_type_id, parent_id, name, material_no, sort_order, category_code, node_type)
                    SELECT vehicle_type_id, ?, ?, ?, ?, category_code, 'assembly'
                    FROM bom_nodes WHERE id=?
                """, (node_id, kit_name, mat, max_so + 1, node_id))
            else:
                # 신규 부품 목록 추가
                new_nodes = data.get('new_nodes', [])
                for i, n in enumerate(new_nodes, 1):
                    mat = f"{parent['material_no']}-{sibling_cnt+i}" if parent and parent['material_no'] else None
                    conn.execute("""
                        INSERT INTO bom_nodes
                        (vehicle_type_id, parent_id, name, manufacturer, manufacturer_pn,
                         specification, quantity, unit, weight_kg, material, notes,
                         material_no, sort_order, category_code, node_type)
                        SELECT vehicle_type_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, category_code, 'part'
                        FROM bom_nodes WHERE id=?
                    """, (
                        node_id, n.get('name', ''),
                        n.get('manufacturer'), n.get('manufacturer_pn'),
                        n.get('specification'), n.get('quantity'), n.get('unit'),
                        n.get('weight_kg'), n.get('material'), n.get('notes'),
                        mat, max_so + i, node_id,
                    ))

        elif rtype == 'bom_node_revision':
            # 개량: 현재 노드의 부모 아래에 .N suffix로 신규 노드 추가
            data = json.loads(req["node_data"] or "{}")
            n = data.get('node', {})
            target = conn.execute("SELECT * FROM bom_nodes WHERE id=?", (node_id,)).fetchone()
            if not target:
                raise HTTPException(404, "Target node not found")
            base_code = target['material_no'] or ''
            parent_id = target['parent_id']

            # 같은 부모 아래에서 base_code.N 패턴 찾아 다음 번호 계산
            siblings = conn.execute(
                "SELECT material_no FROM bom_nodes WHERE parent_id=? AND material_no LIKE ?",
                (parent_id, f"{base_code}.%")
            ).fetchall()
            existing = []
            for s in siblings:
                suffix = (s['material_no'] or '').replace(base_code + '.', '')
                try:
                    existing.append(int(suffix))
                except ValueError:
                    pass
            next_rev = max(existing) + 1 if existing else 1
            new_mat = f"{base_code}.{next_rev}"

            max_so = conn.execute(
                "SELECT COALESCE(MAX(sort_order),0) AS m FROM bom_nodes WHERE parent_id=?", (parent_id,)
            ).fetchone()['m']
            conn.execute("""
                INSERT INTO bom_nodes
                (vehicle_type_id, parent_id, name, manufacturer, manufacturer_pn,
                 specification, quantity, unit, weight_kg, material, notes,
                 material_no, sort_order, category_code, node_type)
                SELECT vehicle_type_id, parent_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, category_code, node_type
                FROM bom_nodes WHERE id=?
            """, (
                n.get('name') or target['name'],
                n.get('manufacturer') or target['manufacturer'],
                n.get('manufacturer_pn') or target['manufacturer_pn'],
                n.get('specification') or target['specification'],
                n.get('quantity') or target['quantity'],
                n.get('unit') or target['unit'],
                n.get('weight_kg') or target['weight_kg'],
                n.get('material') or target['material'],
                n.get('notes') or target['notes'],
                new_mat, max_so + 1,
                node_id,
            ))

        elif rtype == 'bom_node_edit':
            fields = json.loads(req["node_data"] or "{}")
            allowed = {'name','manufacturer','manufacturer_pn','specification',
                       'quantity','unit','weight_kg','material','notes','corp_material_no','material_no'}
            sets = ", ".join(f"{k}=?" for k in fields if k in allowed)
            vals = [v for k, v in fields.items() if k in allowed]
            if sets:
                conn.execute(f"UPDATE bom_nodes SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                             (*vals, node_id))
        elif rtype == 'bom_node_delete':
            conn.execute("DELETE FROM bom_nodes WHERE id=?", (node_id,))
        elif rtype == 'photo_add':
            # photo_data already stored; copy to assembly_photos
            photo_data = req.get('photo_data')
            photo_filename = req.get('photo_filename') or f"req_{rid}.jpg"
            if photo_data:
                import os
                photos_dir = "C:/Dev/railway-bom/backend/assembly_photos"
                os.makedirs(photos_dir, exist_ok=True)
                dest = os.path.join(photos_dir, f"{node_id}_{photo_filename}")
                with open(dest, 'wb') as f:
                    f.write(photo_data)
                # register in node_photos if table exists
                try:
                    conn.execute("INSERT INTO node_photos (node_id, filename) VALUES (?,?)",
                                 (node_id, f"{node_id}_{photo_filename}"))
                except Exception:
                    pass

        conn.execute(
            "UPDATE change_requests SET status='approved', reviewed_at=CURRENT_TIMESTAMP, reviewer_note=? WHERE id=?",
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
        req = conn.execute("SELECT * FROM change_requests WHERE id=?", (rid,)).fetchone()
        if not req:
            raise HTTPException(404, "Request not found")
        if dict(req)["status"] != "pending":
            raise HTTPException(400, f"Already {dict(req)['status']}")
        conn.execute(
            "UPDATE change_requests SET status='rejected', reviewed_at=CURRENT_TIMESTAMP, reviewer_note=? WHERE id=?",
            (body.reviewer_note, rid),
        )
        conn.commit()
        return {"id": rid, "status": "rejected"}
    finally:
        conn.close()
