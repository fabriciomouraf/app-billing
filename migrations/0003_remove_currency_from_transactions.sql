-- Remove currency de transactions; a moeda vem do bucket.reference_currency
ALTER TABLE transactions DROP COLUMN currency;
