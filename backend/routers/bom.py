from fastapi import APIRouter, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from schemas.bom import BomNodeCreate, BomNodeUpdate, BomNodeMove, BomReorder
from database.repositories import bom_repo, node_materials_repo

router = APIRouter(prefix="/api/bom", tags=["bom"])


@router.get("/tree/{vehicle_type_id}")
def get_tree(vehicle_type_id: int, category: Optional[str] = Query(None)):
    return bom_repo.get_tree(vehicle_type_id, category)


@router.get("/roots/{vehicle_type_id}")
def get_roots(vehicle_type_id: int, category: Optional[str] = Query(None)):
    """최상위 노드만 반환 (지연 로딩용)"""
    return bom_repo.get_roots(vehicle_type_id, category)


@router.get("/nodes/{node_id}/children-lazy")
def get_children_lazy(node_id: int):
    """직계 자식 + 자식 존재 여부 반환 (지연 로딩용)"""
    return bom_repo.get_children_with_flag(node_id)


@router.get("/search")
def search_nodes(vehicle_id: int, q: str):
    if len(q) < 1:
        return []
    return bom_repo.search_nodes(vehicle_id, q)


@router.get("/search-global")
def search_nodes_global(q: str, vehicle_id: Optional[int] = Query(None)):
    if len(q) < 1:
        return []
    return bom_repo.search_nodes_global(q, vehicle_id)


@router.get("/search-by-corp-material-no")
def search_by_corp_material_no(q: str):
    """공사 자재번호로 전체 차종에서 사용 위치 조회"""
    if not q:
        return []
    return bom_repo.search_by_corp_material_no(q)


@router.get("/nodes/{node_id}")
def get_node(node_id: int):
    node = bom_repo.get_node_by_id(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    return node


@router.get("/nodes/{node_id}/children")
def get_children(node_id: int):
    return bom_repo.get_children(node_id)


@router.get("/nodes/{node_id}/ancestors")
def get_ancestors(node_id: int):
    return bom_repo.get_ancestors(node_id)


@router.post("/nodes", status_code=201)
def create_node(body: BomNodeCreate):
    return bom_repo.create_node(body.model_dump())


@router.put("/nodes/{node_id}")
def update_node(node_id: int, body: BomNodeUpdate):
    if not bom_repo.get_node_by_id(node_id):
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    return bom_repo.update_node(node_id, body.model_dump())


@router.post("/nodes/{node_id}/move")
def move_node(node_id: int, body: BomNodeMove):
    if not bom_repo.get_node_by_id(node_id):
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    return bom_repo.move_node(node_id, body.new_parent_id, body.new_vehicle_type_id)


@router.put("/nodes/reorder")
def reorder_nodes(body: BomReorder):
    bom_repo.reorder_nodes(body.ordered_ids)
    return {"ok": True}


@router.delete("/nodes/{node_id}", status_code=204)
def delete_node(node_id: int):
    if not bom_repo.get_node_by_id(node_id):
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    bom_repo.delete_node(node_id)


# ── 명칭도감 연결 ──────────────────────────────────────────────────────────────

from database.connection import get_connection
from pydantic import BaseModel as _BaseModel


class DiagramLinkBody(_BaseModel):
    diagram_page_id: int
    match_type: str = "manual"
    confidence: float = 1.0


@router.get("/nodes/{node_id}/diagrams")
def get_node_diagrams(node_id: int):
    """BOM 노드에 연결된 명칭도감 페이지 목록"""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT bnd.id AS link_id, bnd.match_type, bnd.confidence,
                      dp.id, dp.vehicle, dp.file_no, dp.book_page, dp.source_file,
                      dp.page_type, dp.chapter_no, dp.chapter, dp.assembly,
                      dp.parent_assembly, dp.drawing_no
               FROM bom_node_diagrams bnd
               JOIN diagram_pages dp ON dp.id = bnd.diagram_page_id
               WHERE bnd.bom_node_id = ?
               ORDER BY dp.vehicle, dp.file_no""",
            (node_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/nodes/{node_id}/diagrams", status_code=201)
def link_diagram(node_id: int, body: DiagramLinkBody):
    """BOM 노드에 명칭도감 페이지 수동 연결"""
    if not bom_repo.get_node_by_id(node_id):
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    conn = get_connection()
    try:
        try:
            cursor = conn.execute(
                """INSERT INTO bom_node_diagrams (bom_node_id, diagram_page_id, match_type, confidence)
                   VALUES (?, ?, ?, ?)""",
                (node_id, body.diagram_page_id, body.match_type, body.confidence)
            )
            conn.commit()
            return {"id": cursor.lastrowid, "bom_node_id": node_id, **body.model_dump()}
        except Exception as e:
            if "UNIQUE" in str(e):
                raise HTTPException(status_code=409, detail="이미 연결된 페이지입니다.")
            raise HTTPException(status_code=400, detail=str(e))
    finally:
        conn.close()


@router.delete("/nodes/{node_id}/diagrams/{link_id}", status_code=204)
def unlink_diagram(node_id: int, link_id: int):
    """BOM 노드와 명칭도감 페이지 연결 해제"""
    conn = get_connection()
    try:
        conn.execute(
            "DELETE FROM bom_node_diagrams WHERE id = ? AND bom_node_id = ?",
            (link_id, node_id)
        )
        conn.commit()
    finally:
        conn.close()


# ── 공사 자재번호 (다대다) ──────────────────────────────────────────────────────

class NodeMaterialBody(BaseModel):
    corp_material_no: str
    vehicle_type_id: Optional[int] = None
    is_primary: bool = False
    notes: Optional[str] = None


@router.get("/nodes/{node_id}/materials")
def list_materials(node_id: int):
    return node_materials_repo.get_by_node(node_id)


@router.post("/nodes/{node_id}/materials", status_code=201)
def add_material(node_id: int, body: NodeMaterialBody):
    if not bom_repo.get_node_by_id(node_id):
        raise HTTPException(status_code=404, detail="노드를 찾을 수 없습니다.")
    try:
        return node_materials_repo.create(node_id, body.model_dump())
    except Exception as e:
        if "UNIQUE" in str(e):
            raise HTTPException(status_code=409, detail="이미 등록된 자재번호입니다.")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/nodes/{node_id}/materials/{mat_id}")
def update_material(node_id: int, mat_id: int, body: NodeMaterialBody):
    result = node_materials_repo.update(mat_id, body.model_dump())
    if not result:
        raise HTTPException(status_code=404, detail="자재번호를 찾을 수 없습니다.")
    return result


@router.delete("/nodes/{node_id}/materials/{mat_id}", status_code=204)
def delete_material(node_id: int, mat_id: int):
    node_materials_repo.delete(mat_id)
