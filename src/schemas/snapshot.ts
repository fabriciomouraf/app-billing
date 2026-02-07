import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const currencySchema = z.enum(["BRL", "USD"]);
const priceSourceSchema = z.enum(["MANUAL", "API"]);

export const listSnapshotsQuerySchema = z.object({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});
export type ListSnapshotsQuery = z.infer<typeof listSnapshotsQuerySchema>;

export const createSnapshotSchema = z.object({
  date: dateSchema,
  totalValue: z.number().int().min(0),
  currency: currencySchema,
  source: priceSourceSchema,
});
export type CreateSnapshotBody = z.infer<typeof createSnapshotSchema>;

export const snapshotSchema = z.object({
  id: z.string().uuid(),
  bucket_id: z.string().uuid(),
  date: z.string(),
  total_value: z.number(),
  currency: z.string(),
  source: z.string(),
});
export type Snapshot = z.infer<typeof snapshotSchema>;
