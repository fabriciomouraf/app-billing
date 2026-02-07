import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import { putPositionSchema } from "../schemas/position.js";

const positionParamsSchema = z.object({
  portfolioId: z.string().uuid(),
  bucketId: z.string().uuid(),
});

export const positionsRoutes = new Hono<Env>()
  .get(
    "/",
    zValidator("param", positionParamsSchema),
    async (c) => {
      const { bucketId } = c.req.valid("param");
      const bucket = await c.env.DB.prepare(
        "SELECT id FROM investment_buckets WHERE id = ?"
      )
        .bind(bucketId)
        .first();
      if (!bucket) throw new HTTPException(404, { message: "Bucket not found" });
      const latestSnapshot = await c.env.DB.prepare(
        "SELECT total_value, date FROM bucket_valuation_snapshots WHERE bucket_id = ? ORDER BY date DESC, created_at DESC LIMIT 1"
      )
        .bind(bucketId)
        .first();
      const contribSnapshots = (await c.env.DB.prepare(
        "SELECT invested_value_brl FROM bucket_valuation_snapshots WHERE bucket_id = ? AND type IN ('CONTRIBUTION', 'WITHDRAWAL') AND invested_value_brl IS NOT NULL"
      )
        .bind(bucketId)
        .all()).results as Array<{ invested_value_brl: number | null }>;
      const investedValueBRL = contribSnapshots.reduce(
        (sum, s) => sum + ((s.invested_value_brl as number) ?? 0),
        0
      );
      const currentValue = (latestSnapshot?.total_value as number) ?? 0;
      const updatedAt = (latestSnapshot?.date as string) ?? null;
      return c.json({
        bucket_id: bucketId,
        current_value: currentValue,
        invested_value_brl: investedValueBRL,
        updated_at: updatedAt,
      });
    }
  )
  .put(
    "/",
    zValidator("param", positionParamsSchema),
    zValidator("json", putPositionSchema),
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
      const createdAt = new Date().toISOString();
      const isInitial = body.isInitial === true ? 1 : 0;
      await c.env.DB.prepare(
        "INSERT INTO bucket_valuation_snapshots (id, bucket_id, date, total_value, currency, source, type, is_initial, invested_value_brl, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(crypto.randomUUID(), bucketId, body.updatedAt, body.currentValue, refCurrency, "MANUAL", "MANUAL", isInitial, null, createdAt)
        .run();
      const latestSnapshot = await c.env.DB.prepare(
        "SELECT total_value, date FROM bucket_valuation_snapshots WHERE bucket_id = ? ORDER BY date DESC, created_at DESC LIMIT 1"
      )
        .bind(bucketId)
        .first();
      const contribSnapshots = (await c.env.DB.prepare(
        "SELECT invested_value_brl FROM bucket_valuation_snapshots WHERE bucket_id = ? AND type IN ('CONTRIBUTION', 'WITHDRAWAL') AND invested_value_brl IS NOT NULL"
      )
        .bind(bucketId)
        .all()).results as Array<{ invested_value_brl: number | null }>;
      const investedValueBRL = contribSnapshots.reduce(
        (sum, s) => sum + ((s.invested_value_brl as number) ?? 0),
        0
      );
      return c.json({
        bucket_id: bucketId,
        current_value: (latestSnapshot?.total_value as number) ?? body.currentValue,
        invested_value_brl: investedValueBRL,
        updated_at: (latestSnapshot?.date as string) ?? body.updatedAt,
      });
    }
  );
