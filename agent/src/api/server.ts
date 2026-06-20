import express from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { getRecentTrades, getPnlHistory, getRecentSignals, getRecentAgentRuns, getRecentPositions, setMeta, clearPnlSnapshots } from '../db/queries';

export type AgentState = {
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  portfolioUsd: number;
  bnbUsd: number;
  tokenUsd: number;
  bnbBalance: number;
  holdings: { symbol: string; amount: number; valueUsd: number }[];
  startingUsd: number;
  pnlPct: number;
  drawdownPct: number;
  lastUpdated: number;
};

let agentState: AgentState = {
  status: 'STOPPED',
  portfolioUsd: 0,
  bnbUsd: 0,
  tokenUsd: 0,
  bnbBalance: 0,
  holdings: [],
  startingUsd: 0,
  pnlPct: 0,
  drawdownPct: 0,
  lastUpdated: Date.now(),
};

const clients = new Set<WebSocket>();

// Live unrealized PnL per open position id, refreshed by the 5-min snapshot.
let positionsPnl: Record<number, { currentPriceUsd: number; unrealizedPnlPct: number }> = {};
export function setPositionsPnl(map: typeof positionsPnl) {
  positionsPnl = map;
}

export function updateAgentState(patch: Partial<AgentState>) {
  agentState = { ...agentState, ...patch, lastUpdated: Date.now() };
  broadcast({ type: 'state', data: agentState });
}

export function broadcast(msg: object) {
  const payload = JSON.stringify(msg);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

export function createServer(port: number) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/state', (_req, res) => {
    res.json(agentState);
  });

  app.get('/api/trades', async (_req, res) => {
    res.json(await getRecentTrades(50));
  });

  app.get('/api/pnl', async (_req, res) => {
    res.json(await getPnlHistory(2016)); // ~7 days at 5-min snapshots
  });

  app.get('/api/signals', async (_req, res) => {
    res.json(await getRecentSignals(20));
  });

  app.get('/api/runs', async (_req, res) => {
    const runs = (await getRecentAgentRuns(50)).map(r => ({
      ...r,
      analyst_brief: r.analyst_brief ? JSON.parse(r.analyst_brief) : null,
    }));
    res.json(runs);
  });

  // Reset the PnL baseline to current net worth — call after a deposit/withdrawal
  // so external capital flows don't read as profit. Clears the old PnL chart.
  app.post('/api/rebaseline', async (_req, res) => {
    const usd = agentState.portfolioUsd;
    await setMeta('starting_usd', String(usd));
    await setMeta('peak_usd', String(usd));
    await clearPnlSnapshots();
    updateAgentState({ startingUsd: usd, pnlPct: 0, drawdownPct: 0 });
    console.log(`[api] re-baselined to $${usd.toFixed(2)}`);
    res.json({ ok: true, startingUsd: usd });
  });

  app.get('/api/positions', async (_req, res) => {
    const rows = await getRecentPositions(50);
    // Enrich OPEN positions with live price + unrealized PnL from the latest snapshot.
    res.json(rows.map(p => {
      if (p.status !== 'OPEN') return p;
      const live = positionsPnl[p.id];
      return live
        ? { ...p, current_price_usd: live.currentPriceUsd, unrealized_pnl_pct: live.unrealizedPnlPct }
        : p;
    }));
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'state', data: agentState }));
    ws.on('close', () => clients.delete(ws));
  });

  server.listen(port, () => {
    console.log(`[api] listening on http://localhost:${port}`);
  });

  return server;
}
