import sqlite3
conn = sqlite3.connect("backend/data/bom.db")

for v in ["ktx720", "ktx730", "ktx750"]:
    total = conn.execute("SELECT COUNT(*) FROM diagram_pages WHERE vehicle=?", (v,)).fetchone()[0]
    has_draw = conn.execute(
        "SELECT COUNT(*) FROM diagram_pages WHERE vehicle=? AND drawing_no IS NOT NULL AND drawing_no != ''",
        (v,)
    ).fetchone()[0]
    rows = conn.execute(
        "SELECT file_no, book_page, assembly, drawing_no FROM diagram_pages WHERE vehicle=? ORDER BY file_no LIMIT 15",
        (v,)
    ).fetchall()
    print(f"=== {v} (총 {total}개, drawing_no있음: {has_draw}개) ===")
    for r in rows:
        print(f"  file={r[0]} page={r[1]}  assembly={r[2]}  drawing={r[3]}")
    print()

conn.close()
