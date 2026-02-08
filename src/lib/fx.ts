/**
 * Helpers para conversão de moeda usando fx_rate_snapshots.
 */

export async function getFxRate(
  db: D1Database,
  from: string,
  to: string,
  onOrBeforeDate: string
): Promise<number> {
  if (from === to) return 1;
  const row = await db
    .prepare(
      "SELECT rate FROM fx_rate_snapshots WHERE from_currency = ? AND to_currency = ? AND date <= ? ORDER BY date DESC LIMIT 1"
    )
    .bind(from, to, onOrBeforeDate)
    .first();
  return (row?.rate as number) ?? 1;
}

export async function getFxRateById(
  db: D1Database,
  id: string
): Promise<{ id: string; from_currency: string; to_currency: string; rate: number } | null> {
  const row = await db
    .prepare(
      "SELECT id, from_currency, to_currency, rate FROM fx_rate_snapshots WHERE id = ?"
    )
    .bind(id)
    .first();
  return (row as { id: string; from_currency: string; to_currency: string; rate: number }) ?? null;
}

/**
 * Converte valor (centavos) para BRL.
 * - Se currency BRL: retorna amount.
 * - Se currency USD (ou outra): usa fxRateToBRL ou busca fx rate da data.
 */
export async function amountToBRL(
  db: D1Database,
  amount: number,
  currency: string,
  fxRateToBRL: number | null | undefined,
  date: string
): Promise<number> {
  if (currency === "BRL") return amount;
  const rate = fxRateToBRL ?? (await getFxRate(db, currency, "BRL", date));
  return Math.round(amount * rate);
}

/**
 * Converte valor (centavos) para BRL dado um fx rate já obtido.
 */
export function toBRL(amountCents: number, currency: string, fxRate: number): number {
  if (currency === "BRL") return amountCents;
  return Math.round(amountCents * fxRate);
}
