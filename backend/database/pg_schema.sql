-- PostgreSQL schema for railway-bom

CREATE TABLE IF NOT EXISTS vehicle_types (
    id               SERIAL PRIMARY KEY,
    code             TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    description      TEXT,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    sap_code         TEXT,
    total_cars       INTEGER,
    active_cars      INTEGER,
    formation_count  INTEGER,
    manufacturer     TEXT,
    acquisition_years TEXT,
    dimensions       TEXT,
    weight_ton       REAL,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_nodes (
    id               SERIAL PRIMARY KEY,
    parent_id        INTEGER REFERENCES bom_nodes(id) ON DELETE CASCADE,
    vehicle_type_id  INTEGER REFERENCES vehicle_types(id) ON DELETE CASCADE,
    node_type        TEXT NOT NULL DEFAULT 'assembly',
    category_code    TEXT,
    material_no      TEXT,
    name             TEXT NOT NULL,
    name_en          TEXT,
    specification    TEXT,
    unit             TEXT NOT NULL DEFAULT 'EA',
    quantity         REAL NOT NULL DEFAULT 1,
    manufacturer     TEXT,
    manufacturer_pn  TEXT,
    drawing_no       TEXT,
    weight_kg        REAL,
    material         TEXT,
    notes            TEXT,
    sort_order       INTEGER NOT NULL DEFAULT 0,
    corp_material_no TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bom_parent   ON bom_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_bom_vehicle  ON bom_nodes(vehicle_type_id);
CREATE INDEX IF NOT EXISTS idx_bom_category ON bom_nodes(category_code);
CREATE INDEX IF NOT EXISTS idx_bom_type     ON bom_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_bom_corp_mat ON bom_nodes(corp_material_no);
CREATE INDEX IF NOT EXISTS idx_bom_mat_no   ON bom_nodes(material_no);

CREATE TABLE IF NOT EXISTS formations (
    id               SERIAL PRIMARY KEY,
    vehicle_type_id  INTEGER REFERENCES vehicle_types(id) ON DELETE CASCADE,
    formation_no     INTEGER,
    formation_code   TEXT,
    car_count        INTEGER,
    status           TEXT DEFAULT 'active',
    acquisition_date TEXT,
    sap_description  TEXT,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compatibility (
    id              SERIAL PRIMARY KEY,
    bom_node_id     INTEGER REFERENCES bom_nodes(id) ON DELETE CASCADE,
    vehicle_type_id INTEGER REFERENCES vehicle_types(id) ON DELETE CASCADE,
    compat_type     TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bom_node_materials (
    id               SERIAL PRIMARY KEY,
    bom_node_id      INTEGER REFERENCES bom_nodes(id) ON DELETE CASCADE,
    vehicle_type_id  INTEGER REFERENCES vehicle_types(id),
    corp_material_no TEXT,
    is_primary       INTEGER DEFAULT 0,
    notes            TEXT,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagram_pages (
    id             SERIAL PRIMARY KEY,
    vehicle        TEXT,
    file_no        INTEGER,
    book_page      INTEGER,
    source_file    TEXT,
    page_type      TEXT,
    chapter_no     INTEGER,
    chapter        TEXT,
    assembly       TEXT,
    parent_assembly TEXT,
    parent_part_no INTEGER,
    drawing_no     TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagram_page_parts (
    id        SERIAL PRIMARY KEY,
    page_id   INTEGER REFERENCES diagram_pages(id) ON DELETE CASCADE,
    part_no   TEXT,
    part_name TEXT
);

CREATE TABLE IF NOT EXISTS bom_node_diagrams (
    id              SERIAL PRIMARY KEY,
    bom_node_id     INTEGER REFERENCES bom_nodes(id) ON DELETE CASCADE,
    diagram_page_id INTEGER REFERENCES diagram_pages(id) ON DELETE CASCADE,
    match_type      TEXT,
    confidence      REAL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS change_requests (
    id               SERIAL PRIMARY KEY,
    node_id          INTEGER,
    node_name        TEXT,
    request_type     TEXT,
    current_value    TEXT,
    requested_value  TEXT,
    node_data        TEXT,
    photo_filename   TEXT,
    photo_data       BYTEA,
    requester_name   TEXT,
    requester_note   TEXT,
    status           TEXT DEFAULT 'pending',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at      TIMESTAMPTZ,
    reviewer_note    TEXT
);

CREATE TABLE IF NOT EXISTS failure_cases (
    id          SERIAL PRIMARY KEY,
    node_id     INTEGER,
    title       TEXT,
    symptom     TEXT,
    cause       TEXT,
    action      TEXT,
    author      TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS repair_kit_items (
    id          SERIAL PRIMARY KEY,
    kit_node_id INTEGER REFERENCES bom_nodes(id) ON DELETE CASCADE,
    ref_node_id INTEGER REFERENCES bom_nodes(id),
    quantity    REAL,
    notes       TEXT,
    sort_order  INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS login_logs (
    id          SERIAL PRIMARY KEY,
    user_id     TEXT,
    role        TEXT,
    ip          TEXT,
    logged_in_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS node_photos (
    id          SERIAL PRIMARY KEY,
    node_id     INTEGER REFERENCES bom_nodes(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    storage_url TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
