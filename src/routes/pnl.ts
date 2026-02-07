import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import { pnlQuerySchema } from "../schemas/pnl.js";
import { computePnl } from "../services/pnl.js";

const pnlParamsSchema = z.object({
  portfolioId: z.string().uuid(),
  bucketId: z.string().uuid(),
});

export const pnlRoutes = new Hono<Env>().get(
  "/",
  zValidator("param", pnlParamsSchema),
  zValidator("query", pnlQuerySchema),
  async (c) => {
    const { portfolioId, bucketId } = c.req.valid("param");
    const { from, to } = c.req.valid("query");
    const bucket = await c.env.DB.prepare(
      "SELECT id FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
    )
      .bind(bucketId, portfolioId)
      .first();
    if (!bucket) throw new HTTPException(404, { message: "Bucket not found" });

    const result = await computePnl(bucketId, from, to, {
      getLastSnapshotBefore: async (bid, beforeDate) => {
        const row = await c.env.DB.prepare(
          "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT 1"
        )
          .bind(bid, beforeDate)
          .first();
        return row as { total_value: number } | null;
      },
      getSnapshotAt: async (bid, date) => {
        const row = await c.env.DB.prepare(
          "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date <= ? ORDER BY date DESC, created_at DESC LIMIT 1"
        )
          .bind(bid, date)
          .first();
        return row as { total_value: number } | null;
      },
      getInitialSnapshot: async (bid) => {
        const row = await c.env.DB.prepare(
          "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND is_initial = 1 ORDER BY date ASC LIMIT 1"
        )
          .bind(bid)
          .first();
        return row as { total_value: number } | null;
      },
      getNetContributionsInPeriod: async (bid, fromDate, toDate) => {
        const { results } = await c.env.DB.prepare(
          "SELECT invested_value_brl FROM bucket_valuation_snapshots WHERE bucket_id = ? AND type IN ('CONTRIBUTION', 'WITHDRAWAL') AND date >= ? AND date <= ? AND invested_value_brl IS NOT NULL"
        )
          .bind(bid, fromDate, toDate)
          .all();
        const rows = results as Array<{ invested_value_brl: number | null }>;
        return rows.reduce((sum, r) => sum + ((r.invested_value_brl as number) ?? 0), 0);
      },
    });

    return c.json(result);
  }
);
