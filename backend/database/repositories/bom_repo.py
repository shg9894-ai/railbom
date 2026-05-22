import re
from database.connection import get_connection


def _attach_compat_codes(conn, rows: list[dict]) -> list[dict]:
    """rows 각 항목에 compat_codes 필드 추가.
    corp_material_no가 같은 다른 노드들의 material_no 목록."""
    corp_nos = list({r['corp_material_no'] for r in rows if r.get('corp_material_no')})
    if not corp_nos:
        for r in rows:
            r['compat_codes'] = []
        return rows

    placeholders = ','.join(['?'] * len(corp_nos))
    shared = conn.execute(f"""
        SELECT corp_material_no, id, material_no
        FROM bom_nodes
        WHERE corp_material_no IN ({placeholders})
          AND material_no IS NOT NULL
    """, tuple(corp_nos)).fetchall()

    # corp_material_no → [(node_id, material_no), ...] 맵
    corp_map: dict[str, list[tuple]] = {}
    for s in shared:
        corp_map.setdefault(s['corp_material_no'], []).append((s['id'], s['material_no']))

    for r in rows:
        cn = r.get('corp_material_no')
        if cn and cn in corp_map:
            r['compat_codes'] = [
                mat for nid, mat in corp_map[cn] if nid != r['id']
            ]
        else:
            r['compat_codes'] = []
    return rows


def get_tree(vehicle_type_id: int, category_code: str = None):
    """WITH RECURSIVE CTE로 전체 트리를 평탄 리스트로 반환 (depth, path 포함)"""
    conn = get_connection()
    try:
        if category_code:
            # 해당 category_code 루트 노드부터 시작
            sql = """
            WITH RECURSIVE bom_tree AS (
                SELECT *, 0 AS depth, printf('%06d', sort_order) AS path
                FROM bom_nodes
                WHERE vehicle_type_id = ? AND parent_id IS NULL AND category_code = ?
                UNION ALL
                SELECT b.*, t.depth + 1,
                       t.path || '.' || printf('%06d', b.sort_order)
                FROM bom_nodes b
                JOIN bom_tree t ON b.parent_id = t.id
            )
            SELECT * FROM bom_tree ORDER BY path
            """
            rows = conn.execute(sql, (vehicle_type_id, category_code)).fetchall()
        else:
            sql = """
            WITH RECURSIVE bom_tree AS (
                SELECT *, 0 AS depth, printf('%06d', sort_order) AS path
                FROM bom_nodes
                WHERE vehicle_type_id = ? AND parent_id IS NULL
                UNION ALL
                SELECT b.*, t.depth + 1,
                       t.path || '.' || printf('%06d', b.sort_order)
                FROM bom_nodes b
                JOIN bom_tree t ON b.parent_id = t.id
            )
            SELECT * FROM bom_tree ORDER BY path
            """
            rows = conn.execute(sql, (vehicle_type_id,)).fetchall()
        result = [dict(r) for r in rows]
        return _attach_compat_codes(conn, result)
    finally:
        conn.close()


def get_roots(vehicle_type_id: int, category_code: str = None):
    """최상위 노드 반환. 카테고리 루트가 단일 챕터 노드이면 자식을 바로 반환."""
    conn = get_connection()
    try:
        if category_code:
            sql = """
            SELECT b.*, 0 AS depth, printf('%06d', b.sort_order) AS path,
                   EXISTS(SELECT 1 FROM bom_nodes c WHERE c.parent_id = b.id) AS has_children
            FROM bom_nodes b
            WHERE b.vehicle_type_id = ? AND b.parent_id IS NULL AND b.category_code = ?
            ORDER BY b.sort_order
            """
            rows = conn.execute(sql, (vehicle_type_id, category_code)).fetchall()

            # 챕터 노드("제N장"으로 시작)이면 그 자식들을 펼쳐서 합친다
            child_sql = """
            SELECT b.*, 1 AS depth, printf('%06d', b.sort_order) AS path,
                   EXISTS(SELECT 1 FROM bom_nodes c WHERE c.parent_id = b.id) AS has_children
            FROM bom_nodes b
            WHERE b.parent_id = ?
            ORDER BY b.sort_order
            """
            expanded = []
            for row in rows:
                if re.match(r'^제\d+장', row['name']):
                    expanded.extend(conn.execute(child_sql, (row['id'],)).fetchall())
                else:
                    expanded.append(row)
            rows = expanded

            # 각 행이 소챕터 래퍼(자식 1개 + 이름 동일)이면 해당 자식으로 교체
            resolved = []
            for row in rows:
                only_child = conn.execute("""
                    SELECT b.*, 1 AS depth, printf('%06d', b.sort_order) AS path,
                           EXISTS(SELECT 1 FROM bom_nodes c WHERE c.parent_id = b.id) AS has_children
                    FROM bom_nodes b WHERE b.parent_id = ?
                """, (row['id'],)).fetchall()
                if len(only_child) == 1 and only_child[0]['name'] == row['name']:
                    resolved.append(only_child[0])
                else:
                    resolved.append(row)
            rows = resolved
        else:
            sql = """
            SELECT b.*, 0 AS depth, printf('%06d', b.sort_order) AS path,
                   EXISTS(SELECT 1 FROM bom_nodes c WHERE c.parent_id = b.id) AS has_children
            FROM bom_nodes b
            WHERE b.vehicle_type_id = ? AND b.parent_id IS NULL
            ORDER BY b.sort_order
            """
            rows = conn.execute(sql, (vehicle_type_id,)).fetchall()
        result = [dict(r) for r in rows]
        return _attach_compat_codes(conn, result)
    finally:
        conn.close()


def get_children_with_flag(node_id: int):
    """직계 자식 + 자식 존재 여부 포함"""
    conn = get_connection()
    try:
        # 부모의 depth 먼저 조회
        parent = conn.execute("SELECT * FROM bom_nodes WHERE id = ?", (node_id,)).fetchone()
        parent_depth = 0
        if parent:
            # depth는 CTE로 계산해야 하지만 자식 조회에서는 부모+1로 대략 처리
            # 정확한 depth는 ancestors 쿼리로
            ancestors = conn.execute("""
                WITH RECURSIVE anc AS (
                    SELECT id, parent_id FROM bom_nodes WHERE id = ?
                    UNION ALL
                    SELECT b.id, b.parent_id FROM bom_nodes b JOIN anc a ON b.id = a.parent_id
                )
                SELECT COUNT(*) - 1 AS depth FROM anc
            """, (node_id,)).fetchone()
            parent_depth = ancestors["depth"] if ancestors else 0

        sql = """
        SELECT b.*, ? + 1 AS depth,
               EXISTS(SELECT 1 FROM bom_nodes c WHERE c.parent_id = b.id) AS has_children
        FROM bom_nodes b
        WHERE b.parent_id = ?
        ORDER BY b.sort_order
        """
        rows = conn.execute(sql, (parent_depth, node_id)).fetchall()

        # 자식이 1개이고 이름이 부모와 같은 래퍼 노드는 건너뛰고 손자를 반환
        if parent and len(rows) == 1 and rows[0]['name'] == parent['name']:
            grandchild_sql = """
            SELECT b.*, ? + 2 AS depth,
                   EXISTS(SELECT 1 FROM bom_nodes c WHERE c.parent_id = b.id) AS has_children
            FROM bom_nodes b
            WHERE b.parent_id = ?
            ORDER BY b.sort_order
            """
            rows = conn.execute(grandchild_sql, (parent_depth, rows[0]['id'])).fetchall()

        result = [dict(r) for r in rows]
        return _attach_compat_codes(conn, result)
    finally:
        conn.close()


def get_node_by_id(node_id: int):
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM bom_nodes WHERE id = ?", (node_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def get_children(node_id: int):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM bom_nodes WHERE parent_id = ? ORDER BY sort_order",
            (node_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_ancestors(node_id: int):
    """루트까지 부모 체인 반환 (breadcrumb용, 루트부터 정렬)"""
    conn = get_connection()
    try:
        sql = """
        WITH RECURSIVE ancestors AS (
            SELECT * FROM bom_nodes WHERE id = ?
            UNION ALL
            SELECT b.* FROM bom_nodes b
            JOIN ancestors a ON b.id = a.parent_id
        )
        SELECT * FROM ancestors
        """
        rows = conn.execute(sql, (node_id,)).fetchall()
        result = [dict(r) for r in rows]
        result.reverse()
        return result
    finally:
        conn.close()


def create_node(data: dict):
    conn = get_connection()
    try:
        # sort_order 자동 계산 (같은 부모 내 마지막 + 10)
        if data.get("sort_order") is None:
            parent_id = data.get("parent_id")
            if parent_id:
                row = conn.execute(
                    "SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM bom_nodes WHERE parent_id = ?",
                    (parent_id,),
                ).fetchone()
            else:
                row = conn.execute(
                    "SELECT COALESCE(MAX(sort_order), 0) + 10 AS next FROM bom_nodes WHERE vehicle_type_id = ? AND parent_id IS NULL",
                    (data.get("vehicle_type_id"),),
                ).fetchone()
            data["sort_order"] = row["next"]

        cursor = conn.execute(
            """INSERT INTO bom_nodes
               (parent_id, vehicle_type_id, node_type, category_code, material_no,
                name, name_en, specification, unit, quantity,
                manufacturer, manufacturer_pn, drawing_no, weight_kg, material,
                notes, sort_order)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                data.get("parent_id"),
                data.get("vehicle_type_id"),
                data.get("node_type", "assembly"),
                data.get("category_code"),
                data.get("material_no"),
                data["name"],
                data.get("name_en"),
                data.get("specification"),
                data.get("unit", "EA"),
                data.get("quantity", 1),
                data.get("manufacturer"),
                data.get("manufacturer_pn"),
                data.get("drawing_no"),
                data.get("weight_kg"),
                data.get("material"),
                data.get("notes"),
                data["sort_order"],
            ),
        )
        conn.commit()
        return get_node_by_id(cursor.lastrowid)
    finally:
        conn.close()


def update_node(node_id: int, data: dict):
    conn = get_connection()
    try:
        conn.execute(
            """UPDATE bom_nodes SET
               node_type = ?, category_code = ?, material_no = ?,
               name = ?, name_en = ?, specification = ?,
               unit = ?, quantity = ?, manufacturer = ?,
               manufacturer_pn = ?, drawing_no = ?, weight_kg = ?,
               material = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (
                data.get("node_type", "assembly"),
                data.get("category_code"),
                data.get("material_no"),
                data["name"],
                data.get("name_en"),
                data.get("specification"),
                data.get("unit", "EA"),
                data.get("quantity", 1),
                data.get("manufacturer"),
                data.get("manufacturer_pn"),
                data.get("drawing_no"),
                data.get("weight_kg"),
                data.get("material"),
                data.get("notes"),
                node_id,
            ),
        )
        conn.commit()
        return get_node_by_id(node_id)
    finally:
        conn.close()


def move_node(node_id: int, new_parent_id: int = None, new_vehicle_type_id: int = None):
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE bom_nodes SET parent_id = ?, vehicle_type_id = COALESCE(?, vehicle_type_id), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (new_parent_id, new_vehicle_type_id, node_id),
        )
        conn.commit()
        return get_node_by_id(node_id)
    finally:
        conn.close()


def reorder_nodes(ordered_ids: list[int]):
    """ordered_ids 순서대로 sort_order를 10, 20, 30... 으로 재설정"""
    conn = get_connection()
    try:
        for i, node_id in enumerate(ordered_ids):
            conn.execute(
                "UPDATE bom_nodes SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                ((i + 1) * 10, node_id),
            )
        conn.commit()
    finally:
        conn.close()


def delete_node(node_id: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM bom_nodes WHERE id = ?", (node_id,))
        conn.commit()
    finally:
        conn.close()


def search_nodes(vehicle_type_id: int, query: str):
    conn = get_connection()
    try:
        like = f"%{query}%"
        rows = conn.execute(
            """SELECT * FROM bom_nodes
               WHERE vehicle_type_id = ?
               AND (name LIKE ? OR material_no LIKE ? OR name_en LIKE ?)
               ORDER BY name
               LIMIT 100""",
            (vehicle_type_id, like, like, like),
        ).fetchall()
        result = [dict(r) for r in rows]
        return _attach_compat_codes(conn, result)
    finally:
        conn.close()


def search_by_corp_material_no(corp_material_no: str):
    """공사 자재번호로 전체 차종에서 해당 자재번호가 등록된 BOM 노드 목록 반환"""
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT n.*, vt.name AS vehicle_name, vt.code AS vehicle_code,
                      m.corp_material_no, m.is_primary, m.notes AS mat_notes
               FROM bom_node_materials m
               JOIN bom_nodes n ON n.id = m.bom_node_id
               JOIN vehicle_types vt ON vt.id = n.vehicle_type_id
               WHERE m.corp_material_no = ?
               ORDER BY n.vehicle_type_id, n.sort_order""",
            (corp_material_no,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def search_nodes_global(query: str, vehicle_type_id: int = None):
    """전체 차종 통합 검색: 부품명/도면번호/OEM PN/공사자재번호(구+신 테이블) 대상"""
    conn = get_connection()
    try:
        like = f"%{query}%"
        veh_filter = "AND n.vehicle_type_id = ?" if vehicle_type_id else ""
        params_base = [like, like, like, like, like]
        params_mat  = [like]
        if vehicle_type_id:
            params_base = [vehicle_type_id] + params_base
            params_mat  = [vehicle_type_id, like]

        sql = f"""
            SELECT DISTINCT n.*, vt.name AS vehicle_name, vt.code AS vehicle_code
            FROM bom_nodes n
            JOIN vehicle_types vt ON vt.id = n.vehicle_type_id
            WHERE {veh_filter if vehicle_type_id else '1=1'}
              AND (
                n.name LIKE ? OR n.name_en LIKE ? OR n.drawing_no LIKE ?
                OR n.manufacturer_pn LIKE ? OR n.material_no LIKE ?
                OR EXISTS (
                    SELECT 1 FROM bom_node_materials m
                    WHERE m.bom_node_id = n.id
                      {('AND m.vehicle_type_id = ?' if vehicle_type_id else '')}
                      AND m.corp_material_no LIKE ?
                )
              )
            ORDER BY n.vehicle_type_id, n.name
            LIMIT 200
        """
        rows = conn.execute(sql, params_base + params_mat).fetchall()
        result = [dict(r) for r in rows]
        return _attach_compat_codes(conn, result)
    finally:
        conn.close()
