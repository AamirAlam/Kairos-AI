import { dbExec, isPg } from './driver';

// Schema is portable except for the auto-increment id type and integer width.
//   SQLite:   INTEGER PRIMARY KEY AUTOINCREMENT
//   Postgres: BIGSERIAL PRIMARY KEY  (+ BIGINT for epoch-ms timestamps)
// CHECK constraints, TEXT, and DOUBLE/REAL all behave the same on both.
function ddl(): string {
  const id = isPg ? 'BIGSERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT';
  const int = isPg ? 'BIGINT' : 'INTEGER';
  const real = isPg ? 'DOUBLE PRECISION' : 'REAL';
  return `
    CREATE TABLE IF NOT EXISTS trades (
      id              ${id},
      timestamp       ${int} NOT NULL,
      token           TEXT NOT NULL,
      side            TEXT NOT NULL CHECK(side IN ('BUY', 'SELL')),
      amount_bnb      ${real} NOT NULL,
      price_usd       ${real} NOT NULL,
      tx_hash         TEXT,
      signal          TEXT,
      status          TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'CONFIRMED', 'FAILED')),
      analyst_brief   TEXT,
      pm_reasoning    TEXT,
      risk_reasoning  TEXT
    );

    CREATE TABLE IF NOT EXISTS pnl_snapshots (
      id              ${id},
      timestamp       ${int} NOT NULL,
      portfolio_usd   ${real} NOT NULL,
      pnl_pct         ${real} NOT NULL,
      drawdown_pct    ${real} NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signal_log (
      id            ${id},
      timestamp     ${int} NOT NULL,
      fear_greed    ${int},
      funding_rate  ${real},
      sentiment     TEXT,
      regime        TEXT NOT NULL,
      action        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_runs (
      id             ${id},
      timestamp      ${int} NOT NULL,
      action         TEXT NOT NULL,
      token          TEXT NOT NULL DEFAULT '',
      analyst_brief  TEXT,
      pm_reasoning   TEXT,
      risk_reasoning TEXT,
      trade_id       ${int} REFERENCES trades(id)
    );

    CREATE TABLE IF NOT EXISTS positions (
      id               ${id},
      token            TEXT NOT NULL,
      bnb_spent        ${real} NOT NULL,
      amount_token     ${real} NOT NULL DEFAULT 0,
      entry_price_usd  ${real} NOT NULL,
      peak_price_usd   ${real} NOT NULL DEFAULT 0,
      opened_at        ${int} NOT NULL,
      status           TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN', 'CLOSED')),
      closed_at        ${int},
      exit_price_usd   ${real},
      exit_reason      TEXT,
      realized_pnl_pct ${real},
      open_trade_id    ${int} REFERENCES trades(id),
      close_trade_id   ${int} REFERENCES trades(id)
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `;
}

let _initialized = false;

export async function initDb(): Promise<void> {
  if (_initialized) return;
  await dbExec(ddl());

  // Non-destructive backfill for older local SQLite databases (pre-reasoning cols).
  if (!isPg) {
    for (const col of ['analyst_brief', 'pm_reasoning', 'risk_reasoning']) {
      try { await dbExec(`ALTER TABLE trades ADD COLUMN ${col} TEXT`); } catch { /* already exists */ }
    }
  }

  // Additive: trailing-stop peak tracking (works on both backends; idempotent).
  const realT = isPg ? 'DOUBLE PRECISION' : 'REAL';
  try {
    await dbExec(`ALTER TABLE positions ADD COLUMN ${isPg ? 'IF NOT EXISTS ' : ''}peak_price_usd ${realT} NOT NULL DEFAULT 0`);
  } catch { /* already exists (sqlite) */ }
  // Seed any existing rows so peak >= entry.
  await dbExec(`UPDATE positions SET peak_price_usd = entry_price_usd WHERE peak_price_usd = 0 OR peak_price_usd < entry_price_usd`);

  _initialized = true;
  console.log(`[db] ready (${isPg ? 'postgres' : 'sqlite'})`);
}

export type Trade = {
  id: number;
  timestamp: number;
  token: string;
  side: 'BUY' | 'SELL';
  amount_bnb: number;
  price_usd: number;
  tx_hash: string | null;
  signal: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
  analyst_brief: string | null;
  pm_reasoning: string | null;
  risk_reasoning: string | null;
};

export type PnlSnapshot = {
  id: number;
  timestamp: number;
  portfolio_usd: number;
  pnl_pct: number;
  drawdown_pct: number;
};

export type SignalLog = {
  id: number;
  timestamp: number;
  fear_greed: number | null;
  funding_rate: number | null;
  sentiment: string | null;
  regime: string;
  action: string;
};

export type AgentRun = {
  id: number;
  timestamp: number;
  action: string;
  token: string;
  analyst_brief: string | null;
  pm_reasoning: string | null;
  risk_reasoning: string | null;
  trade_id: number | null;
};

export type Position = {
  id: number;
  token: string;
  bnb_spent: number;
  amount_token: number;
  entry_price_usd: number;
  peak_price_usd: number;
  opened_at: number;
  status: 'OPEN' | 'CLOSED';
  closed_at: number | null;
  exit_price_usd: number | null;
  exit_reason: string | null;
  realized_pnl_pct: number | null;
  open_trade_id: number | null;
  close_trade_id: number | null;
};
