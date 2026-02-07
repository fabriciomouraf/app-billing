import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "./lib/env.js";
import { api } from "./routes/index.js";

const app = new Hono<Env>().route("/api", api);

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error("Unexpected error:", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});

export default app;
