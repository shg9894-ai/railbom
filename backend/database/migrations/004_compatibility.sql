CREATE TABLE IF NOT EXISTS compatibility (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    bom_node_id     INTEGER NOT NULL REFERENCES bom_nodes(id) ON DELETE CASCADE,
    vehicle_type_id INTEGER NOT NULL REFERENCES vehicle_types(id) ON DELETE CASCADE,
    compat_type     TEXT NOT NULL DEFAULT 'compatible',
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bom_node_id, vehicle_type_id)
);

CREATE INDEX IF NOT EXISTS idx_compat_node    ON compatibility(bom_node_id);
CREATE INDEX IF NOT EXISTS idx_compat_vehicle ON compatibility(vehicle_type_id)
