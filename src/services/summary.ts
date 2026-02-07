/**
 * Cálculo automático do resumo mensal do portfólio em BRL.
 * startValueBRL, endValueBRL: soma dos valores dos buckets (convertidos para BRL).
 * netContributionBRL: aportes - retiradas no mês.
 * pnlBRL = endValueBRL - startValueBRL - netContributionBRL.
 */

import { amountToBRL, getFxRate, toBRL } from "../lib/fx.js";

export interface MonthlySummaryInput {
  startValueBRL: number;
  endValueBRL: number;
  netContributionBRL: number;
  pnlBRL: number;
  pnlAccumulatedBRL: number;
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

    const startSnapshot = await db
      .prepare(
        "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date <= ? ORDER BY date DESC LIMIT 1"
      )
      .bind(bucket.id, firstDay)
      .first();
    const startVal = (startSnapshot?.total_value as number) ?? 0;

    const endSnapshot = await db
      .prepare(
        "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date <= ? ORDER BY date DESC LIMIT 1"
      )
      .bind(bucket.id, lastDay)
      .first();
    let endVal = endSnapshot?.total_value as number | undefined;
    if (endVal === undefined) {
      const pos = await db
        .prepare(
          "SELECT current_value FROM bucket_positions WHERE bucket_id = ?"
        )
        .bind(bucket.id)
        .first();
      endVal = (pos?.current_value as number) ?? 0;
    }

    const startRate = await getFxRate(db, refCurrency, "BRL", firstDay);
    const endRate = await getFxRate(db, refCurrency, "BRL", lastDay);

    startValueBRL += toBRL(startVal, refCurrency, startRate);
    endValueBRL += toBRL(endVal, refCurrency, endRate);
  }

  const transactions = (await db
    .prepare(
      "SELECT type, amount, currency, fx_rate_to_brl, date FROM transactions WHERE portfolio_id = ? AND date >= ? AND date <= ?"
    )
    .bind(portfolioId, firstDay, lastDay)
    .all()).results as Array<{
    type: string;
    amount: number;
    currency: string;
    fx_rate_to_brl: number | null;
    date: string;
  }>;

  let netContributionBRL = 0;

  for (const t of transactions) {
    const amountBRL = await amountToBRL(
      db,
      t.amount,
      t.currency,
      t.fx_rate_to_brl,
      t.date
    );

    switch (t.type) {
      case "CONTRIBUTION":
        netContributionBRL += amountBRL;
        break;
      case "WITHDRAWAL":
        netContributionBRL -= amountBRL;
        break;
    }
  }

  const pnlBRL = endValueBRL - startValueBRL - netContributionBRL;

  const previousSummaries = (await db
    .prepare(
      "SELECT pnl_brl FROM monthly_summaries WHERE portfolio_id = ? AND month < ? ORDER BY month"
    )
    .bind(portfolioId, month)
    .all()).results as Array<{ pnl_brl: number }>;
  const pnlAccumulatedBRL =
    previousSummaries.reduce((acc, s) => acc + s.pnl_brl, 0) + pnlBRL;

  return {
    startValueBRL,
    endValueBRL,
    netContributionBRL,
    pnlBRL,
    pnlAccumulatedBRL,
  };
}
