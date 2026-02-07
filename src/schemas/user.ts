import { z } from "zod";

const uuidSchema = z.string().uuid();

export const userIdParamSchema = z.object({ id: uuidSchema });
export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
});
export type CreateUserBody = z.infer<typeof createUserSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
});
export type User = z.infer<typeof userSchema>;
