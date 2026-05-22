from database.connection import get_connection


def _next_kit_no(conn, parent_id: int) -> int:
    """부모 하위 수리키트 중 최대 R번호 + 1"""
    rows = conn.execute(
        "SELECT material_no FROM bom_nodes WHERE parent_id=? AND node_type='repair_kit'",
        (parent_id,)
    ).fetchall()
    nums = []
    for r in rows:
        if r[0]:
            parts = r[0].split('-R')
            if len(parts) == 2:
                try: nums.append(int(parts[1]))
                except: pass
    return max(nums) + 1 if nums else 1


def create_kit(parent_id: int, name: str, ref_node_ids: list[int], quantities: dict[int, float] = None) -> dict:
    """수리키트 노드 생성 + 구성 부품 등록"""
    conn = get_connection()
    try:
        parent = conn.execute("SELECT material_no, vehicle_type_id FROM bom_nodes WHERE id=?", (parent_id,)).fetchone()
        if not parent:
            raise ValueError("부모 노드를 찾을 수 없습니다.")

        kit_no = _next_kit_no(conn, parent_id)
        kit_code = f"{parent['material_no']}-R{kit_no}"

        max_sort = conn.execute(
            "SELECT COALESCE(MAX(sort_order), 0) FROM bom_nodes WHERE parent_id=?", (parent_id,)
        ).fetchone()[0]

        cur = conn.execute(
            """INSERT INTO bom_nodes
               (parent_id, vehicle_type_id, node_type, material_no, name, sort_order)
               VALUES (?, ?, 'repair_kit', ?, ?, ?)""",
            (parent_id, parent['vehicle_type_id'], kit_code, name, max_sort + 10)
        )
        kit_id = cur.lastrowid

        for i, ref_id in enumerate(ref_node_ids, 1):
            qty = (quantities or {}).get(ref_id, 1)
            conn.execute(
                """INSERT INTO repair_kit_items (kit_node_id, ref_node_id, quantity, sort_order)
                   VALUES (?, ?, ?, ?)""",
                (kit_id, ref_id, qty, i * 10)
            )

        conn.commit()
        return get_kit(kit_id)
    finally:
        conn.close()


def get_kit(kit_id: int) -> dict:
    conn = get_connection()
    try:
        kit = conn.execute("SELECT * FROM bom_nodes WHERE id=?", (kit_id,)).fetchone()
        if not kit:
            return None
        items = conn.execute(
            """SELECT rki.id, rki.ref_node_id, rki.quantity, rki.notes, rki.sort_order,
                      n.material_no, n.name, n.name_en, n.manufacturer_pn
               FROM repair_kit_items rki
               JOIN bom_nodes n ON n.id = rki.ref_node_id
               WHERE rki.kit_node_id = ?
               ORDER BY rki.sort_order""",
            (kit_id,)
        ).fetchall()
        result = dict(kit)
        result['items'] = [dict(i) for i in items]
        return result
    finally:
        conn.close()


def get_kits_by_parent(parent_id: int) -> list:
    conn = get_connection()
    try:
        kits = conn.execute(
            "SELECT * FROM bom_nodes WHERE parent_id=? AND node_type='repair_kit' ORDER BY sort_order",
            (parent_id,)
        ).fetchall()
        result = []
        for kit in kits:
            k = dict(kit)
            items = conn.execute(
                """SELECT rki.id, rki.ref_node_id, rki.quantity, rki.notes, rki.sort_order,
                          n.material_no, n.name, n.name_en
                   FROM repair_kit_items rki
                   JOIN bom_nodes n ON n.id = rki.ref_node_id
                   WHERE rki.kit_node_id = ?
                   ORDER BY rki.sort_order""",
                (kit['id'],)
            ).fetchall()
            k['items'] = [dict(i) for i in items]
            result.append(k)
        return result
    finally:
        conn.close()


def add_item(kit_id: int, ref_node_id: int, quantity: float = 1) -> dict:
    conn = get_connection()
    try:
        max_sort = conn.execute(
            "SELECT COALESCE(MAX(sort_order), 0) FROM repair_kit_items WHERE kit_node_id=?", (kit_id,)
        ).fetchone()[0]
        conn.execute(
            "INSERT INTO repair_kit_items (kit_node_id, ref_node_id, quantity, sort_order) VALUES (?,?,?,?)",
            (kit_id, ref_node_id, quantity, max_sort + 10)
        )
        conn.commit()
        return get_kit(kit_id)
    finally:
        conn.close()


def remove_item(item_id: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM repair_kit_items WHERE id=?", (item_id,))
        conn.commit()
    finally:
        conn.close()


def delete_kit(kit_id: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM repair_kit_items WHERE kit_node_id=?", (kit_id,))
        conn.execute("DELETE FROM bom_nodes WHERE id=?", (kit_id,))
        conn.commit()
    finally:
        conn.close()
