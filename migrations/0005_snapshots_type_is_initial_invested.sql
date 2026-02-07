-- Snapshots: type (MANUAL, CONTRIBUTION, WITHDRAWAL), is_initial, invested_value_brl, created_at
ALTER TABLE bucket_valuation_snapshots ADD COLUMN type TEXT NOT NULL DEFAULT 'MANUAL';
ALTER TABLE bucket_valuation_snapshots ADD COLUMN is_initial INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bucket_valuation_snapshots ADD COLUMN invested_value_brl INTEGER;
ALTER TABLE bucket_valuation_snapshots ADD COLUMN created_at TEXT;
