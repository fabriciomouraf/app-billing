import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../lib/env.js";
import { loginSchema } from "../schemas/user.js";
import { signToken } from "../middleware/auth.js";

export const authRoutes = new Hono<Env>()
  .post("/login", zValidator("json", loginSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const row = await c.env.DB.prepare(
      "SELECT id, password FROM users WHERE email = ?"
    )
      .bind(email)
      .first();
    if (!row || (row.password as string) !== password) {
      throw new HTTPException(401, { message: "Invalid email or password" });
    }
    const userId = row.id as string;
    const secret = c.env.JWT_SECRET;
    if (!secret) {
      throw new HTTPException(500, { message: "JWT_SECRET not configured" });
    }
    const token = await signToken(userId, secret, "24h");
    return c.json({ token });
  });
