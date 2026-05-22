from database.connection import get_connection


def get_formations_by_vehicle(vehicle_type_id: int):
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT * FROM formations WHERE vehicle_type_id = ? ORDER BY formation_no",
            (vehicle_type_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_formation_by_id(formation_id: int):
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM formations WHERE id = ?", (formation_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def create_formation(vehicle_type_id: int, formation_no: int, status: str = "active", notes: str = None):
    conn = get_connection()
    try:
        cursor = conn.execute(
            "INSERT INTO formations (vehicle_type_id, formation_no, status, notes) VALUES (?, ?, ?, ?)",
            (vehicle_type_id, formation_no, status, notes),
        )
        conn.commit()
        return get_formation_by_id(cursor.lastrowid)
    finally:
        conn.close()


def create_formations_bulk(vehicle_type_id: int, count: int):
    """1~count 편성을 일괄 생성 (이미 존재하는 번호는 건너뜀)"""
    conn = get_connection()
    try:
        existing = {
            r["formation_no"]
            for r in conn.execute(
                "SELECT formation_no FROM formations WHERE vehicle_type_id = ?",
                (vehicle_type_id,),
            ).fetchall()
        }
        created = []
        for no in range(1, count + 1):
            if no not in existing:
                cursor = conn.execute(
                    "INSERT INTO formations (vehicle_type_id, formation_no) VALUES (?, ?)",
                    (vehicle_type_id, no),
                )
                created.append(cursor.lastrowid)
        conn.commit()
        if created:
            placeholders = ",".join("?" * len(created))
            rows = conn.execute(
                f"SELECT * FROM formations WHERE id IN ({placeholders}) ORDER BY formation_no",
                created,
            ).fetchall()
            return [dict(r) for r in rows]
        return []
    finally:
        conn.close()


def update_formation(formation_id: int, status: str, notes: str = None):
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE formations SET status = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (status, notes, formation_id),
        )
        conn.commit()
        return get_formation_by_id(formation_id)
    finally:
        conn.close()


def delete_formation(formation_id: int):
    conn = get_connection()
    try:
        conn.execute("DELETE FROM formations WHERE id = ?", (formation_id,))
        conn.commit()
    finally:
        conn.close()
