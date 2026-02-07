/**
 * Cálculo de rendimento (PnL) de um bucket em um período.
 * Fórmula: pnl = endValue - startValue - netContributions
 * onde netContributions = soma(CONTRIBUTION) - soma(WITHDRAWAL) no período (aportes entram, retiradas saem).
 */
export interface PnlResult {
  pnl: number;
  startValue: number;
  endValue: number;
  netContributions: number;
}

export interface PnlInput {
  getLastSnapshotBefore: (bucketId: string, beforeDate: string) => Promise<{ total_value: number } | null>;
  getSnapshotAt: (bucketId: string, date: string) => Promise<{ total_value: number } | null>;
  getPosition: (bucketId: string) => Promise<{ current_value: number } | null>;
  getTransactionsInPeriod: (
    bucketId: string,
    from: string,
    to: string
  ) => Promise<Array<{ type: string; amount: number }>>;
}

export async function computePnl(
  bucketId: string,
  fromDate: string,
  toDate: string,
  input: PnlInput
): Promise<PnlResult> {
  const startSnapshot = await input.getLastSnapshotBefore(bucketId, fromDate);
  const startValue = startSnapshot?.total_value ?? 0;

  const endSnapshot = await input.getSnapshotAt(bucketId, toDate);
  const position = endSnapshot
    ? null
    : await input.getPosition(bucketId);
  const endValue = endSnapshot
    ? endSnapshot.total_value
    : position?.current_value ?? 0;

  const transactions = await input.getTransactionsInPeriod(
    bucketId,
    fromDate,
    toDate
  );
  let netContributions = 0;
  for (const t of transactions) {
    if (t.type === "CONTRIBUTION") netContributions += t.amount;
    else if (t.type === "WITHDRAWAL") netContributions -= t.amount;
  }

  const pnl = endValue - startValue - netContributions;

  return { pnl, startValue, endValue, netContributions };
}
