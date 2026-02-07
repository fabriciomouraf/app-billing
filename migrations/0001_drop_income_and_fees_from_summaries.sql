-- Remove income_brl e fees_and_taxes_brl de monthly_summaries

ALTER TABLE monthly_summaries DROP COLUMN income_brl;
ALTER TABLE monthly_summaries DROP COLUMN fees_and_taxes_brl;
