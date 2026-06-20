import { Trade, PnlSnapshot, SignalLog, AgentRun, Position } from './schema';
import { dbAll, dbGet, dbRun, dbInsert } from './driver';

export async function insertTrade(trade: Omit<Trade, 'id'>): Promise<number> {
  return dbInsert(
    `INSERT INTO trades
       (timestamp, token, side, amount_bnb, price_usd, tx_hash, signal, status,
        analyst_brief, pm_reasoning, risk_reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      trade.timestamp, trade.token, trade.side,
      trade.amount_bnb, trade.price_usd, trade.tx_hash,
      trade.signal, trade.status,
      trade.analyst_brief ?? null, trade.pm_reasoning ?? null, trade.risk_reasoning ?? null,
    ],
  );
}

export async function updateTradeStatus(id: number, status: Trade['status'], tx_hash?: string): Promise<void> {
  await dbRun(
    `UPDATE trades SET status = ?, tx_hash = COALESCE(?, tx_hash) WHERE id = ?`,
    [status, tx_hash ?? null, id],
  );
}

export async function getRecentTrades(limit = 50): Promise<Trade[]> {
  return dbAll<Trade>(`SELECT * FROM trades ORDER BY timestamp DESC LIMIT ?`, [limit]);
}

export async function insertPnlSnapshot(snap: Omit<PnlSnapshot, 'id'>): Promise<void> {
  await dbRun(
    `INSERT INTO pnl_snapshots (timestamp, portfolio_usd, pnl_pct, drawdown_pct) VALUES (?, ?, ?, ?)`,
    [snap.timestamp, snap.portfolio_usd, snap.pnl_pct, snap.drawdown_pct],
  );
}

export async function getPnlHistory(limit = 168): Promise<PnlSnapshot[]> {
  return dbAll<PnlSnapshot>(`SELECT * FROM pnl_snapshots ORDER BY timestamp DESC LIMIT ?`, [limit]);
}

export async function clearPnlSnapshots(): Promise<void> {
  await dbRun(`DELETE FROM pnl_snapshots`);
}

// ── Meta (key/value) — persists the PnL baseline across restarts ─────────────

export async function getMeta(key: string): Promise<string | null> {
  const row = await dbGet<{ value: string }>(`SELECT value FROM meta WHERE key = ?`, [key]);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await dbRun(
    `INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function insertSignalLog(log: Omit<SignalLog, 'id'>): Promise<void> {
  await dbRun(
    `INSERT INTO signal_log (timestamp, fear_greed, funding_rate, sentiment, regime, action)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [log.timestamp, log.fear_greed ?? null, log.funding_rate ?? null, log.sentiment ?? null, log.regime, log.action],
  );
}

export async function getRecentSignals(limit = 20): Promise<SignalLog[]> {
  return dbAll<SignalLog>(`SELECT * FROM signal_log ORDER BY timestamp DESC LIMIT ?`, [limit]);
}

export async function insertAgentRun(run: Omit<AgentRun, 'id'>): Promise<number> {
  return dbInsert(
    `INSERT INTO agent_runs (timestamp, action, token, analyst_brief, pm_reasoning, risk_reasoning, trade_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      run.timestamp, run.action, run.token,
      run.analyst_brief ?? null, run.pm_reasoning ?? null, run.risk_reasoning ?? null,
      run.trade_id ?? null,
    ],
  );
}

export async function getRecentAgentRuns(limit = 20): Promise<AgentRun[]> {
  return dbAll<AgentRun>(`SELECT * FROM agent_runs ORDER BY timestamp DESC LIMIT ?`, [limit]);
}

// ── Positions ──────────────────────────────────────────────────────────────

export async function openPosition(p: {
  token: string;
  bnb_spent: number;
  amount_token: number;
  entry_price_usd: number;
  opened_at: number;
  open_trade_id: number | null;
}): Promise<number> {
  return dbInsert(
    `INSERT INTO positions (token, bnb_spent, amount_token, entry_price_usd, peak_price_usd, opened_at, status, open_trade_id)
     VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
    [p.token.toUpperCase(), p.bnb_spent, p.amount_token, p.entry_price_usd, p.entry_price_usd, p.opened_at, p.open_trade_id ?? null],
  );
}

// Ratchet the high-water mark used by the trailing stop (never decreases).
export async function updatePositionPeak(id: number, price: number): Promise<void> {
  await dbRun(`UPDATE positions SET peak_price_usd = ? WHERE id = ? AND ? > peak_price_usd`, [price, id, price]);
}

export async function closePosition(id: number, c: {
  closed_at: number;
  exit_price_usd: number;
  exit_reason: string;
  realized_pnl_pct: number;
  close_trade_id: number | null;
}): Promise<void> {
  await dbRun(
    `UPDATE positions
       SET status = 'CLOSED', closed_at = ?, exit_price_usd = ?, exit_reason = ?,
           realized_pnl_pct = ?, close_trade_id = ?
     WHERE id = ?`,
    [c.closed_at, c.exit_price_usd, c.exit_reason, c.realized_pnl_pct, c.close_trade_id ?? null, id],
  );
}

export async function getOpenPositions(): Promise<Position[]> {
  return dbAll<Position>(`SELECT * FROM positions WHERE status = 'OPEN' ORDER BY opened_at ASC`);
}

export async function getOpenPositionByToken(token: string): Promise<Position | null> {
  return dbGet<Position>(
    `SELECT * FROM positions WHERE status = 'OPEN' AND token = ? ORDER BY opened_at ASC LIMIT 1`,
    [token.toUpperCase()],
  );
}

export async function getRecentPositions(limit = 50): Promise<Position[]> {
  return dbAll<Position>(`SELECT * FROM positions ORDER BY opened_at DESC LIMIT ?`, [limit]);
}
