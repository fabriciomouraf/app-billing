import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import { amountToBRL } from "../lib/fx.js";
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
        "SELECT t.id, t.portfolio_id, t.bucket_id, t.date, t.type, t.amount, b.reference_currency as currency, t.fx_rate_to_brl, t.description FROM transactions t JOIN investment_buckets b ON t.bucket_id = b.id WHERE t.portfolio_id = ? ORDER BY t.date DESC"
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
        "SELECT id, reference_currency FROM investment_buckets WHERE id = ? AND portfolio_id = ?"
      )
        .bind(body.bucketId, portfolioId)
        .first();
      if (!bucket) throw new HTTPException(400, { message: "Bucket not found in this portfolio" });
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO transactions (id, portfolio_id, bucket_id, date, type, amount, fx_rate_to_brl, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          portfolioId,
          body.bucketId,
          body.date,
          body.type,
          body.amount,
          body.fxRateToBRL ?? null,
          body.description ?? null
        )
        .run();

      if (body.type === "CONTRIBUTION" || body.type === "WITHDRAWAL") {
        const refCurrency = (bucket as { reference_currency: string }).reference_currency;
        const amountInBRL = await amountToBRL(
          c.env.DB,
          body.amount,
          refCurrency,
          body.fxRateToBRL,
          body.date
        );
        const lastSnapshot = await c.env.DB.prepare(
          "SELECT total_value FROM bucket_valuation_snapshots WHERE bucket_id = ? ORDER BY date DESC, created_at DESC LIMIT 1"
        )
          .bind(body.bucketId)
          .first();
        const lastTotal = (lastSnapshot?.total_value as number) ?? 0;
        const newTotal = body.type === "CONTRIBUTION"
          ? lastTotal + body.amount
          : lastTotal - body.amount;
        const investedValueBRL = body.type === "CONTRIBUTION" ? amountInBRL : -amountInBRL;
        const snapshotCurrency = refCurrency;
        const snapshotId = crypto.randomUUID();
        const snapshotCreatedAt = new Date().toISOString();
        await c.env.DB.prepare(
          "INSERT INTO bucket_valuation_snapshots (id, bucket_id, date, total_value, currency, source, type, is_initial, invested_value_brl, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)"
        )
          .bind(
            snapshotId,
            body.bucketId,
            body.date,
            Math.max(0, newTotal),
            snapshotCurrency,
            "TRANSACTION",
            body.type,
            investedValueBRL,
            snapshotCreatedAt
          )
          .run();
      }

      const row = await c.env.DB.prepare(
        "SELECT t.id, t.portfolio_id, t.bucket_id, t.date, t.type, t.amount, b.reference_currency as currency, t.fx_rate_to_brl, t.description FROM transactions t JOIN investment_buckets b ON t.bucket_id = b.id WHERE t.id = ?"
      )
        .bind(id)
        .first();
      return c.json(row!, 201);
    }
  );
