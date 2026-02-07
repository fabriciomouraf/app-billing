import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

export const listSummariesQuerySchema = z.object({
  month: yearMonthSchema.optional(),
});
export type ListSummariesQuery = z.infer<typeof listSummariesQuerySchema>;

export const createSummarySchema = z.object({
  month: yearMonthSchema,
  startValueBRL: z.number().int().min(0),
  endValueBRL: z.number().int().min(0),
  netContributionBRL: z.number().int(),
  incomeBRL: z.number().int(),
  feesAndTaxesBRL: z.number().int(),
  pnlBRL: z.number().int(),
  pnlAccumulatedBRL: z.number().int(),
});
export type CreateSummaryBody = z.infer<typeof createSummarySchema>;

export const summarySchema = z.object({
  id: z.string().uuid(),
  portfolio_id: z.string().uuid(),
  month: z.string(),
  start_value_brl: z.number(),
  end_value_brl: z.number(),
  net_contribution_brl: z.number(),
  income_brl: z.number(),
  fees_and_taxes_brl: z.number(),
  pnl_brl: z.number(),
  pnl_accumulated_brl: z.number(),
});
export type Summary = z.infer<typeof summarySchema>;
