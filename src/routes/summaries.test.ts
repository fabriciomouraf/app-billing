/**
 * Testes das regras de dashboard/summaries:
 * - Só o mês atual é recalculado (cotação/snapshots afetam só o mês atual).
 * - Meses passados nunca mais são alterados (ficam congelados).
 * - Meses futuros são zerados e persistidos (nunca calculados com dados atuais).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { summariesRoutes } from "./summaries.js";
import { createD1Mock, type SummaryRow } from "../__tests__/helpers/d1-mock.js";
import type { Env } from "../lib/env.js";

const PORTFOLIO_ID = "11111111-1111-4111-8111-111111111111";

function createTestEnv(mock: ReturnType<typeof createD1Mock>): Env {
  return {
    Bindings: {
      DB: mock.DB,
      JWT_SECRET: "test-secret",
      CORS_ORIGINS: "http://localhost:3000",
    },
    Variables: { userId: "user-1" },
  };
}

/** App que monta summaries na mesma rota que em produção para que :portfolioId seja resolvido. */
function summariesApp(env: Env) {
  const app = new Hono<Env>().route("/portfolios/:portfolioId/summaries", summariesRoutes);
  return app;
}

function requestSummaries(env: Env, path: string, init?: RequestInit) {
  const url = `http://localhost/portfolios/${PORTFOLIO_ID}/summaries${path}`;
  return summariesApp(env).request(url, init ?? {}, env.Bindings);
}

describe("summaries – regras de mês atual / passado / futuro", () => {
  const fixedDate = new Date("2026-02-15T12:00:00.000Z"); // mês atual = 2026-02

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedDate);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("GET ?month= (mês específico)", () => {
    it("mês atual (2026-02): recalcula e persiste (computeMonthlySummary chamado)", async () => {
      const computed = { startValueBRL: 10000, endValueBRL: 11000, netContributionBRL: 500, pnlBRL: 500 };
      const mod = await import("../services/summary.js");
      const computeSpy = vi.spyOn(mod, "computeMonthlySummary").mockResolvedValue(computed);

      const mock = createD1Mock({ portfolioId: PORTFOLIO_ID });
      const env = createTestEnv(mock);
      const res = await requestSummaries(env, "?month=2026-02");

      expect(res.status).toBe(200);
      expect(computeSpy).toHaveBeenCalledTimes(1);
      expect(computeSpy).toHaveBeenCalledWith(mock.DB, PORTFOLIO_ID, "2026-02");

      const body = await res.json();
      expect(body.month).toBe("2026-02");
      expect(body.values_brl_real.pnl).toBe(5); // 500 centavos -> 5 BRL
      computeSpy.mockRestore();
    });

    it("mês passado (2026-01): NÃO recalcula; devolve valor já salvo (congelado)", async () => {
      const mod = await import("../services/summary.js");
      const computeSpy = vi.spyOn(mod, "computeMonthlySummary").mockResolvedValue({
        startValueBRL: 0,
        endValueBRL: 0,
        netContributionBRL: 0,
        pnlBRL: 0,
      });

      const existing: SummaryRow = {
        id: "e1111111-1111-4111-8111-111111111111",
        portfolio_id: PORTFOLIO_ID,
        month: "2026-01",
        start_value_brl: 80000,
        end_value_brl: 85000,
        net_contribution_brl: 2000,
        pnl_brl: 3000,
      };
      const mock = createD1Mock({ portfolioId: PORTFOLIO_ID, initialSummaries: [existing] });
      const env = createTestEnv(mock);

      const res = await requestSummaries(env, "?month=2026-01");

      expect(res.status).toBe(200);
      expect(computeSpy).not.toHaveBeenCalled();

      const body = await res.json();
      expect(body.month).toBe("2026-01");
      expect(body.values_brl_real.start_value).toBe(800);
      expect(body.values_brl_real.end_value).toBe(850);
      expect(body.values_brl_real.pnl).toBe(30);

      const stored = mock.getSummary(PORTFOLIO_ID, "2026-01");
      expect(stored?.start_value_brl).toBe(80000);
      expect(stored?.pnl_brl).toBe(3000);
      computeSpy.mockRestore();
    });

    it("mês futuro (2026-03): NÃO recalcula; zera e persiste no banco; resposta zerada", async () => {
      const mod = await import("../services/summary.js");
      const computeSpy = vi.spyOn(mod, "computeMonthlySummary").mockResolvedValue({
        startValueBRL: 0,
        endValueBRL: 0,
        netContributionBRL: 0,
        pnlBRL: 0,
      });

      const mock = createD1Mock({ portfolioId: PORTFOLIO_ID });
      const env = createTestEnv(mock);

      const res = await requestSummaries(env, "?month=2026-03");

      expect(res.status).toBe(200);
      expect(computeSpy).not.toHaveBeenCalled();

      const body = await res.json();
      expect(body.month).toBe("2026-03");
      expect(body.values_brl_real.start_value).toBe(0);
      expect(body.values_brl_real.end_value).toBe(0);
      expect(body.values_brl_real.net_contribution).toBe(0);
      expect(body.values_brl_real.pnl).toBe(0);

      const stored = mock.getSummary(PORTFOLIO_ID, "2026-03");
      expect(stored).not.toBeNull();
      expect(stored?.start_value_brl).toBe(0);
      expect(stored?.end_value_brl).toBe(0);
      expect(stored?.pnl_brl).toBe(0);
      computeSpy.mockRestore();
    });

    it("mês futuro com linha existente (ex.: PnL negativo antigo): sobrescreve com zeros e devolve zerado", async () => {
      const mod = await import("../services/summary.js");
      const computeSpy = vi.spyOn(mod, "computeMonthlySummary").mockResolvedValue({
        startValueBRL: 0,
        endValueBRL: 0,
        netContributionBRL: 0,
        pnlBRL: 0,
      });

      const existing: SummaryRow = {
        id: "f1111111-1111-4111-8111-111111111111",
        portfolio_id: PORTFOLIO_ID,
        month: "2026-03",
        start_value_brl: 100000,
        end_value_brl: 80000,
        net_contribution_brl: 0,
        pnl_brl: -20000,
      };
      const mock = createD1Mock({ portfolioId: PORTFOLIO_ID, initialSummaries: [existing] });
      const env = createTestEnv(mock);

      const res = await requestSummaries(env, "?month=2026-03");

      expect(res.status).toBe(200);
      expect(computeSpy).not.toHaveBeenCalled();

      const body = await res.json();
      expect(body.values_brl_real.pnl).toBe(0);

      const stored = mock.getSummary(PORTFOLIO_ID, "2026-03");
      expect(stored?.pnl_brl).toBe(0);
      expect(stored?.start_value_brl).toBe(0);
      computeSpy.mockRestore();
    });
  });

  describe("GET ?year= (yearly)", () => {
    it("recalcula e persiste apenas o mês atual (2026-02); demais meses não são recalculados", async () => {
      const computed = { startValueBRL: 10000, endValueBRL: 10500, netContributionBRL: 0, pnlBRL: 500 };
      const mod = await import("../services/summary.js");
      const computeSpy = vi.spyOn(mod, "computeMonthlySummary").mockResolvedValue(computed);

      const mock = createD1Mock({ portfolioId: PORTFOLIO_ID });
      const env = createTestEnv(mock);

      const res = await requestSummaries(env, "?year=2026");

      expect(res.status).toBe(200);
      expect(computeSpy).toHaveBeenCalledTimes(1);
      expect(computeSpy).toHaveBeenCalledWith(mock.DB, PORTFOLIO_ID, "2026-02");

      const body = await res.json();
      expect(body.year).toBe(2026);
      expect(body.pnl_accumulated_brl).toBe(500);
      computeSpy.mockRestore();
    });

    it("yearly: soma apenas meses existentes no banco (futuros sem linha = 0 no acumulado)", async () => {
      const computed = { startValueBRL: 10000, endValueBRL: 10500, netContributionBRL: 0, pnlBRL: 500 };
      const mod = await import("../services/summary.js");
      const computeSpy = vi.spyOn(mod, "computeMonthlySummary").mockResolvedValue(computed);

      const jan: SummaryRow = {
        id: "a1111111-1111-4111-8111-111111111111",
        portfolio_id: PORTFOLIO_ID,
        month: "2026-01",
        start_value_brl: 0,
        end_value_brl: 0,
        net_contribution_brl: 0,
        pnl_brl: 1000,
      };
      const mock = createD1Mock({ portfolioId: PORTFOLIO_ID, initialSummaries: [jan] });
      const env = createTestEnv(mock);

      const res = await requestSummaries(env, "?year=2026");

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.year).toBe(2026);
      expect(body.pnl_accumulated_brl).toBe(1000 + 500);
      computeSpy.mockRestore();
    });
  });

  describe("portfolio inexistente", () => {
    it("GET ?month= retorna 404 se portfolio não existe", async () => {
      const mock = createD1Mock({ portfolioId: "99999999-9999-4999-8999-999999999999" });
      const env = createTestEnv(mock);

      const res = await requestSummaries(env, "?month=2026-02");

      expect(res.status).toBe(404);
    });
  });
});
