CREATE TABLE IF NOT EXISTS formations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_type_id INTEGER NOT NULL REFERENCES vehicle_types(id) ON DELETE CASCADE,
    formation_no    INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'active',
    notes           TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vehicle_type_id, formation_no)
);

CREATE INDEX IF NOT EXISTS idx_formations_vehicle ON formations(vehicle_type_id)
