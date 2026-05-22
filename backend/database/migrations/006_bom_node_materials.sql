-- 공사 자재번호 다대다 테이블
CREATE TABLE IF NOT EXISTS bom_node_materials (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  bom_node_id       INTEGER NOT NULL REFERENCES bom_nodes(id) ON DELETE CASCADE,
  vehicle_type_id   INTEGER REFERENCES vehicle_types(id) ON DELETE SET NULL,
  corp_material_no  TEXT    NOT NULL,
  is_primary        INTEGER DEFAULT 1,
  notes             TEXT,
  created_at        TEXT    DEFAULT CURRENT_TIMESTAMP,
  updated_at        TEXT    DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_bnm
  ON bom_node_materials(bom_node_id, corp_material_no);

CREATE INDEX IF NOT EXISTS idx_bnm_node
  ON bom_node_materials(bom_node_id);

CREATE INDEX IF NOT EXISTS idx_bnm_corp
  ON bom_node_materials(corp_material_no);

-- 기존 bom_nodes.corp_material_no 데이터 이관 (idempotent)
INSERT OR IGNORE INTO bom_node_materials (bom_node_id, vehicle_type_id, corp_material_no, is_primary)
SELECT id, vehicle_type_id, corp_material_no, 1
FROM bom_nodes
WHERE corp_material_no IS NOT NULL AND corp_material_no != '';
