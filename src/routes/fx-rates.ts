import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Env } from "../lib/env.js";
import {
  listFxRatesQuerySchema,
  createFxRateSchema,
} from "../schemas/fx-rate.js";

export const fxRatesRoutes = new Hono<Env>()
  .get(
    "/",
    zValidator("query", listFxRatesQuerySchema),
    async (c) => {
      const { date, from, to } = c.req.valid("query");
      let stmt;
      const db = c.env.DB;
      if (date) {
        stmt = db.prepare(
          "SELECT id, date, from_currency, to_currency, rate, source FROM fx_rate_snapshots WHERE date = ? ORDER BY from_currency, to_currency"
        ).bind(date);
      } else if (from && to) {
        stmt = db.prepare(
          "SELECT id, date, from_currency, to_currency, rate, source FROM fx_rate_snapshots WHERE from_currency = ? AND to_currency = ? ORDER BY date DESC"
        ).bind(from, to);
      } else {
        stmt = db.prepare(
          "SELECT id, date, from_currency, to_currency, rate, source FROM fx_rate_snapshots ORDER BY date DESC"
        );
      }
      const { results } = await stmt.all();
      return c.json({ fxRates: results });
    }
  )
  .post("/", zValidator("json", createFxRateSchema), async (c) => {
    const body = c.req.valid("json");
    const id = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO fx_rate_snapshots (id, date, from_currency, to_currency, rate, source) VALUES (?, ?, ?, ?, ?, ?)"
    )
      .bind(id, body.date, body.from, body.to, body.rate, body.source)
      .run();
    const row = await c.env.DB.prepare(
      "SELECT id, date, from_currency, to_currency, rate, source FROM fx_rate_snapshots WHERE id = ?"
    )
      .bind(id)
      .first();
    return c.json(row!, 201);
  });
