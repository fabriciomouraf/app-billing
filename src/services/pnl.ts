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
  getInitialSnapshot: (bucketId: string) => Promise<{ total_value: number } | null>;
  getNetContributionsInPeriod: (
    bucketId: string,
    from: string,
    to: string
  ) => Promise<number>;
}

export async function computePnl(
  bucketId: string,
  fromDate: string,
  toDate: string,
  input: PnlInput
): Promise<PnlResult> {
  const startSnapshot = await input.getLastSnapshotBefore(bucketId, fromDate);
  const startValue =
    startSnapshot != null
      ? startSnapshot.total_value
      : ((await input.getInitialSnapshot(bucketId))?.total_value) ?? 0;

  const endSnapshot = await input.getSnapshotAt(bucketId, toDate);
  const endValue = endSnapshot?.total_value ?? 0;

  const netContributions = await input.getNetContributionsInPeriod(
    bucketId,
    fromDate,
    toDate
  );

  const pnl = endValue - startValue - netContributions;

  return { pnl, startValue, endValue, netContributions };
}
