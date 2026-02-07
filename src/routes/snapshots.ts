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
          "SELECT id, bucket_id, date, total_value, currency, source FROM bucket_valuation_snapshots WHERE bucket_id = ? AND date >= ? AND date <= ? ORDER BY date DESC"
        ).bind(bucketId, from, to);
      } else {
        stmt = c.env.DB.prepare(
          "SELECT id, bucket_id, date, total_value, currency, source FROM bucket_valuation_snapshots WHERE bucket_id = ? ORDER BY date DESC"
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
        "SELECT id FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
      )
        .bind(bucketId, portfolioId)
        .first();
      if (!bucket) throw new HTTPException(404, { message: "Bucket not found" });
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO bucket_valuation_snapshots (id, bucket_id, date, total_value, currency, source) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(id, bucketId, body.date, body.totalValue, body.currency, body.source)
        .run();
      const row = await c.env.DB.prepare(
        "SELECT id, bucket_id, date, total_value, currency, source FROM bucket_valuation_snapshots WHERE id = ?"
      )
        .bind(id)
        .first();
      return c.json(row!, 201);
    }
  );
