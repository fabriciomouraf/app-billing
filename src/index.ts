import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { Env } from "./lib/env.js";
import { api } from "./routes/index.js";

const app = new Hono<Env>();

// CORS: necessário quando o front roda em outro domínio (ex.: Cloudflare Pages)
app.use(
  "/api/*",
  cors({
    origin: (reqOrigin, c) => {
      const allowed =
        c.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ??
        ["http://localhost:3000"];
      if (!reqOrigin) return allowed[0] ?? null;
      return allowed.includes(reqOrigin) ? reqOrigin : null;
    },
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
  })
);

app.route("/api", api);

app.notFound((c) => c.json({ error: "Not Found" }, 404));

app.onError((err, c) => {
  if (err instanceof HTTPException) return err.getResponse();
  console.error("Unexpected error:", err);
  return c.json({ error: "Internal Server Error", message: err.message }, 500);
});

export default app;
