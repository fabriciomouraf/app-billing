# app-billing

Aplicação pessoal para **controle de gastos** e **observabilidade de investimentos**. Permite cadastrar usuários, portfólios, caixinhas de investimento (buckets), posições atuais, snapshots de valorização, transações (aportes/retiradas) e resumos mensais. Inclui cálculo de **rendimento (PnL)** por bucket em um período: valor final − valor inicial − aportes líquidos.

**Exemplo:** bucket STOCKS com valor anterior 3000, valor atual 3300 e aporte de 400 no período → rendimento = 3300 − 3000 − 400 = **−100** (prejuízo de 100).

## Stack

- **Backend:** [Hono](https://hono.dev) em [Cloudflare Workers](https://workers.cloudflare.com)
- **Banco:** [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **CLI / Migrations / Deploy:** [Wrangler](https://developers.cloudflare.com/workers/wrangler/)

## Pré-requisitos

- Node.js 18+
- Conta Cloudflare (para deploy e D1 remoto)

## Setup

```bash
npm install
```

1. **Criar banco D1** (uma vez, para uso remoto):

   ```bash
   npx wrangler d1 create app-billing-db
   ```

   Copie o `database_id` retornado e atualize em [wrangler.toml](wrangler.toml) na seção `[[d1_databases]]`:

   ```toml
   database_id = "seu-database-id-aqui"
   ```

2. **Variáveis locais (opcional):** se precisar de variáveis de ambiente em dev, crie `.dev.vars` (não versionado). Exemplo:

   ```
   # .dev.vars (opcional)
   # KEY=value
   ```

## Comandos

| Comando | Descrição |
|--------|------------|
| `npm run dev` | Sobe o Worker em modo desenvolvimento (D1 local) |
| `npm run build` | Dry-run do deploy (gera saída em `dist/`) |
| `npm run deploy` | Publica o Worker na Cloudflare |
| `npm run db:migrate:local` | Aplica migrations no D1 **local** |
| `npm run db:migrate:remote` | Aplica migrations no D1 **remoto** |
| `npm run db:generate <nome>` | Cria uma nova migration (ex.: `npm run db:generate add_foo`) |

Para criar uma nova migration manualmente, adicione um arquivo em `migrations/` no formato `XXXX_descricao.sql` (ex.: `0001_add_index.sql`).

## Estrutura do projeto

```
app-billing/
  src/
    index.ts           # App Hono, onError, notFound, export default
    lib/
      db.ts            # Tipo Bindings (D1)
      env.ts           # Tipo Env
      fx.ts            # Helpers conversão BRL (getFxRate, amountToBRL, toBRL)
    routes/
      index.ts         # Monta rotas em /api
      users.ts         # /api/users
      portfolios.ts    # /api/portfolios
      buckets.ts       # /api/portfolios/:portfolioId/buckets
      positions.ts     # .../buckets/:bucketId/position
      snapshots.ts     # .../buckets/:bucketId/snapshots
      transactions.ts  # /api/portfolios/:portfolioId/transactions
      fx-rates.ts      # /api/fx-rates
      summaries.ts     # /api/portfolios/:portfolioId/summaries
      pnl.ts           # .../buckets/:bucketId/pnl?from=&to=
    schemas/           # Zod (request/response)
    services/
      pnl.ts           # Cálculo de rendimento por período
  migrations/          # SQL para D1
  wrangler.toml
  package.json
  tsconfig.json
```

## Modelo de dados

O desenho está em [diagram.md](diagram.md) (PlantUML). Resumo:

| Entidade | Descrição |
|----------|-----------|
| **User** | Usuário (id, name, email) |
| **Portfolio** | Portfólio do usuário (baseCurrency: BRL/USD) |
| **InvestmentBucket** | Caixinha (tipo: FIXED_INCOME, US_STOCKS, BITCOIN, OTHER) |
| **BucketPosition** | Valor atual e investido (1 por bucket) |
| **BucketValuationSnapshot** | Foto do valor total do bucket em uma data |
| **Transaction** | Aporte, retirada, rendimento, taxa, imposto, ajuste |
| **FxRateSnapshot** | Câmbio (from/to, rate) em uma data |
| **MonthlySummary** | Resumo mensal do portfólio (startValueBRL, endValueBRL, netContributionBRL, pnlBRL, pnlAccumulatedBRL) |

Relações: User → Portfolios; Portfolio → Buckets, Transactions, MonthlySummaries; Bucket → Position (0..1), Snapshots; Transaction → Bucket.

**Fluxo Snapshot e Position:**
- **POST snapshot** → atualiza position: `current_value` e `updated_at` passam a refletir o valor do snapshot.
- **POST transaction** (CONTRIBUTION ou WITHDRAWAL) → atualiza position: `invested_value_brl` aumenta (aporte) ou diminui (retirada) pelo valor em BRL.
- Snapshot = foto do valor de mercado na data. Position = valor atual (`current_value` dos snapshots) e custo (`invested_value_brl` das transactions).

Valores monetários no banco estão em **centavos** (INTEGER). Datas em `YYYY-MM-DD`; mês em `YYYY-MM`.

## API

Base: `/api`. Respostas 4xx via `HTTPException`; 404 = `{ "error": "Not Found" }`; validação 400 com `issues` do Zod.

| Método | Path | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check (sem D1) |
| GET | `/api/users` | Lista usuários |
| GET | `/api/users/:id` | Usuário por ID (UUID) |
| POST | `/api/users` | Cria usuário (body: name, email) |
| GET | `/api/portfolios?userId=` | Lista portfólios (opcional por userId) |
| GET | `/api/portfolios/:id` | Portfólio por ID |
| POST | `/api/portfolios` | Cria portfólio (body: name, baseCurrency, userId) |
| GET | `/api/portfolios/:portfolioId/buckets` | Lista buckets |
| POST | `/api/portfolios/:portfolioId/buckets` | Cria bucket (body: type, name, referenceCurrency, active) |
| GET | `/api/portfolios/:portfolioId/buckets/:bucketId` | Bucket por ID |
| PATCH | `/api/portfolios/:portfolioId/buckets/:bucketId` | Atualiza bucket (name, active) |
| GET | `/api/portfolios/:portfolioId/buckets/:bucketId/position` | Posição atual do bucket |
| PUT | `/api/portfolios/:portfolioId/buckets/:bucketId/position` | Upsert position (currentValue, investedValueBRL, updatedAt) |
| GET | `/api/portfolios/:portfolioId/buckets/:bucketId/snapshots?from=&to=` | Snapshots do bucket |
| POST | `/api/portfolios/:portfolioId/buckets/:bucketId/snapshots` | Cria snapshot (date, totalValue, currency, source) |
| GET | `/api/portfolios/:portfolioId/buckets/:bucketId/pnl?from=&to=` | **Rendimento** no período (pnl, startValue, endValue, netContributions) |
| GET | `/api/portfolios/:portfolioId/transactions` | Lista transações |
| POST | `/api/portfolios/:portfolioId/transactions` | Cria transação (bucketId, date, type, amount, currency, fxRateToBRL?, description) |
| GET | `/api/fx-rates?date=&from=&to=` | Lista câmbios (filtros opcionais) |
| POST | `/api/fx-rates` | Cria fx rate (date, from, to, rate, source) |
| GET | `/api/portfolios/:portfolioId/summaries?month=` | Lista resumos ou um por mês; **se `month` for informado, sempre recalcula a partir dos dados atuais, salva e retorna** |
| POST | `/api/portfolios/:portfolioId/summaries` | Cria resumo mensal manual (month, startValueBRL, endValueBRL, netContributionBRL, pnlBRL, pnlAccumulatedBRL) |

**Exemplo de cálculo de rendimento:**  
`GET /api/portfolios/:portfolioId/buckets/:bucketId/pnl?from=2024-01-01&to=2024-01-31` retorna algo como:

```json
{
  "pnl": -100,
  "startValue": 300000,
  "endValue": 330000,
  "netContributions": 40000
}
```

(valores em centavos: 3000 → 300000, 3300 → 330000, 400 → 40000; pnl = 330000 − 300000 − 40000 = −10000 centavos = −100)

## Convenções

- **Validação:** Zod com `zValidator('json'|'query'|'param', schema)` no handler; uso de `c.req.valid()`.
- **Erros client:** `HTTPException` (400, 404, etc.); erros inesperados em `onError` (500).
- **Bindings:** D1 exposto como `c.env.DB` (tipo em `src/lib/db.ts`).
- **IDs:** UUID; rotas com regex quando desejado; params validados com Zod.
- **Sub-apps:** um Hono por domínio (users, portfolios, buckets, etc.) montados em `/api`.

## Autenticação

Não implementada neste escopo. Para produção, considere adicionar autenticação (ex.: JWT com `bearerAuth` do Hono ou Cloudflare Workers Auth) e validar usuário em rotas sensíveis.
