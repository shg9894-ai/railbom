CREATE TABLE IF NOT EXISTS diagram_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle TEXT NOT NULL,
    file_no INTEGER NOT NULL,
    book_page INTEGER,
    source_file TEXT,
    page_type TEXT,
    chapter_no INTEGER,
    chapter TEXT,
    assembly TEXT,
    parent_assembly TEXT,
    parent_part_no INTEGER,
    drawing_no TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_diagram_pages_vehicle ON diagram_pages(vehicle);
CREATE INDEX IF NOT EXISTS idx_diagram_pages_drawing_no ON diagram_pages(drawing_no);
CREATE INDEX IF NOT EXISTS idx_diagram_pages_file_no ON diagram_pages(vehicle, file_no);

CREATE TABLE IF NOT EXISTS diagram_page_parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    page_id INTEGER NOT NULL REFERENCES diagram_pages(id) ON DELETE CASCADE,
    part_no TEXT,
    part_name TEXT
);

CREATE INDEX IF NOT EXISTS idx_diagram_page_parts_page ON diagram_page_parts(page_id);
