import sqlite3, sys
sys.stdout.reconfigure(encoding='utf-8')
conn = sqlite3.connect("../data/bom.db")

conn.execute("""
CREATE TABLE IF NOT EXISTS repair_kit_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    kit_node_id INTEGER NOT NULL REFERENCES bom_nodes(id) ON DELETE CASCADE,
    ref_node_id INTEGER NOT NULL REFERENCES bom_nodes(id) ON DELETE CASCADE,
    quantity    REAL    NOT NULL DEFAULT 1,
    notes       TEXT,
    sort_order  INTEGER NOT NULL DEFAULT 10,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kit_node_id, ref_node_id)
)
""")
conn.commit()
print("repair_kit_items 테이블 생성 완료")
conn.close()
