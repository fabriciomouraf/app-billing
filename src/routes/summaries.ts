import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import {
  listSummariesQuerySchema,
  createSummarySchema,
} from "../schemas/summary.js";

const summariesParamsSchema = z.object({
  portfolioId: z.string().uuid(),
});

export const summariesRoutes = new Hono<Env>()
  .get(
    "/",
    zValidator("param", summariesParamsSchema),
    zValidator("query", listSummariesQuerySchema),
    async (c) => {
      const { portfolioId } = c.req.valid("param");
      const { month } = c.req.valid("query");
      const portfolio = await c.env.DB.prepare(
        "SELECT id FROM portfolios WHERE id = ?"
      )
        .bind(portfolioId)
        .first();
      if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found" });
      let stmt;
      if (month) {
        stmt = c.env.DB.prepare(
          "SELECT id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, income_brl, fees_and_taxes_brl, pnl_brl, pnl_accumulated_brl FROM monthly_summaries WHERE portfolio_id = ? AND month = ?"
        ).bind(portfolioId, month);
        const row = await stmt.first();
        if (!row) throw new HTTPException(404, { message: "Summary not found" });
        return c.json(row);
      }
      const { results } = await c.env.DB.prepare(
        "SELECT id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, income_brl, fees_and_taxes_brl, pnl_brl, pnl_accumulated_brl FROM monthly_summaries WHERE portfolio_id = ? ORDER BY month DESC"
      )
        .bind(portfolioId)
        .all();
      return c.json({ summaries: results });
    }
  )
  .post(
    "/",
    zValidator("param", summariesParamsSchema),
    zValidator("json", createSummarySchema),
    async (c) => {
      const { portfolioId } = c.req.valid("param");
      const body = c.req.valid("json");
      const portfolio = await c.env.DB.prepare(
        "SELECT id FROM portfolios WHERE id = ?"
      )
        .bind(portfolioId)
        .first();
      if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found" });
      const id = crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO monthly_summaries (id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, income_brl, fees_and_taxes_brl, pnl_brl, pnl_accumulated_brl) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          id,
          portfolioId,
          body.month,
          body.startValueBRL,
          body.endValueBRL,
          body.netContributionBRL,
          body.incomeBRL,
          body.feesAndTaxesBRL,
          body.pnlBRL,
          body.pnlAccumulatedBRL
        )
        .run();
      const row = await c.env.DB.prepare(
        "SELECT id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, income_brl, fees_and_taxes_brl, pnl_brl, pnl_accumulated_brl FROM monthly_summaries WHERE id = ?"
      )
        .bind(id)
        .first();
      return c.json(row!, 201);
    }
  );
