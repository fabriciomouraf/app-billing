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
      const row = await c.env.DB.prepare(
        "SELECT id, bucket_id, current_value, invested_value_brl, updated_at, is_initial, initial_value FROM bucket_positions WHERE bucket_id = ?"
      )
        .bind(bucketId)
        .first();
      if (!row) throw new HTTPException(404, { message: "Position not found" });
      return c.json(row);
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
        "SELECT id FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
      )
        .bind(bucketId, portfolioId)
        .first();
      if (!bucket) throw new HTTPException(404, { message: "Bucket not found" });
      const existing = await c.env.DB.prepare(
        "SELECT id FROM bucket_positions WHERE bucket_id = ?"
      )
        .bind(bucketId)
        .first();
      const currentValue = body.currentValue;
      const investedValueBRL = body.investedValueBRL;
      const updatedAt = body.updatedAt;
      const isInitial = body.isInitial === true ? 1 : 0;
      const initialValue = body.isInitial === true ? currentValue : null;
      if (existing) {
        await c.env.DB.prepare(
          "UPDATE bucket_positions SET current_value = ?, invested_value_brl = ?, updated_at = ?, is_initial = ?, initial_value = ? WHERE bucket_id = ?"
        )
          .bind(currentValue, investedValueBRL, updatedAt, isInitial, initialValue, bucketId)
          .run();
      } else {
        const id = crypto.randomUUID();
        await c.env.DB.prepare(
          "INSERT INTO bucket_positions (id, bucket_id, current_value, invested_value_brl, updated_at, is_initial, initial_value) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
          .bind(id, bucketId, currentValue, investedValueBRL, updatedAt, isInitial, initialValue)
          .run();
      }
      const row = await c.env.DB.prepare(
        "SELECT id, bucket_id, current_value, invested_value_brl, updated_at, is_initial, initial_value FROM bucket_positions WHERE bucket_id = ?"
      )
        .bind(bucketId)
        .first();
      return c.json(row!);
    }
  );
