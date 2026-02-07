import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currencySchema = z.enum(["BRL", "USD"]);
const priceSourceSchema = z.enum(["MANUAL", "API"]);

export const listFxRatesQuerySchema = z.object({
  date: dateSchema.optional(),
  from: currencySchema.optional(),
  to: currencySchema.optional(),
});
export type ListFxRatesQuery = z.infer<typeof listFxRatesQuerySchema>;

export const createFxRateSchema = z.object({
  date: dateSchema,
  from: currencySchema,
  to: currencySchema,
  rate: z.number().positive(),
  source: priceSourceSchema,
});
export type CreateFxRateBody = z.infer<typeof createFxRateSchema>;

export const fxRateSchema = z.object({
  id: z.string().uuid(),
  date: z.string(),
  from_currency: z.string(),
  to_currency: z.string(),
  rate: z.number(),
  source: z.string(),
});
export type FxRate = z.infer<typeof fxRateSchema>;
