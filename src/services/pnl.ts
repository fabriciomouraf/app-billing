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
  getPosition: (bucketId: string) => Promise<{ current_value: number; is_initial?: number; initial_value?: number | null } | null>;
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
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fd87d994-0bab-498c-a501-7cd75a3dab1b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pnl.ts:computePnl',message:'entry',data:{bucketId,fromDate,toDate},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const startSnapshot = await input.getLastSnapshotBefore(bucketId, fromDate);
  let startValue: number;
  if (startSnapshot != null) {
    startValue = startSnapshot.total_value;
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/fd87d994-0bab-498c-a501-7cd75a3dab1b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pnl.ts:startFromSnapshot',message:'using snapshot',data:{startValue},hypothesisId:'H1',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  } else {
    const pos = await input.getPosition(bucketId);
    if (pos?.is_initial && pos.initial_value != null) {
      startValue = pos.initial_value;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fd87d994-0bab-498c-a501-7cd75a3dab1b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pnl.ts:startFromInitialPosition',message:'using initial_value',data:{startValue,is_initial:pos.is_initial,initial_value:pos.initial_value},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } else {
      startValue = 0;
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/fd87d994-0bab-498c-a501-7cd75a3dab1b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pnl.ts:startZero',message:'no snapshot, no initial',data:{hasPos:!!pos,is_initial:pos?.is_initial,initial_value:pos?.initial_value},hypothesisId:'H2',timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
  }

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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/fd87d994-0bab-498c-a501-7cd75a3dab1b',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'pnl.ts:result',message:'exit',data:{pnl,startValue,endValue,netContributions},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { pnl, startValue, endValue, netContributions };
}
