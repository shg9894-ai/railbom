from database.connection import get_connection


def get_by_node(bom_node_id: int):
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT c.*, v.name AS vehicle_name, v.code AS vehicle_code
               FROM compatibility c
               JOIN vehicle_types v ON v.id = c.vehicle_type_id
               WHERE c.bom_node_id = ?""",
            (bom_node_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_by_vehicle(vehicle_type_id: int):
    conn = get_connection()
    try:
        rows = conn.execute(
            """SELECT c.*, b.name AS part_name, b.material_no AS part_number
               FROM compatibility c
               JOIN bom_nodes b ON b.id = c.bom_node_id
               WHERE c.vehicle_type_id = ?""",
            (vehicle_type_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def upsert(bom_node_id: int, vehicle_type_id: int, compat_type: str = "compatible", notes: str = None):
    conn = get_connection()
    try:
        conn.execute(
            """INSERT INTO compatibility (bom_node_id, vehicle_type_id, compat_type, notes)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(bom_node_id, vehicle_type_id)
               DO UPDATE SET compat_type = excluded.compat_type, notes = excluded.notes""",
            (bom_node_id, vehicle_type_id, compat_type, notes),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM compatibility WHERE bom_node_id = ? AND vehicle_type_id = ?",
            (bom_node_id, vehicle_type_id),
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def delete(compat_id: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM compatibility WHERE id = ?", (compat_id,))
        conn.commit()
    finally:
        conn.close()
