CREATE TABLE IF NOT EXISTS bom_nodes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id       INTEGER REFERENCES bom_nodes(id) ON DELETE CASCADE,
    vehicle_type_id INTEGER REFERENCES vehicle_types(id) ON DELETE CASCADE,
    node_type       TEXT NOT NULL DEFAULT 'assembly',
    category_code   TEXT,
    part_number     TEXT,
    name            TEXT NOT NULL,
    name_en         TEXT,
    specification   TEXT,
    unit            TEXT NOT NULL DEFAULT 'EA',
    quantity        REAL NOT NULL DEFAULT 1,
    manufacturer    TEXT,
    manufacturer_pn TEXT,
    drawing_no      TEXT,
    weight_kg       REAL,
    material        TEXT,
    notes           TEXT,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bom_parent   ON bom_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_bom_vehicle  ON bom_nodes(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_bom_part_no  ON bom_nodes(part_number);
CREATE INDEX IF NOT EXISTS idx_bom_category ON bom_nodes(category_code);
CREATE INDEX IF NOT EXISTS idx_bom_type     ON bom_nodes(node_type)
