import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import {
  listSnapshotsQuerySchema,
  createSnapshotSchema,
} from "../schemas/snapshot.js";

const snapshotParamsSchema = z.object({
  portfolioId: z.string().uuid(),
  bucketId: z.string().uuid(),
});

export const snapshotsRoutes = new Hono<Env>()
  .get(
    "/",
    zValidator("param", snapshotParamsSchema),
    zValidator("query", listSnapshotsQuerySchema),
    async (c) => {
      const { bucketId } = c.req.valid("param");
      const { from, to } = c.req.valid("query");
      const bucket = await c.env.DB.prepare(
        "SELECT id FROM investment_buckets WHERE id = ?"
      )
        .bind(bucketId)
        .first();
      if (!bucket) throw new HTTPException(404, { message: "Bucket not found" });
      let stmt;
      if (from && to) {
        stmt = c.env.DB.prepare(
          "SELECT id, bucket_id, date, total_value, currency, type, is_initial, invested_value_brl, created_at FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date >= ? AND date <= ? ORDER BY date DESC, created_at DESC"
        ).bind(bucketId, from, to);
      } else {
        stmt = c.env.DB.prepare(
          "SELECT id, bucket_id, date, total_value, currency, type, is_initial, invested_value_brl, created_at FROM bucket_valuation_snapshots WHERE bucket_id = ? ORDER BY date DESC, created_at DESC"
        ).bind(bucketId);
      }
      const { results } = await stmt.all();
      return c.json({ snapshots: results });
    }
  )
  .post(
    "/",
    zValidator("param", snapshotParamsSchema),
    zValidator("json", createSnapshotSchema),
    async (c) => {
      const { portfolioId, bucketId } = c.req.valid("param");
      const body = c.req.valid("json");
      const bucket = await c.env.DB.prepare(
        "SELECT id, reference_currency FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
      )
        .bind(bucketId, portfolioId)
        .first();
      if (!bucket) throw new HTTPException(404, { message: "Bucket not found" });
      const refCurrency = (bucket as { reference_currency: string }).reference_currency;
      if (body.currency && body.currency !== refCurrency) {
        throw new HTTPException(400, { message: "Snapshot currency must match bucket currency" });
      }
      const currency = body.currency ?? refCurrency;
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const countResult = await c.env.DB.prepare(
        "SELECT COUNT(*) as count FROM bucket_valuation_snapshots WHERE bucket_id = ?"
      )
        .bind(bucketId)
        .first();
      const isFirstSnapshot = ((countResult?.count as number) ?? 0) === 0;
      const isInitial = isFirstSnapshot ? 1 : 0;
      await c.env.DB.prepare(
        "INSERT INTO bucket_valuation_snapshots (id, bucket_id, date, total_value, currency, source, type, is_initial, invested_value_brl, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(id, bucketId, body.date, body.totalValue, currency, "MANUAL", "MANUAL", isInitial, null, createdAt)
        .run();

      const row = await c.env.DB.prepare(
        "SELECT id, bucket_id, date, total_value, currency, type, is_initial, invested_value_brl, created_at FROM bucket_valuation_snapshots WHERE id = ?"
      )
        .bind(id)
        .first();
      return c.json(row!, 201);
    }
  );
