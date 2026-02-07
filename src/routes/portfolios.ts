import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../lib/env.js";
import {
  portfolioIdParamSchema,
  listPortfoliosQuerySchema,
  createPortfolioSchema,
} from "../schemas/portfolio.js";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const portfoliosRoutes = new Hono<Env>()
  .get(
    "/",
    zValidator("query", listPortfoliosQuerySchema),
    async (c) => {
      const { userId } = c.req.valid("query");
      let stmt;
      if (userId) {
        stmt = c.env.DB.prepare(
          "SELECT id, user_id, name, base_currency FROM portfolios WHERE user_id = ? ORDER BY name"
        ).bind(userId);
      } else {
        stmt = c.env.DB.prepare(
          "SELECT id, user_id, name, base_currency FROM portfolios ORDER BY name"
        );
      }
      const { results } = await stmt.all();
      return c.json({ portfolios: results });
    }
  )
  .get(
    "/:id{" + uuidRegex.source + "}",
    zValidator("param", portfolioIdParamSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const row = await c.env.DB.prepare(
        "SELECT id, user_id, name, base_currency FROM portfolios WHERE id = ?"
      )
        .bind(id)
        .first();
      if (!row) throw new HTTPException(404, { message: "Portfolio not found" });
      return c.json(row);
    }
  )
  .post("/", zValidator("json", createPortfolioSchema), async (c) => {
    const body = c.req.valid("json");
    const userRow = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?")
      .bind(body.userId)
      .first();
    if (!userRow) throw new HTTPException(400, { message: "User not found" });
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO portfolios (id, user_id, name, base_currency) VALUES (?, ?, ?, ?)"
    )
      .bind(id, body.userId, body.name, body.baseCurrency)
      .run();
    const row = await c.env.DB.prepare(
      "SELECT id, user_id, name, base_currency FROM portfolios WHERE id = ?"
    )
      .bind(id)
      .first();
    return c.json(row!, 201);
  });
