import sqlite3
conn = sqlite3.connect("backend/data/bom.db")

print("=== diagram_pages 차종별 현황 ===")
rows = conn.execute("""
    SELECT vehicle, COUNT(*) as pages,
           SUM(CASE WHEN drawing_no IS NOT NULL AND drawing_no != '' THEN 1 ELSE 0 END) as has_drawing
    FROM diagram_pages
    GROUP BY vehicle
    ORDER BY vehicle
""").fetchall()
for r in rows:
    print(f"  {r[0]:12} 페이지: {r[1]:3}개  도면번호있음: {r[2]:3}개")

print()

vehicle_map = {
    "emu320": (1, "KTX-청룡"),
    "emu260": (2, "KTX-이음"),
    "ktx720": (3, "KTX-산천4"),
    "ktx750": (4, "KTX-산천2"),
    "ktx730": (6, "KTX-산천1"),
    "ktxsrt": (7, "KTX-산천3"),
}

for vcode, (vid, vname) in vehicle_map.items():
    dp_rows = conn.execute(
        "SELECT DISTINCT drawing_no, assembly FROM diagram_pages WHERE vehicle=? AND drawing_no IS NOT NULL AND drawing_no != ''",
        (vcode,)
    ).fetchall()
    dp_drawings = {r[0]: r[1] for r in dp_rows}

    no_drawing = conn.execute(
        "SELECT COUNT(*) FROM bom_nodes WHERE vehicle_type_id=? AND (drawing_no IS NULL OR drawing_no='')",
        (vid,)
    ).fetchone()[0]
    has_drawing = conn.execute(
        "SELECT COUNT(*) FROM bom_nodes WHERE vehicle_type_id=? AND drawing_no IS NOT NULL AND drawing_no != ''",
        (vid,)
    ).fetchone()[0]

    # 이름 기반 매칭 가능 수
    name_match_count = 0
    name_match_examples = []
    for dno, aname in dp_drawings.items():
        cnt = conn.execute(
            "SELECT COUNT(*) FROM bom_nodes WHERE vehicle_type_id=? AND name=?",
            (vid, aname)
        ).fetchone()[0]
        if cnt > 0:
            name_match_count += 1
            if len(name_match_examples) < 3:
                name_match_examples.append(f"{aname} -> {dno}")

    print(f"{vname} ({vcode})")
    print(f"  diagram_pages 도면번호: {len(dp_drawings)}개")
    print(f"  BOM노드 도면번호 있음: {has_drawing}개 / 없음: {no_drawing}개")
    print(f"  이름 기반 매칭 가능: {name_match_count}개")
    if name_match_examples:
        for ex in name_match_examples:
            print(f"    예) {ex}")
    print()

conn.close()
