import { z } from "zod";

const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const yearSchema = z.string().regex(/^\d{4}$/);

export const listSummariesQuerySchema = z.object({
  month: yearMonthSchema.optional(),
  year: yearSchema.optional(),
});
export type ListSummariesQuery = z.infer<typeof listSummariesQuerySchema>;

export const summarySchema = z.object({
  id: z.string().uuid(),
  portfolio_id: z.string().uuid(),
  month: z.string(),
  start_value_brl: z.number(),
  end_value_brl: z.number(),
  net_contribution_brl: z.number(),
  pnl_brl: z.number(),
});
export type Summary = z.infer<typeof summarySchema>;
