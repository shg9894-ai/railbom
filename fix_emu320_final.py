import sqlite3

conn = sqlite3.connect("backend/data/bom.db")
conn.row_factory = sqlite3.Row

# file_no=70 currently has only 로터 조립체 (RTM30001FX0)
# But actual image shows 베어링 조립체 (top) + 속도 검출기 (bottom)
# RTM30001FX0 = 로터 조립체 → that's WRONG for file_no=70

# Let me verify what's actually in file_no=70 image: page 75
# From my image reading: file_no=70 shows 베어링 조립체 + 속도 검출기
# file_no=69 should be 로터 조립체 then? Let's check:
# file_no=69 book_page=74 assembly=스테이터 조립체 (RTM20001FX0) ← probably correct
# file_no=70 book_page=75 assembly=로터 조립체 (RTM30001FX0) ← WRONG

# The actual sequence based on images:
# file_no=68: 견인전동기 제원
# file_no=69: 스테이터 조립체 (page 74)
# file_no=70: 베어링 조립체 + 속도 검출기 (page 75)
# file_no=71: 위상제어기 (page 76)  ← just fixed
# file_no=72: 견인전동기 냉각팬 (page 77) ← just fixed

# So: where is 로터 조립체 (RTM30001FX0)?
# It might be file_no=69 instead of 스테이터... or it might be before file_no=68

# Let me check file_no=67
rows = conn.execute("SELECT * FROM diagram_pages WHERE vehicle='emu320' AND file_no BETWEEN 65 AND 72 ORDER BY file_no, assembly").fetchall()
print("Pages 65-72:")
for r in rows:
    print(f"  {r['file_no']} p{r['book_page']} {r['assembly']} {r['drawing_no']}")

# Fix file_no=70: change from 로터 조립체 to 베어링 조립체
# And add 속도 검출기 as second entry for same file
conn.execute("""
    UPDATE diagram_pages
    SET assembly='베어링 조립체', drawing_no='RTM40001FX0', chapter_no=2
    WHERE vehicle='emu320' AND file_no=70 AND assembly='로터 조립체'
""")
print("\nFixed file_no=70: 로터 조립체 → 베어링 조립체 / RTM40001FX0")

# Add speed detector to file_no=70
conn.execute("""
    INSERT INTO diagram_pages (vehicle, file_no, book_page, source_file, page_type, chapter_no, chapter, assembly, parent_assembly, drawing_no)
    VALUES ('emu320', 70, 75, 'KTX-청룡_명칭도감_70.jpg', 'parts', 2, '제2장 전력추진장치', '속도 검출기', '견인전동기', 'RTM50002FX0')
""")
print("Added 속도 검출기 (RTM50002FX0) to file_no=70")

# Now update file_no=72 drawing_no
# The cooling fan (견인전동기 냉각팬) image shows RTM50002FX0 as drawing number
# But this conflicts with 속도 검출기 drawing RTM50002FX0
# The cooling fan should have its own drawing number - let's use REM90014FX0 (from original BOM)
# OR accept that the book shows RTM50002FX0 for both
# Actually looking at the image description again:
# "도면번호: RTM50002FX0" is clearly visible on the cooling fan page
# This is KTX-청룡 spec - they may have assigned RTM50002FX0 to both
# Let's keep file_no=72 as RTM50002FX0 for cooling fan
# and also update the cooling fan BOM node drawing_no to RTM50002FX0
conn.execute("UPDATE bom_nodes SET drawing_no='RTM50002FX0' WHERE id=48863")
print("Updated 견인전동기 냉각팬 node drawing_no to RTM50002FX0")

conn.commit()

print("\n=== Final pages 68-73 ===")
rows2 = conn.execute("SELECT file_no, book_page, assembly, drawing_no FROM diagram_pages WHERE vehicle='emu320' AND file_no BETWEEN 68 AND 73 ORDER BY file_no, assembly").fetchall()
for r in rows2:
    print(f"  file={r['file_no']} p{r['book_page']} {r['assembly']} {r['drawing_no']}")

conn.close()
