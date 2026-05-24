from fastapi import APIRouter, HTTPException, Query, Body
from fastapi.responses import FileResponse, RedirectResponse
from typing import Optional, List
from pathlib import Path
from pydantic import BaseModel
from database.connection import get_connection
from config.settings import DATABASE_URL, SUPABASE_URL, SUPABASE_BUCKET

router = APIRouter(prefix="/api/diagram-pages", tags=["diagram-pages"])

# 클라우드 모드: Supabase Storage의 파일명 규칙
SUPABASE_DIAGRAM_BUCKET = "diagrams"
CLOUD_FILENAMES = {
    "emu260":    lambda n: f"emu260_p{n:03d}.jpg",
    "emu320":    lambda n: f"emu320_p{n:03d}.jpg",
    "KTX-산천2": lambda n: f"ktx720_p{n:03d}.jpg",
    "KTX-산천4": lambda n: f"ktx730_p{n:03d}.jpg",
    "KTX-산천1": lambda n: f"ktx750_p{n:03d}.jpg",
    "KTX-산천3": lambda n: f"ktx760_p{n:03d}.jpg",
    "ITX-마음":  lambda n: f"itxmaum_p{n:03d}.jpg",
    "KTX-1":     lambda n: f"ktx1_p{n:03d}.jpg",
}

# 로컬 모드: 원본 파일 경로
_LOCAL_BASE = Path(r"C:\Users\shg98\Desktop\철도공사\2차 추가 백데이터")
_MAUM_BASE = Path(r"C:\Users\shg98\Desktop\철도공사\3차 추가 백데이터(마음, KTX 부품도해집)")
IMAGE_DIRS = {
    "emu260":    _LOCAL_BASE / "ktx 이음 명칭도감_1",
    "emu320":    _LOCAL_BASE / "KTX-청룡_명칭도감",
    "KTX-산천2": _LOCAL_BASE / "별첨1_호남) 명칭도감(안)",
    "KTX-산천4": _LOCAL_BASE / "KTX-산천(원강선) 명칭도감",
    "KTX-산천1": _LOCAL_BASE / "KTX-Sancheon_IllustratedPartsCatalog(100량 명칭도감) 산천",
    "ITX-마음":  _MAUM_BASE / "ITX-마음_부품명칭도감",
}
IMAGE_FILENAMES = {
    "emu260":    lambda n: f"ktx 이음 명칭도감_{n}.jpeg",
    "emu320":    lambda n: f"KTX-청룡_명칭도감_{n}.jpg",
    "KTX-산천2": lambda n: f"별첨1_호남) 명칭도감(안)_{n}.jpg",
    "KTX-산천4": lambda n: f"KTX-산천(원강선) 명칭도감_{n}.jpg",
    "KTX-산천1": lambda n: f"KTX-Sancheon_IllustratedPartsCatalog(100량 명칭도감) 산천_{n}.jpg",
    "ITX-마음":  lambda n: f"(2023.10.13 승인) ITX-마음_부품명칭도감_{n}.jpg",
}

IMAGE_DIR = IMAGE_DIRS["emu260"]


@router.get("/image/{file_no}")
def get_image(file_no: int, vehicle: Optional[str] = Query("emu260")):
    if DATABASE_URL and SUPABASE_URL:
        name_fn = CLOUD_FILENAMES.get(vehicle, CLOUD_FILENAMES.get("emu260"))
        if name_fn is None:
            raise HTTPException(404, f"지원하지 않는 차종: {vehicle}")
        filename = name_fn(file_no)
        url = f"{SUPABASE_URL}/storage/v1/object/public/{SUPABASE_DIAGRAM_BUCKET}/{filename}"
        return RedirectResponse(url, status_code=302)
    else:
        img_dir = IMAGE_DIRS.get(vehicle, IMAGE_DIRS["emu260"])
        filename = IMAGE_FILENAMES.get(vehicle, IMAGE_FILENAMES["emu260"])(file_no)
        path = img_dir / filename
        if not path.exists():
            raise HTTPException(404, f"이미지 없음: {vehicle}/{file_no}")
        return FileResponse(str(path), media_type="image/jpeg")


def _fetch_pages_with_parts(conn, rows):
    result = []
    for r in rows:
        page = dict(r)
        parts = conn.execute(
            "SELECT part_no, part_name FROM diagram_page_parts WHERE page_id = ? ORDER BY id",
            (page["id"],)
        ).fetchall()
        page["parts"] = [dict(p) for p in parts]
        result.append(page)
    return result


@router.get("/by-drawing/{drawing_no}")
def get_by_drawing_no(drawing_no: str, vehicle: Optional[str] = Query(None)):
    # suffix 제거: RET10003FK0-001 → RET10003FK0
    base_no = drawing_no.split("-")[0] if "-" in drawing_no else drawing_no

    conn = get_connection()
    try:
        candidates = [drawing_no] if drawing_no == base_no else [drawing_no, base_no]
        for dno in candidates:
            if vehicle:
                rows = conn.execute(
                    "SELECT * FROM diagram_pages WHERE drawing_no = ? AND vehicle = ? ORDER BY file_no",
                    (dno, vehicle)
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM diagram_pages WHERE drawing_no = ? ORDER BY file_no",
                    (dno,)
                ).fetchall()
            if rows:
                return _fetch_pages_with_parts(conn, rows)
        return []
    finally:
        conn.close()


class HasPagesRequest(BaseModel):
    drawing_nos: List[str] = []
    node_names: List[str] = []


@router.post("/has-pages")
def has_pages(body: HasPagesRequest, vehicle: Optional[str] = Query(None)):
    """drawing_no 또는 node_name 기준으로 명칭도감 페이지가 있는 항목 반환.
    반환: { matched_drawing_nos: [...], matched_node_names: [...] }
    """
    conn = get_connection()
    try:
        result_dnos: List[str] = []
        result_names: List[str] = []

        # 1) drawing_no → diagram_pages.drawing_no 직접 매칭
        if body.drawing_nos:
            bases = {dno: dno.split("-")[0] if "-" in dno else dno for dno in body.drawing_nos}
            all_candidates = list(set(bases.values()))
            placeholders = ",".join("?" * len(all_candidates))
            if vehicle:
                rows = conn.execute(
                    f"SELECT DISTINCT drawing_no FROM diagram_pages WHERE drawing_no IN ({placeholders}) AND vehicle = ?",
                    all_candidates + [vehicle]
                ).fetchall()
            else:
                rows = conn.execute(
                    f"SELECT DISTINCT drawing_no FROM diagram_pages WHERE drawing_no IN ({placeholders})",
                    all_candidates
                ).fetchall()
            found = {r[0] for r in rows}
            result_dnos = [dno for dno, base in bases.items() if base in found]

            # 1b) drawing_no가 corp_material_no로 연결된 경우 (bom_node_diagrams 경유)
            # drawing_no 컬럼이 없는 차종(산천류 등)을 위해 bom_nodes.corp_material_no 기준 추가 체크
            if vehicle:
                not_found = [dno for dno in body.drawing_nos if dno not in result_dnos]
                if not_found:
                    # drawing_no 값을 corp_material_no로 간주해 bom_node_diagrams 조회
                    phs = ",".join("?" * len(not_found))
                    rows_bnd = conn.execute(
                        f"""SELECT DISTINCT bn.corp_material_no, bn.drawing_no, bn.manufacturer_pn
                            FROM bom_node_diagrams bnd
                            JOIN diagram_pages dp ON dp.id = bnd.diagram_page_id
                            JOIN bom_nodes bn ON bn.id = bnd.bom_node_id
                            WHERE dp.vehicle = ?
                            AND (bn.corp_material_no IN ({phs})
                              OR bn.drawing_no IN ({phs})
                              OR bn.manufacturer_pn IN ({phs}))""",
                        [vehicle] + not_found + not_found + not_found
                    ).fetchall()
                    for r in rows_bnd:
                        for val in [r[0], r[1], r[2]]:
                            if val and val in not_found and val not in result_dnos:
                                result_dnos.append(val)

        # 2) node_name → assembly 매칭 (drawing_no가 없는 차종용)
        if body.node_names and vehicle:
            placeholders2 = ",".join("?" * len(body.node_names))
            rows2 = conn.execute(
                f"SELECT DISTINCT assembly FROM diagram_pages WHERE assembly IN ({placeholders2}) AND vehicle = ?",
                body.node_names + [vehicle]
            ).fetchall()
            result_names = [r[0] for r in rows2]

            # 2b) bom_node_diagrams 통해 name 매칭
            if not result_names:
                rows3 = conn.execute(
                    f"""SELECT DISTINCT bn.name
                        FROM bom_node_diagrams bnd
                        JOIN diagram_pages dp ON dp.id = bnd.diagram_page_id
                        JOIN bom_nodes bn ON bn.id = bnd.bom_node_id
                        WHERE dp.vehicle = ?
                        AND bn.name IN ({placeholders2})""",
                    [vehicle] + body.node_names
                ).fetchall()
                result_names = [r[0] for r in rows3]

        return {"matched_drawing_nos": result_dnos, "matched_node_names": result_names}
    finally:
        conn.close()


@router.get("/by-assembly")
def get_by_assembly(assembly: str, vehicle: Optional[str] = Query("emu260")):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM diagram_pages WHERE assembly = ? AND vehicle = ? ORDER BY file_no",
            (assembly, vehicle)
        ).fetchall()
        return _fetch_pages_with_parts(conn, rows)
    finally:
        conn.close()


@router.get("/chapter/{vehicle}")
def get_chapters(vehicle: str):
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT DISTINCT chapter_no, chapter
               FROM diagram_pages
               WHERE vehicle = ? AND chapter IS NOT NULL
               ORDER BY chapter_no""",
            (vehicle,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/linked-bom/{page_id}")
def get_linked_bom(page_id: int):
    """명칭도감 페이지에 연결된 BOM 노드 목록"""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT bnd.id AS link_id, bnd.match_type, bnd.confidence,
                      bn.id, bn.vehicle_type_id, bn.node_type, bn.category_code,
                      bn.material_no, bn.name, bn.name_en, bn.drawing_no,
                      bn.quantity, bn.unit, bn.manufacturer
               FROM bom_node_diagrams bnd
               JOIN bom_nodes bn ON bn.id = bnd.bom_node_id
               WHERE bnd.diagram_page_id = ?
               ORDER BY bn.vehicle_type_id, bn.name""",
            (page_id,)
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/{vehicle}")
def list_pages(
    vehicle: str,
    chapter_no: Optional[int] = Query(None),
    page_type: Optional[str] = Query(None),
):
    conn = get_connection()
    try:
        conditions = ["vehicle = ?"]
        params = [vehicle]
        if chapter_no is not None:
            conditions.append("chapter_no = ?")
            params.append(chapter_no)
        if page_type:
            conditions.append("page_type = ?")
            params.append(page_type)
        where = " AND ".join(conditions)
        rows = conn.execute(
            f"SELECT * FROM diagram_pages WHERE {where} ORDER BY file_no, id",
            params
        ).fetchall()
        # file_no 기준으로 중복 제거 — 같은 페이지의 여러 assembly를 합침
        seen: dict = {}
        result = []
        page_ids = []
        for r in rows:
            d = dict(r)
            fno = d["file_no"]
            if fno not in seen:
                d["linked_bom"] = []
                seen[fno] = d
                result.append(d)
                page_ids.append(d["id"])
            else:
                existing = seen[fno]
                asm = d.get("assembly")
                if asm and asm not in (existing.get("assembly") or ""):
                    existing["assembly"] = f"{existing['assembly'] or ''} / {asm}".strip(" /")

        # 연결된 BOM 노드 조회
        if page_ids:
            placeholders = ",".join("?" * len(page_ids))
            bom_rows = conn.execute(
                f"""SELECT bnd.diagram_page_id, bn.material_no, bn.name
                    FROM bom_node_diagrams bnd
                    JOIN bom_nodes bn ON bn.id = bnd.bom_node_id
                    WHERE bnd.diagram_page_id IN ({placeholders})
                    ORDER BY bnd.diagram_page_id, bn.name""",
                page_ids,
            ).fetchall()
            # page_id → 대표 id 매핑
            pid_map = {d["id"]: d for d in result}
            for br in bom_rows:
                page = pid_map.get(br["diagram_page_id"])
                if page is not None:
                    page["linked_bom"].append({
                        "material_no": br["material_no"],
                        "name": br["name"],
                    })

        return result
    finally:
        conn.close()
