import { Hono } from "hono";
import type { Env } from "../lib/env.js";
import { usersRoutes } from "./users.js";
import { portfoliosRoutes } from "./portfolios.js";
import { bucketsRoutes } from "./buckets.js";
import { positionsRoutes } from "./positions.js";
import { snapshotsRoutes } from "./snapshots.js";
import { transactionsRoutes } from "./transactions.js";
import { fxRatesRoutes } from "./fx-rates.js";
import { summariesRoutes } from "./summaries.js";
import { pnlRoutes } from "./pnl.js";

const api = new Hono<Env>()
  .get("/health", (c) => c.json({ ok: true }))
  .route("/users", usersRoutes)
  .route("/portfolios", portfoliosRoutes)
  .route("/portfolios/:portfolioId/buckets", bucketsRoutes)
  .route("/portfolios/:portfolioId/buckets/:bucketId/position", positionsRoutes)
  .route("/portfolios/:portfolioId/buckets/:bucketId/snapshots", snapshotsRoutes)
  .route("/portfolios/:portfolioId/buckets/:bucketId/pnl", pnlRoutes)
  .route("/portfolios/:portfolioId/transactions", transactionsRoutes)
  .route("/fx-rates", fxRatesRoutes)
  .route("/portfolios/:portfolioId/summaries", summariesRoutes);

export { api };
