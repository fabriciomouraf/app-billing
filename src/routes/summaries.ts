import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import type { Env } from "../lib/env.js";
import { listSummariesQuerySchema } from "../schemas/summary.js";
import { computeMonthlySummary } from "../services/summary.js";

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
      const { month, year } = c.req.valid("query");
      const portfolio = await c.env.DB.prepare(
        "SELECT id FROM portfolios WHERE id = ?"
      )
        .bind(portfolioId)
        .first();
      if (!portfolio) throw new HTTPException(404, { message: "Portfolio not found" });

      if (year) {
        const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
        for (const m of months) {
          const monthStr = `${year}-${m}`;
          const computed = await computeMonthlySummary(c.env.DB, portfolioId, monthStr);
          const existing = await c.env.DB.prepare(
            "SELECT id FROM monthly_summaries WHERE portfolio_id = ? AND month = ?"
          )
            .bind(portfolioId, monthStr)
            .first();

          if (existing) {
            await c.env.DB.prepare(
              "UPDATE monthly_summaries SET start_value_brl = ?, end_value_brl = ?, net_contribution_brl = ?, pnl_brl = ? WHERE portfolio_id = ? AND month = ?"
            )
              .bind(computed.startValueBRL, computed.endValueBRL, computed.netContributionBRL, computed.pnlBRL, portfolioId, monthStr)
              .run();
          } else {
            const id = crypto.randomUUID();
            await c.env.DB.prepare(
              "INSERT INTO monthly_summaries (id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl) VALUES (?, ?, ?, ?, ?, ?, ?)"
            )
              .bind(id, portfolioId, monthStr, computed.startValueBRL, computed.endValueBRL, computed.netContributionBRL, computed.pnlBRL)
              .run();
          }
        }

        const row = await c.env.DB.prepare(
          "SELECT COALESCE(SUM(pnl_brl), 0) as pnl_accumulated_brl FROM monthly_summaries WHERE portfolio_id = ? AND month LIKE ?"
        )
          .bind(portfolioId, `${year}-%`)
          .first();
        const pnlAccumulatedBRL = (row?.pnl_accumulated_brl as number) ?? 0;
        return c.json({
          year: parseInt(year, 10),
          pnl_accumulated_brl: pnlAccumulatedBRL,
          pnl_accumulated_brl_real: pnlAccumulatedBRL / 100,
        });
      }

      if (month) {
        const computed = await computeMonthlySummary(c.env.DB, portfolioId, month);
        const existing = await c.env.DB.prepare(
          "SELECT id FROM monthly_summaries WHERE portfolio_id = ? AND month = ?"
        )
          .bind(portfolioId, month)
          .first();

        if (existing) {
          await c.env.DB.prepare(
            "UPDATE monthly_summaries SET start_value_brl = ?, end_value_brl = ?, net_contribution_brl = ?, pnl_brl = ? WHERE portfolio_id = ? AND month = ?"
          )
            .bind(
              computed.startValueBRL,
              computed.endValueBRL,
              computed.netContributionBRL,
              computed.pnlBRL,
              portfolioId,
              month
            )
            .run();
        } else {
          const id = crypto.randomUUID();
          await c.env.DB.prepare(
            "INSERT INTO monthly_summaries (id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl) VALUES (?, ?, ?, ?, ?, ?, ?)"
          )
            .bind(
              id,
              portfolioId,
              month,
              computed.startValueBRL,
              computed.endValueBRL,
              computed.netContributionBRL,
              computed.pnlBRL
            )
            .run();
        }

        const row = await c.env.DB.prepare(
          "SELECT id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl FROM monthly_summaries WHERE portfolio_id = ? AND month = ?"
        )
          .bind(portfolioId, month)
          .first();
        const startValueBRL = Number(row?.start_value_brl ?? 0);
        const endValueBRL = Number(row?.end_value_brl ?? 0);
        const netContributionBRL = Number(row?.net_contribution_brl ?? 0);
        const pnlBRL = Number(row?.pnl_brl ?? 0);
        return c.json({
          ...row,
          values_brl_real: {
            start_value: startValueBRL / 100,
            end_value: endValueBRL / 100,
            net_contribution: netContributionBRL / 100,
            pnl: pnlBRL / 100,
          },
        });
      }

      const { results } = await c.env.DB.prepare(
        "SELECT id, portfolio_id, month, start_value_brl, end_value_brl, net_contribution_brl, pnl_brl FROM monthly_summaries WHERE portfolio_id = ? ORDER BY month DESC"
      )
        .bind(portfolioId)
        .all();
      return c.json({ summaries: results });
    }
  );
