import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../lib/env.js";
import {
  userIdParamSchema,
  createUserSchema,
} from "../schemas/user.js";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const usersRoutes = new Hono<Env>()
  .get("/", async (c) => {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, email FROM users ORDER BY name"
    )
      .all();
    return c.json({ users: results });
  })
  .get(
    "/:id{" + uuidRegex.source + "}",
    zValidator("param", userIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const row = await c.env.DB.prepare(
        "SELECT id, name, email FROM users WHERE id = ?"
      )
        .bind(id)
        .first();
      if (!row) throw new HTTPException(404, { message: "User not found" });
      return c.json(row);
    }
  )
  .post("/", zValidator("json", createUserSchema), async (c) => {
    const body = c.req.valid("json");
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO users (id, name, email) VALUES (?, ?, ?)"
    )
      .bind(id, body.name, body.email)
      .run();
    const row = await c.env.DB.prepare(
      "SELECT id, name, email FROM users WHERE id = ?"
    )
      .bind(id)
      .first();
    return c.json(row!, 201);
  });
