from database.connection import get_connection


def get_by_node(bom_node_id: int) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT m.*, vt.name AS vehicle_name, vt.code AS vehicle_code
               FROM bom_node_materials m
               LEFT JOIN vehicle_types vt ON vt.id = m.vehicle_type_id
               WHERE m.bom_node_id = ?
               ORDER BY m.is_primary DESC, m.id""",
            (bom_node_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_by_corp_material_no(corp_material_no: str) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT m.*, vt.name AS vehicle_name, vt.code AS vehicle_code,
                      n.material_no, n.name AS node_name
               FROM bom_node_materials m
               LEFT JOIN vehicle_types vt ON vt.id = m.vehicle_type_id
               JOIN bom_nodes n ON n.id = m.bom_node_id
               WHERE m.corp_material_no = ?""",
            (corp_material_no,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def create(bom_node_id: int, data: dict) -> dict:
    conn = get_connection()
    try:
        cursor = conn.execute(
            """INSERT INTO bom_node_materials
               (bom_node_id, vehicle_type_id, corp_material_no, is_primary, notes)
               VALUES (?, ?, ?, ?, ?)""",
            (
                bom_node_id,
                data.get("vehicle_type_id"),
                data["corp_material_no"],
                1 if data.get("is_primary") else 0,
                data.get("notes"),
            ),
        )
        conn.commit()
        row = conn.execute(
            """SELECT m.*, vt.name AS vehicle_name, vt.code AS vehicle_code
               FROM bom_node_materials m
               LEFT JOIN vehicle_types vt ON vt.id = m.vehicle_type_id
               WHERE m.id = ?""",
            (cursor.lastrowid,),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


def update(mat_id: int, data: dict) -> dict | None:
    conn = get_connection()
    try:
        conn.execute(
            """UPDATE bom_node_materials
               SET vehicle_type_id = ?, corp_material_no = ?,
                   is_primary = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (
                data.get("vehicle_type_id"),
                data["corp_material_no"],
                1 if data.get("is_primary") else 0,
                data.get("notes"),
                mat_id,
            ),
        )
        conn.commit()
        row = conn.execute(
            """SELECT m.*, vt.name AS vehicle_name, vt.code AS vehicle_code
               FROM bom_node_materials m
               LEFT JOIN vehicle_types vt ON vt.id = m.vehicle_type_id
               WHERE m.id = ?""",
            (mat_id,),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete(mat_id: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM bom_node_materials WHERE id = ?", (mat_id,))
        conn.commit()
    finally:
        conn.close()


def search_by_corp_material_no(query: str, vehicle_type_id: int = None) -> list[dict]:
    conn = get_connection()
    try:
        like = f"%{query}%"
        if vehicle_type_id:
            rows = conn.execute(
                """SELECT DISTINCT n.*, vt.name AS vehicle_name, vt.code AS vehicle_code
                   FROM bom_node_materials m
                   JOIN bom_nodes n ON n.id = m.bom_node_id
                   JOIN vehicle_types vt ON vt.id = n.vehicle_type_id
                   WHERE m.corp_material_no LIKE ? AND n.vehicle_type_id = ?""",
                (like, vehicle_type_id),
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT DISTINCT n.*, vt.name AS vehicle_name, vt.code AS vehicle_code
                   FROM bom_node_materials m
                   JOIN bom_nodes n ON n.id = m.bom_node_id
                   JOIN vehicle_types vt ON vt.id = n.vehicle_type_id
                   WHERE m.corp_material_no LIKE ?""",
                (like,),
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
