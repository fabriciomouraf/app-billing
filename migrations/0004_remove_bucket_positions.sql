-- Position e PnL vêm dos snapshots; invested_value_brl é calculado das transactions.
-- Adiciona initial_value ao bucket para PnL quando não há snapshot no início.
ALTER TABLE investment_buckets ADD COLUMN initial_value INTEGER;

-- Remove tabela de positions (dados derivados de snapshots + transactions)
DROP TABLE IF EXISTS bucket_positions;
