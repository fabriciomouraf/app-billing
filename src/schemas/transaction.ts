import { z } from "zod";

const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currencySchema = z.enum(["BRL", "USD"]);
const transactionTypeSchema = z.enum([
  "CONTRIBUTION",
  "WITHDRAWAL",
  "INCOME",
  "FEE",
  "TAX",
  "ADJUSTMENT",
]);

export const createTransactionSchema = z.object({
  bucketId: uuidSchema,
  date: dateSchema,
  type: transactionTypeSchema,
  amount: z.number().int(),
  currency: currencySchema,
  fxRateToBRL: z.number().positive().optional(),
  description: z.string().max(500).optional(),
});
export type CreateTransactionBody = z.infer<typeof createTransactionSchema>;

export const transactionSchema = z.object({
  id: z.string().uuid(),
  portfolio_id: z.string().uuid(),
  bucket_id: z.string().uuid(),
  date: z.string(),
  type: z.string(),
  amount: z.number(),
  currency: z.string(),
  fx_rate_to_brl: z.number().nullable(),
  description: z.string().nullable(),
});
export type Transaction = z.infer<typeof transactionSchema>;
