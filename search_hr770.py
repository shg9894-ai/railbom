import sqlite3, json

conn = sqlite3.connect("backend/data/bom.db")
c = conn.cursor()

# Search for 싱글암 in DB
c.execute("SELECT vehicle, file_no, source_file, page_type, assembly, parent_assembly, drawing_no FROM diagram_pages WHERE assembly LIKE '%싱글암%' OR drawing_no LIKE '%HR-770%' ORDER BY vehicle, file_no")
rows = c.fetchall()
print(f"싱글암/HR-770 rows total: {len(rows)}")
for row in rows:
    print(row)

print()
print("=== emu320 index.json manifest 검색 ===")
d = json.load(open("frontend/public/diagrams/emu320/index.json", encoding="utf-8"))
m = d.get("manifest", {})
for cat, cv in m.items():
    for p in cv.get("pages", []):
        a = str(p.get("assembly", ""))
        sa = str(p.get("sub_assembly", ""))
        parts = p.get("parts", [])
        if "HR" in a or "770" in a or "싱글암" in a:
            print(f"Found in {cat} p{p['page']}: assembly={a} / sub={sa}")
        for pt in parts:
            nm = str(pt.get("name", ""))
            if "HR" in nm or "770" in nm or "싱글암" in nm:
                print(f"Found in parts {cat} p{p['page']}: {pt}")

print()
print("=== emu320 DB 전체 팬터그래프 관련 행 ===")
c.execute("SELECT file_no, source_file, page_type, assembly, parent_assembly, drawing_no FROM diagram_pages WHERE vehicle='emu320' AND (assembly LIKE '%팬터%' OR parent_assembly LIKE '%팬터%') ORDER BY file_no")
rows = c.fetchall()
for row in rows:
    print(row)

print()
print("=== emu320 DB file_no 17-26 상세 ===")
c.execute("SELECT file_no, source_file, page_type, assembly, parent_assembly, drawing_no FROM diagram_pages WHERE vehicle='emu320' AND file_no BETWEEN 17 AND 26 ORDER BY file_no")
rows = c.fetchall()
for row in rows:
    print(row)
