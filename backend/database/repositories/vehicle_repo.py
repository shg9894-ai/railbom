from database.connection import get_connection


def get_all_vehicles():
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM vehicle_types ORDER BY COALESCE(sort_order, 99), id"
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_vehicle_by_id(vehicle_id: int):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM vehicle_types WHERE id = ?", (vehicle_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_vehicle(code: str, name: str, description: str = None):
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO vehicle_types (code, name, description) VALUES (?, ?, ?)",
            (code, name, description),
        )
        conn.commit()
        return get_vehicle_by_id(cursor.lastrowid)
    finally:
        conn.close()


def update_vehicle(vehicle_id: int, code: str, name: str, description: str = None):
    conn = get_connection()
    try:
        conn.execute(
            """UPDATE vehicle_types
               SET code = ?, name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (code, name, description, vehicle_id),
        )
        conn.commit()
        return get_vehicle_by_id(vehicle_id)
    finally:
        conn.close()


def delete_vehicle(vehicle_id: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM vehicle_types WHERE id = ?", (vehicle_id,))
        conn.commit()
    finally:
        conn.close()
