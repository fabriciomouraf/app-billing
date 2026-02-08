-- Remove pnl_accumulated_brl; PnL do ano vem do endpoint GET summaries?year=YYYY
ALTER TABLE monthly_summaries DROP COLUMN pnl_accumulated_brl;
