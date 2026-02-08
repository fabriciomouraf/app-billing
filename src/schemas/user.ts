import { z } from "zod";

const uuidSchema = z.string().uuid();

export const userIdParamSchema = z.object({ id: uuidSchema });
export type UserIdParam = z.infer<typeof userIdParamSchema>;

export const userEmailQuerySchema = z.object({
  email: z.string().email().optional(),
});
export type UserEmailQuery = z.infer<typeof userEmailQuerySchema>;

const defaultPassword = "q1w2e3r4t5";

export const createUserSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(1).default(defaultPassword),
});
export type CreateUserBody = z.infer<typeof createUserSchema>;

export const userSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  password: z.string(),
});
export type User = z.infer<typeof userSchema>;
