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
          "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date < ? ORDER BY date DESC LIMIT 1"
        )
          .bind(bid, beforeDate)
          .first();
        return row as { total_value: number } | null;
      },
      getSnapshotAt: async (bid, date) => {
        const row = await c.env.DB.prepare(
          "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date = ?"
        )
          .bind(bid, date)
          .first();
        return row as { total_value: number } | null;
      },
      getPosition: async (bid) => {
        const row = await c.env.DB.prepare(
          "SELECT current_value FROM bucket_positions WHERE bucket_id = ?"
        )
          .bind(bid)
          .first();
        return row as { current_value: number } | null;
      },
      getTransactionsInPeriod: async (bid, fromDate, toDate) => {
        const { results } = await c.env.DB.prepare(
          "SELECT type, amount FROM transactions WHERE bucket_id = ? AND date >= ? AND date <= ?"
        )
          .bind(bid, fromDate, toDate)
          .all();
        return results as Array<{ type: string; amount: number }>;
      },
    });

    return c.json(result);
  }
);
