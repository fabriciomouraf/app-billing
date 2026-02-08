import { z } from "zod";

export const positionSchema = z.object({
  id: z.string().uuid(),
  bucket_id: z.string().uuid(),
  current_value: z.number(),
  invested_value_brl: z.number(),
  updated_at: z.string(),
});
export type Position = z.infer<typeof positionSchema>;
