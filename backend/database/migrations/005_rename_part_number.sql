ALTER TABLE bom_nodes RENAME COLUMN part_number TO material_no;
DROP INDEX IF EXISTS idx_bom_part_no;
CREATE INDEX IF NOT EXISTS idx_bom_material_no ON bom_nodes(material_no)
