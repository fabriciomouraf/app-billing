-- Reintroduz moeda da transação e referencia de fx rate
ALTER TABLE transactions ADD COLUMN currency TEXT;
ALTER TABLE transactions ADD COLUMN fx_rate_id TEXT;

-- Preenche currency com a moeda de referência do bucket
UPDATE transactions
SET currency = (
  SELECT reference_currency
  FROM investment_buckets
  WHERE investment_buckets.id = transactions.bucket_id
)
WHERE currency IS NULL;
