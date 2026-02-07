import { z } from "zod";

const uuidSchema = z.string().uuid();
const currencySchema = z.enum(["BRL", "USD"]);
const bucketTypeSchema = z.enum(["FIXED_INCOME", "US_STOCKS", "BITCOIN", "OTHER"]);

export const portfolioBucketParamsSchema = z.object({
  portfolioId: uuidSchema,
  bucketId: uuidSchema.optional(),
});
export type PortfolioBucketParams = z.infer<typeof portfolioBucketParamsSchema>;

export const bucketIdParamSchema = z.object({ bucketId: uuidSchema });
export type BucketIdParam = z.infer<typeof bucketIdParamSchema>;

export const createBucketSchema = z.object({
  type: bucketTypeSchema,
  name: z.string().min(1).max(200),
  referenceCurrency: currencySchema,
  active: z.boolean().default(true),
});
export type CreateBucketBody = z.infer<typeof createBucketSchema>;

export const updateBucketSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  active: z.boolean().optional(),
});
export type UpdateBucketBody = z.infer<typeof updateBucketSchema>;

export const bucketSchema = z.object({
  id: z.string().uuid(),
  portfolio_id: z.string().uuid(),
  type: z.string(),
  name: z.string(),
  reference_currency: z.string(),
  active: z.number(),
});
export type Bucket = z.infer<typeof bucketSchema>;
