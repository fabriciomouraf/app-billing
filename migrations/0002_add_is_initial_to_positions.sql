-- Adiciona flag e valor inicial para posições de ponto de partida
ALTER TABLE bucket_positions ADD COLUMN is_initial INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bucket_positions ADD COLUMN initial_value INTEGER;
