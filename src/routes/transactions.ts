import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import { getFxRateById, toBRL } from "../lib/fx.js";
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
        "SELECT id, portfolio_id, bucket_id, date, type, amount, currency, fx_rate_id, description FROM transactions WHERE portfolio_id = ? ORDER BY date DESC"
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
      const refCurrency = (bucket as { reference_currency: string }).reference_currency;
      if (body.currency !== refCurrency) {
        throw new HTTPException(400, { message: "Transaction currency must match bucket currency" });
      }
      if (body.currency === "BRL" && body.fxRateId) {
        throw new HTTPException(400, { message: "fxRateId is only allowed for non-BRL transactions" });
      }
      let fxRateSnapshot: { rate: number; from_currency: string; to_currency: string } | null = null;
      if (body.currency !== "BRL") {
        if (!body.fxRateId) {
          throw new HTTPException(400, { message: "fxRateId is required for non-BRL transactions" });
        }
        fxRateSnapshot = await getFxRateById(c.env.DB, body.fxRateId);
        if (!fxRateSnapshot) {
          throw new HTTPException(400, { message: "fxRateId not found" });
        }
        if (
          fxRateSnapshot.from_currency !== body.currency ||
          fxRateSnapshot.to_currency !== "BRL"
        ) {
          throw new HTTPException(400, { message: "fxRateId currency mismatch" });
        }
      }
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO transactions (id, portfolio_id, bucket_id, date, type, amount, currency, fx_rate_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          portfolioId,
          body.bucketId,
          body.date,
          body.type,
          body.amount,
          body.currency,
          body.fxRateId ?? null,
          body.description ?? null
        )
        .run();

      if (body.type === "CONTRIBUTION" || body.type === "WITHDRAWAL") {
        const amountInBRL =
          body.currency === "BRL"
            ? body.amount
            : toBRL(body.amount, body.currency, fxRateSnapshot!.rate);
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
        "SELECT id, portfolio_id, bucket_id, date, type, amount, currency, fx_rate_id, description FROM transactions WHERE id = ?"
      )
        .bind(id)
        .first();
      return c.json(row!, 201);
    }
  );
