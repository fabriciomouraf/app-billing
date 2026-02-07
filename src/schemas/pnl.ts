import { z } from "zod";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const pnlQuerySchema = z.object({
  from: dateSchema,
  to: dateSchema,
});
export type PnlQuery = z.infer<typeof pnlQuerySchema>;
