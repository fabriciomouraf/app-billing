import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../lib/env.js";
import {
  createBucketSchema,
  updateBucketSchema,
} from "../schemas/bucket.js";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const portfolioIdParamSchema = z.object({ portfolioId: z.string().uuid() });
const portfolioBucketParamsSchema = z.object({
  portfolioId: z.string().uuid(),
  bucketId: z.string().uuid(),
});

export const bucketsRoutes = new Hono<Env>()
  .get(
    "/",
    zValidator("param", portfolioIdParamSchema),
    async (c) => {
      const { portfolioId } = c.req.valid("param");
      const portfolio = await c.env.DB.prepare("SELECT id FROM portfolios WHERE id = ?")
        .bind(portfolioId)
        .first();
      if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found" });
      const { results } = await c.env.DB.prepare(
        "SELECT id, portfolio_id, type, name, reference_currency, active FROM investment_buckets WHERE portfolio_id = ? ORDER BY type"
      )
        .bind(portfolioId)
        .all();
      return c.json({ buckets: results });
    }
  )
  .post(
    "/",
    zValidator("param", portfolioIdParamSchema),
    zValidator("json", createBucketSchema),
    async (c) => {
      const { portfolioId } = c.req.valid("param");
      const body = c.req.valid("json");
      const portfolio = await c.env.DB.prepare("SELECT id FROM portfolios WHERE id = ?")
        .bind(portfolioId)
        .first();
      if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found" });
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO investment_buckets (id, portfolio_id, type, name, reference_currency, active) VALUES (?, ?, ?, ?, ?, ?)"
      )
        .bind(id, portfolioId, body.type, body.name, body.referenceCurrency, body.active ? 1 : 0)
        .run();
      const row = await c.env.DB.prepare(
        "SELECT id, portfolio_id, type, name, reference_currency, active FROM investment_buckets WHERE id = ?"
      )
        .bind(id)
        .first();
      return c.json(row!, 201);
    }
  )
  .get(
    "/:bucketId{" + uuidRegex.source + "}",
    zValidator("param", portfolioBucketParamsSchema),
    async (c) => {
      const { portfolioId, bucketId } = c.req.valid("param");
      const row = await c.env.DB.prepare(
        "SELECT id, portfolio_id, type, name, reference_currency, active FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
      )
        .bind(bucketId, portfolioId)
        .first();
      if (!row) throw new HTTPException(404, { message: "Bucket not found" });
      return c.json(row);
    }
  )
  .patch(
    "/:bucketId{" + uuidRegex.source + "}",
    zValidator("param", portfolioBucketParamsSchema),
    zValidator("json", updateBucketSchema),
    async (c) => {
      const { portfolioId, bucketId } = c.req.valid("param");
      const body = c.req.valid("json");
      const existing = await c.env.DB.prepare(
        "SELECT id FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
      )
        .bind(bucketId, portfolioId)
        .first();
      if (!existing) throw new HTTPException(404, { message: "Bucket not found" });
      const updates: string[] = [];
      const values: (string | number)[] = [];
      if (body.name !== undefined) {
        updates.push("name = ?");
        values.push(body.name);
      }
      if (body.referenceCurrency !== undefined) {
        updates.push("reference_currency = ?");
        values.push(body.referenceCurrency);
      }
      if (body.active !== undefined) {
        updates.push("active = ?");
        values.push(body.active ? 1 : 0);
      }
      if (updates.length === 0) {
        const row = await c.env.DB.prepare(
          "SELECT id, portfolio_id, type, name, reference_currency, active FROM investment_buckets WHERE id = ?"
        )
          .bind(bucketId)
          .first();
        return c.json(row!);
      }
      values.push(bucketId);
      await c.env.DB.prepare(
        `UPDATE investment_buckets SET ${updates.join(", ")} WHERE id = ?`
      )
        .bind(...values)
        .run();
      const row = await c.env.DB.prepare(
        "SELECT id, portfolio_id, type, name, reference_currency, active FROM investment_buckets WHERE id = ?"
      )
        .bind(bucketId)
        .first();
      return c.json(row!);
    }
  );
