"""자재마스터 조회 API."""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from database.connection import get_connection

router = APIRouter(prefix="/api/material-master", tags=["material-master"])

# 시스템에서 노출할 자재유형 (그 외는 모두 숨김)
ALLOWED_TYPES = ('ERSA', 'HIBE', 'ERSB')


@router.get("/search")
def search(
    q: Optional[str] = Query(None, description="자재번호/내역/제조자PN 검색"),
    product_group_prefix: Optional[str] = Query(None, description="용품별그룹 앞 4자리(BB01 등)"),
    material_type: Optional[str] = None,
    is_unused: Optional[bool] = None,
    limit: int = 50,
    offset: int = 0,
):
    """자재마스터 검색. ALLOWED_TYPES(ERSA/HIBE/ERSB)만 노출."""
    conn = get_connection()
    try:
        where = []
        params = []
        if q and q.strip():
            qs = q.strip()
            where.append("(material_no ILIKE ? OR material_desc ILIKE ? OR manufacturer_pn ILIKE ? OR legacy_material_no ILIKE ?)")
            like = f'%{qs}%'
            params += [like, like, like, like]
        if product_group_prefix:
            where.append("product_group LIKE ?")
            params.append(f'{product_group_prefix}%')
        if material_type and material_type in ALLOWED_TYPES:
            where.append("material_type = ?")
            params.append(material_type)
        else:
            # 유형 미선택 시에도 ALLOWED_TYPES만 노출
            placeholders = ','.join(['?'] * len(ALLOWED_TYPES))
            where.append(f"material_type IN ({placeholders})")
            params += list(ALLOWED_TYPES)
        if is_unused is not None:
            where.append("is_unused = ?")
            params.append(is_unused)

        where_clause = ('WHERE ' + ' AND '.join(where)) if where else ''
        sql = f"""
            SELECT material_no, material_desc, manufacturer_pn, unit,
                   product_group, product_group_desc,
                   material_group, material_group_desc,
                   material_type, material_type_desc,
                   importance, importance_desc,
                   procurement, procurement_desc,
                   lead_time_days, legacy_material_no, created_date,
                   is_unused
            FROM material_master
            {where_clause}
            ORDER BY material_no
            LIMIT ? OFFSET ?
        """
        params_with_paging = params + [limit, offset]
        rows = conn.execute(sql, tuple(params_with_paging)).fetchall()
        items = [dict(r) for r in rows]

        # BOM 연결 정보 일괄 조회
        if items:
            mat_nos = [it['material_no'] for it in items]
            placeholders = ','.join(['?'] * len(mat_nos))
            bom_rows = conn.execute(f"""
                SELECT b.corp_material_no, b.id, b.material_no AS bom_code, b.name,
                       vt.code AS vehicle_code, vt.name AS vehicle_name
                FROM bom_nodes b LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
                WHERE b.corp_material_no IN ({placeholders})
            """, tuple(mat_nos)).fetchall()
            bom_map = {}
            for r in bom_rows:
                bom_map.setdefault(r['corp_material_no'], []).append({
                    'id': r['id'], 'bom_code': r['bom_code'], 'name': r['name'],
                    'vehicle_code': r['vehicle_code'], 'vehicle_name': r['vehicle_name'],
                })
            for it in items:
                it['bom_links'] = bom_map.get(it['material_no'], [])

        count_sql = f"SELECT COUNT(*) AS cnt FROM material_master {where_clause}"
        total = conn.execute(count_sql, tuple(params)).fetchone()['cnt']
        return {
            'items': items,
            'total': total,
            'limit': limit,
            'offset': offset,
        }
    finally:
        conn.close()


@router.get("/groups")
def groups():
    """용품별그룹 4자리 분류 + 자재유형."""
    conn = get_connection()
    try:
        # 용품별그룹 앞 4자리(BB01 등)로 묶기, 알파벳순 정렬
        product_group_prefixes = conn.execute("""
            SELECT LEFT(product_group, 4) AS prefix,
                   COUNT(*) AS cnt,
                   COUNT(DISTINCT product_group) AS sub_count
            FROM material_master
            WHERE product_group ~ '^[A-Z]{2}[0-9]{2}'
            GROUP BY prefix
            ORDER BY prefix
        """).fetchall()
        placeholders = ','.join(['?'] * len(ALLOWED_TYPES))
        material_types = conn.execute(f"""
            SELECT material_type AS code, material_type_desc AS name, COUNT(*) AS cnt
            FROM material_master
            WHERE material_type IN ({placeholders})
            GROUP BY material_type, material_type_desc
            ORDER BY cnt DESC
        """, tuple(ALLOWED_TYPES)).fetchall()
        return {
            'product_group_prefixes': [dict(r) for r in product_group_prefixes],
            'material_types': [dict(r) for r in material_types],
        }
    finally:
        conn.close()


@router.get("/stats")
def stats():
    """전체 통계 (ALLOWED_TYPES만)."""
    conn = get_connection()
    try:
        placeholders = ','.join(['?'] * len(ALLOWED_TYPES))
        row = conn.execute(f"""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE material_type = 'ERSA') AS ersa_count,
                COUNT(*) FILTER (WHERE material_type = 'HIBE') AS hibe_count,
                COUNT(*) FILTER (WHERE material_type = 'ERSB') AS ersb_count,
                COUNT(*) FILTER (WHERE is_unused = TRUE) AS unused_count,
                COUNT(*) FILTER (WHERE is_unused = FALSE OR is_unused IS NULL) AS active_count
            FROM material_master
            WHERE material_type IN ({placeholders})
        """, tuple(ALLOWED_TYPES)).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.get("/{material_no}")
def detail(material_no: str):
    """자재 상세."""
    conn = get_connection()
    try:
        row = conn.execute("""
            SELECT * FROM material_master WHERE material_no = ?
        """, (material_no,)).fetchone()
        if not row:
            raise HTTPException(404, "자재를 찾을 수 없습니다")
        m = dict(row)
        bom_links = conn.execute("""
            SELECT b.id, b.material_no AS bom_code, b.name, b.vehicle_type_id,
                   vt.code AS vehicle_code, vt.name AS vehicle_name
            FROM bom_nodes b LEFT JOIN vehicle_types vt ON vt.id = b.vehicle_type_id
            WHERE b.corp_material_no = ?
        """, (material_no,)).fetchall()
        m['bom_links'] = [dict(r) for r in bom_links]
        return m
    finally:
        conn.close()
