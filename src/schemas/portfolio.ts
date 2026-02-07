import { z } from "zod";

const uuidSchema = z.string().uuid();
const currencySchema = z.enum(["BRL", "USD"]);

export const portfolioIdParamSchema = z.object({ id: uuidSchema });
export type PortfolioIdParam = z.infer<typeof portfolioIdParamSchema>;

export const listPortfoliosQuerySchema = z.object({
  userId: uuidSchema.optional(),
});
export type ListPortfoliosQuery = z.infer<typeof listPortfoliosQuerySchema>;

export const createPortfolioSchema = z.object({
  name: z.string().min(1).max(200),
  baseCurrency: currencySchema.default("BRL"),
  userId: uuidSchema,
});
export type CreatePortfolioBody = z.infer<typeof createPortfolioSchema>;

export const portfolioSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  base_currency: z.string(),
});
export type Portfolio = z.infer<typeof portfolioSchema>;
