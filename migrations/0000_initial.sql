-- app-billing: schema inicial (enums como TEXT, valores em centavos INTEGER, datas ISO TEXT)

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE portfolios (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  base_currency TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE investment_buckets (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  reference_currency TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
);

CREATE TABLE bucket_positions (
  id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL UNIQUE,
  current_value INTEGER NOT NULL,
  invested_value_brl INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (bucket_id) REFERENCES investment_buckets(id)
);

CREATE TABLE bucket_valuation_snapshots (
  id TEXT PRIMARY KEY,
  bucket_id TEXT NOT NULL,
  date TEXT NOT NULL,
  total_value INTEGER NOT NULL,
  currency TEXT NOT NULL,
  source TEXT NOT NULL,
  FOREIGN KEY (bucket_id) REFERENCES investment_buckets(id)
);

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  bucket_id TEXT NOT NULL,
  date TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  fx_rate_to_brl REAL,
  description TEXT,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id),
  FOREIGN KEY (bucket_id) REFERENCES investment_buckets(id)
);

CREATE TABLE fx_rate_snapshots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate REAL NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE monthly_summaries (
  id TEXT PRIMARY KEY,
  portfolio_id TEXT NOT NULL,
  month TEXT NOT NULL,
  start_value_brl INTEGER NOT NULL,
  end_value_brl INTEGER NOT NULL,
  net_contribution_brl INTEGER NOT NULL,
  income_brl INTEGER NOT NULL,
  fees_and_taxes_brl INTEGER NOT NULL,
  pnl_brl INTEGER NOT NULL,
  pnl_accumulated_brl INTEGER NOT NULL,
  FOREIGN KEY (portfolio_id) REFERENCES portfolios(id)
);

CREATE INDEX idx_portfolios_user_id ON portfolios(user_id);
CREATE INDEX idx_investment_buckets_portfolio_id ON investment_buckets(portfolio_id);
CREATE INDEX idx_bucket_valuation_snapshots_bucket_date ON bucket_valuation_snapshots(bucket_id, date);
CREATE INDEX idx_transactions_portfolio_id ON transactions(portfolio_id);
CREATE INDEX idx_transactions_portfolio_date ON transactions(portfolio_id, date);
CREATE INDEX idx_transactions_bucket_id ON transactions(bucket_id);
CREATE INDEX idx_monthly_summaries_portfolio_id ON monthly_summaries(portfolio_id);
CREATE INDEX idx_fx_rate_snapshots_date ON fx_rate_snapshots(date);
