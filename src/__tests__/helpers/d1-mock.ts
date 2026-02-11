/**
 * Mock mínimo do D1 para testes do route de summaries.
 * Mantém portfolios e monthly_summaries em memória e aplica as queries usadas pelo route.
 */

export type SummaryRow = {
  id: string;
  portfolio_id: string;
  month: string;
  start_value_brl: number;
  end_value_brl: number;
  net_contribution_brl: number;
  pnl_brl: number;
};

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, " ").trim();
}

export function createD1Mock(options: { portfolioId: string; initialSummaries?: SummaryRow[] }) {
  const portfolios = new Set<string>([options.portfolioId]);
  const summaries = new Map<string, SummaryRow>();
  for (const row of options.initialSummaries ?? []) {
    summaries.set(`${row.portfolio_id}\t${row.month}`, { ...row });
  }

  function createStatement(sql: string) {
    const n = normalizeSql(sql);
    const bind = (...params: unknown[]) => {
      const first = () => {
        if (n.startsWith("SELECT id FROM portfolios WHERE id =")) {
          const id = params[0] as string;
          return Promise.resolve(portfolios.has(id) ? { id } : null);
        }
        if (n.includes("SELECT id FROM monthly_summaries WHERE portfolio_id = ? AND month = ?")) {
          const key = `${params[0]}\t${params[1]}`;
          const row = summaries.get(key) ?? null;
          return Promise.resolve(row ? { id: row.id } : null);
        }
        if (n.includes("COALESCE(SUM(pnl_brl)")) {
          const portfolioId = params[0] as string;
          const pattern = (params[1] as string).replace("%", "");
          let sum = 0;
          for (const [k, row] of summaries) {
            if (row.portfolio_id === portfolioId && row.month.startsWith(pattern)) sum += row.pnl_brl;
          }
          return Promise.resolve({ pnl_accumulated_brl: sum });
        }
        if (n.includes("SELECT id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl FROM monthly_summaries WHERE portfolio_id = ? AND month = ?")) {
          const key = `${params[0]}\t${params[1]}`;
          const row = summaries.get(key) ?? null;
          return Promise.resolve(row);
        }
        return Promise.resolve(null);
      };
      const run = () => {
        if (n.includes("UPDATE monthly_summaries SET start_value_brl = ?, end_value_brl = ?, net_contribution_brl = ?, pnl_brl = ?")) {
          const [start_value_brl, end_value_brl, net_contribution_brl, pnl_brl, portfolioId, month] = params as number[];
          const key = `${portfolioId}\t${month}`;
          const existing = summaries.get(key);
          summaries.set(key, {
            id: existing?.id ?? crypto.randomUUID(),
            portfolio_id: portfolioId as unknown as string,
            month: month as unknown as string,
            start_value_brl,
            end_value_brl,
            net_contribution_brl,
            pnl_brl,
          });
          return Promise.resolve({ meta: { changes: 1 } } as D1Result);
        }
        if (n.includes("INSERT INTO monthly_summaries (id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl) VALUES (?, ?, ?, ?, ?, ?, ?)")) {
          const [id, portfolioId, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl] = params as (string | number)[];
          const key = `${portfolioId}\t${month}`;
          summaries.set(key, {
            id: id as string,
            portfolio_id: portfolioId as string,
            month: month as string,
            start_value_brl: start_value_brl as number,
            end_value_brl: end_value_brl as number,
            net_contribution_brl: net_contribution_brl as number,
            pnl_brl: pnl_brl as number,
          });
          return Promise.resolve({ meta: { changes: 1 } } as D1Result);
        }
        if (n.includes("UPDATE monthly_summaries SET start_value_brl = 0, end_value_brl = 0, net_contribution_brl = 0, pnl_brl = 0")) {
          const [portfolioId, month] = params as string[];
          const key = `${portfolioId}\t${month}`;
          const existing = summaries.get(key);
          const id = existing?.id ?? crypto.randomUUID();
          summaries.set(key, {
            id,
            portfolio_id: portfolioId,
            month,
            start_value_brl: 0,
            end_value_brl: 0,
            net_contribution_brl: 0,
            pnl_brl: 0,
          });
          return Promise.resolve({ meta: { changes: 1 } } as D1Result);
        }
        if (n.includes("INSERT INTO monthly_summaries (id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl) VALUES (?, ?, ?, 0, 0, 0, 0)")) {
          const [id, portfolioId, month] = params as string[];
          const key = `${portfolioId}\t${month}`;
          summaries.set(key, {
            id,
            portfolio_id: portfolioId,
            month,
            start_value_brl: 0,
            end_value_brl: 0,
            net_contribution_brl: 0,
            pnl_brl: 0,
          });
          return Promise.resolve({ meta: { changes: 1 } } as D1Result);
        }
        return Promise.resolve({ meta: { changes: 0 } } as D1Result);
      };
      const all = () => {
        if (n.includes("ORDER BY month DESC")) {
          const portfolioId = params[0] as string;
          const rows = [...summaries.values()].filter((r) => r.portfolio_id === portfolioId).sort((a, b) => b.month.localeCompare(a.month));
          return Promise.resolve({ results: rows } as D1Result);
        }
        return Promise.resolve({ results: [] } as D1Result);
      };
      return { first, run, all };
    };
    return { bind };
  }

  return {
    DB: {
      prepare: (sql: string) => createStatement(sql),
    } as D1Database,
    getSummaries: () => new Map(summaries),
    getSummary: (portfolioId: string, month: string) => summaries.get(`${portfolioId}\t${month}`) ?? null,
  };
}

interface D1Result {
  meta: { changes: number };
  results?: unknown[];
}
