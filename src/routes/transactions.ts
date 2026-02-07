import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import { createTransactionSchema } from "../schemas/transaction.js";

const transactionsParamsSchema = z.object({
  portfolioId: z.string().uuid(),
});

export const transactionsRoutes = new Hono<Env>()
  .get(
    "/",
    zValidator("param", transactionsParamsSchema),
    async (c) => {
      const { portfolioId } = c.req.valid("param");
      const portfolio = await c.env.DB.prepare(
        "SELECT id FROM portfolios WHERE id = ?"
      )
        .bind(portfolioId)
        .first();
      if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found" });
      const { results } = await c.env.DB.prepare(
        "SELECT id, portfolio_id, bucket_id, date, type, amount, currency, fx_rate_to_brl, description FROM transactions WHERE portfolio_id = ? ORDER BY date DESC"
      )
        .bind(portfolioId)
        .all();
      return c.json({ transactions: results });
    }
  )
  .post(
    "/",
    zValidator("param", transactionsParamsSchema),
    zValidator("json", createTransactionSchema),
    async (c) => {
      const { portfolioId } = c.req.valid("param");
      const body = c.req.valid("json");
      const portfolio = await c.env.DB.prepare(
        "SELECT id FROM portfolios WHERE id = ?"
      )
        .bind(portfolioId)
        .first();
      if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found" });
      const bucket = await c.env.DB.prepare(
        "SELECT id FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
      )
        .bind(body.bucketId, portfolioId)
        .first();
      if (!bucket) throw new HTTPException(400, { message: "Bucket not found in this portfolio" });
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO transactions (id, portfolio_id, bucket_id, date, type, amount, currency, fx_rate_to_brl, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          portfolioId,
          body.bucketId,
          body.date,
          body.type,
          body.amount,
          body.currency,
          body.fxRateToBRL ?? null,
          body.description ?? null
        )
        .run();

      const row = await c.env.DB.prepare(
        "SELECT id, portfolio_id, bucket_id, date, type, amount, currency, fx_rate_to_brl, description FROM transactions WHERE id = ?"
      )
        .bind(id)
        .first();
      return c.json(row!, 201);
    }
  );
