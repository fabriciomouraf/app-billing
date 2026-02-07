import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const putPositionSchema = z.object({
  currentValue: z.number().int().min(0),
  investedValueBRL: z.number().int().min(0),
  updatedAt: dateSchema,
});
export type PutPositionBody = z.infer<typeof putPositionSchema>;

export const positionSchema = z.object({
  id: z.string().uuid(),
  bucket_id: z.string().uuid(),
  current_value: z.number(),
  invested_value_brl: z.number(),
  updated_at: z.string(),
});
export type Position = z.infer<typeof positionSchema>;
