/**
 * Cálculo automático do resumo mensal do portfólio em BRL.
 * startValueBRL, endValueBRL: soma dos valores dos buckets (convertidos para BRL).
 * netContributionBRL: aportes - retiradas no mês.
 * pnlBRL = endValueBRL - startValueBRL - netContributionBRL.
 */

import { getFxRate, toBRL } from "../lib/fx.js";

export interface MonthlySummaryInput {
  startValueBRL: number;
  endValueBRL: number;
  netContributionBRL: number;
  pnlBRL: number;
}

function getLastDayOfMonth(year: number, month: number): string {
  const lastDate = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDate).padStart(2, "0")}`;
}

export async function computeMonthlySummary(
  db: D1Database,
  portfolioId: string,
  month: string
): Promise<MonthlySummaryInput> {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const monthNum = parseInt(monthStr, 10);
  const firstDay = `${year}-${monthStr}-01`;
  const lastDay = getLastDayOfMonth(year, monthNum);

  const buckets = (await db
    .prepare(
      "SELECT id, reference_currency FROM investment_buckets WHERE portfolio_id = ? AND active = 1"
    )
    .bind(portfolioId)
    .all()).results as Array<{ id: string; reference_currency: string }>;

  let startValueBRL = 0;
  let endValueBRL = 0;

  for (const bucket of buckets) {
    const refCurrency = bucket.reference_currency;

    let startSnapshot = await db
      .prepare(
        "SELECT total_value, date FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT 1"
      )
      .bind(bucket.id, firstDay)
      .first();
    let startVal = (startSnapshot?.total_value as number) ?? 0;
    if (startVal === 0) {
      const initialSnapshot = await db
        .prepare(
          "SELECT total_value, date FROM bucket_valuation_snapshots WHERE bucket_id = ? AND is_initial = 1 ORDER BY date ASC LIMIT 1"
        )
        .bind(bucket.id)
        .first();
      startVal = (initialSnapshot?.total_value as number) ?? 0;
      startSnapshot = initialSnapshot;
    }
    const startSnapshotDate = (startSnapshot?.date as string) ?? firstDay;
    const startRate = await getFxRate(db, refCurrency, "BRL", startSnapshotDate);

    const endSnapshot = await db
      .prepare(
        "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT 1"
      )
      .bind(bucket.id, lastDay)
      .first();
    const endVal = (endSnapshot?.total_value as number) ?? 0;

    const endRate = await getFxRate(db, refCurrency, "BRL", lastDay);

    startValueBRL += toBRL(startVal, refCurrency, startRate);
    endValueBRL += toBRL(endVal, refCurrency, endRate);
  }

  const contribSnapshots = (await db
    .prepare(
      "SELECT s.invested_value_brl FROM bucket_valuation_snapshots s JOIN investment_buckets b ON s.bucket_id = b.id WHERE b.portfolio_id = ? AND s.type IN ('CONTRIBUTION', 'WITHDRAWAL') AND s.date >= ? AND s.date <= ? AND s.invested_value_brl IS NOT NULL"
    )
    .bind(portfolioId, firstDay, lastDay)
    .all()).results as Array<{ invested_value_brl: number | null }>;

  const netContributionBRL = contribSnapshots.reduce(
    (sum, s) => sum + ((s.invested_value_brl as number) ?? 0),
    0
  );

  const pnlBRL = endValueBRL - startValueBRL - netContributionBRL;

  return {
    startValueBRL,
    endValueBRL,
    netContributionBRL,
    pnlBRL,
  };
}
