import 'dotenv/config';
import cron from 'node-cron';
import { createServer, updateAgentState } from './api/server';
import { runOrchestrator } from './agents/orchestrator';
import { insertPnlSnapshot } from './db/queries';
import { initDb } from './db/schema';
import { getWalletBalance } from './execution';
import { maxSpendableBnb, GAS_RESERVE_USD_VALUE, getDailyTradeCount } from './guardrails';

const PORT = parseInt(process.env.PORT ?? '3001');
const TRADE_PCT = parseFloat(process.env.TRADE_PCT ?? '0.10'); // 10% of BNB balance per trade
// Daily-minimum safety: the competition needs ≥1 trade/day. If none by this UTC
// hour, force a qualifying run (bypasses window + confidence gates).
const DAILY_MIN_CUTOFF_HOUR = parseInt(process.env.DAILY_MIN_CUTOFF_HOUR ?? '22');

let agentState = {
  portfolioUsd: 0,
  bnbBalance: 0,
  bnbUsd: 0,
  startingUsd: 0,
  peakUsd: 0,
  drawdownPct: 0,
  pnlPct: 0,
};

async function tick(force = false) {
  console.log(`\n[agent] ── tick ${new Date().toISOString()}${force ? ' (forced)' : ''} ──`);
  // Size from 10% of balance, but never spend into the BNB gas reserve.
  const spendable = maxSpendableBnb(agentState.bnbBalance, agentState.bnbUsd);
  const maxTradeBnb = parseFloat(Math.min(agentState.bnbBalance * TRADE_PCT, spendable).toFixed(4));
  console.log(`[agent] BNB balance: ${agentState.bnbBalance} ($${agentState.bnbUsd.toFixed(2)}) | reserve: $${GAS_RESERVE_USD_VALUE.toFixed(2)} | max trade: ${maxTradeBnb} BNB`);
  await runOrchestrator({
    portfolioUsd: agentState.portfolioUsd,
    bnbBalance: agentState.bnbBalance,
    bnbUsd: agentState.bnbUsd,
    maxTradeBnb,
    drawdownPct: agentState.drawdownPct,
  }, { force });
}

// If no trade has executed this UTC day by the cutoff, force one to satisfy the
// competition's ≥1-trade-per-day qualification rule.
async function dailyMinCheck() {
  if (getDailyTradeCount() > 0) return;
  console.log('[agent] no trades yet today — forcing a qualifying trade (daily minimum)');
  await tick(true);
}

async function pnlSnapshot() {
  const { bnb: bnbBalance, totalUsd: portfolioUsd, bnbUsd, tokenUsd, holdings } = await getWalletBalance();

  if (agentState.startingUsd === 0) {
    agentState.startingUsd = portfolioUsd;
    agentState.peakUsd = portfolioUsd;
    console.log(`[agent] starting portfolio value: $${portfolioUsd.toFixed(2)}`);
  }

  const pnlPct = agentState.startingUsd > 0
    ? (portfolioUsd - agentState.startingUsd) / agentState.startingUsd
    : 0;

  const peakUsd = Math.max(agentState.peakUsd, portfolioUsd);
  const drawdownPct = peakUsd > 0 && portfolioUsd < peakUsd
    ? (peakUsd - portfolioUsd) / peakUsd
    : 0;

  agentState = { ...agentState, portfolioUsd, bnbBalance, bnbUsd, pnlPct, peakUsd, drawdownPct };

  await insertPnlSnapshot({ timestamp: Date.now(), portfolio_usd: portfolioUsd, pnl_pct: pnlPct, drawdown_pct: drawdownPct });
  updateAgentState({
    status: 'RUNNING', portfolioUsd, bnbUsd, tokenUsd, bnbBalance, holdings,
    startingUsd: agentState.startingUsd, pnlPct, drawdownPct,
  });

  console.log(`[agent] snapshot: ${bnbBalance.toFixed(4)} BNB | $${portfolioUsd.toFixed(2)} | pnl=${(pnlPct * 100).toFixed(2)}% | dd=${(drawdownPct * 100).toFixed(2)}%`);
}

async function main() {
  await initDb();
  createServer(PORT);
  updateAgentState({ status: 'RUNNING' });
  console.log('[agent] starting — 3-agent pipeline, tick every 15 min (LLM pipeline gated to trading windows)');

  await pnlSnapshot();
  await tick();

  cron.schedule('*/15 * * * *', () => tick());
  cron.schedule('0 * * * *', pnlSnapshot);
  // Daily-minimum safety: at the cutoff hour, and again 90 min later as a retry.
  cron.schedule(`0 ${DAILY_MIN_CUTOFF_HOUR} * * *`, dailyMinCheck);
  cron.schedule(`30 ${(DAILY_MIN_CUTOFF_HOUR + 1) % 24} * * *`, dailyMinCheck);
}

main().catch(err => {
  console.error('[agent] fatal:', err);
  process.exit(1);
});
