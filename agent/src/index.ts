import 'dotenv/config';
import cron from 'node-cron';
import { createServer, updateAgentState, setPositionsPnl } from './api/server';
import { runOrchestrator } from './agents/orchestrator';
import { getOpenPositionsWithPnl } from './agents/exitManager';
import { insertPnlSnapshot, getMeta, setMeta } from './db/queries';
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

  // Baseline (cost basis) persists in the DB so restarts/redeploys don't reset PnL,
  // and deposits/withdrawals don't show up as profit. Re-baseline via /api/rebaseline.
  let startingUsd = parseFloat((await getMeta('starting_usd')) ?? '0');
  if (!startingUsd) {
    startingUsd = portfolioUsd;
    await setMeta('starting_usd', String(startingUsd));
    console.log(`[agent] baseline initialised at $${startingUsd.toFixed(2)}`);
  }

  let peakUsd = Math.max(parseFloat((await getMeta('peak_usd')) ?? '0'), startingUsd, portfolioUsd);
  await setMeta('peak_usd', String(peakUsd));

  const pnlPct = startingUsd > 0 ? (portfolioUsd - startingUsd) / startingUsd : 0;
  const drawdownPct = peakUsd > 0 && portfolioUsd < peakUsd ? (peakUsd - portfolioUsd) / peakUsd : 0;

  agentState = { ...agentState, portfolioUsd, bnbBalance, bnbUsd, startingUsd, pnlPct, peakUsd, drawdownPct };

  await insertPnlSnapshot({ timestamp: Date.now(), portfolio_usd: portfolioUsd, pnl_pct: pnlPct, drawdown_pct: drawdownPct });
  updateAgentState({
    status: 'RUNNING', portfolioUsd, bnbUsd, tokenUsd, bnbBalance, holdings,
    startingUsd: agentState.startingUsd, pnlPct, drawdownPct,
  });

  // Live per-position unrealized PnL (LLM-free — just a price fetch). Cached for /api/positions.
  try {
    const open = await getOpenPositionsWithPnl();
    setPositionsPnl(Object.fromEntries(
      open.map(o => [o.position.id, { currentPriceUsd: o.currentPrice, unrealizedPnlPct: o.pnlPct }]),
    ));
  } catch (err) {
    console.error('[agent] unrealized PnL update failed:', err);
  }

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
  cron.schedule('*/5 * * * *', pnlSnapshot); // portfolio + unrealized PnL refresh (no LLM)
  // Daily-minimum safety: at the cutoff hour, and again 90 min later as a retry.
  cron.schedule(`0 ${DAILY_MIN_CUTOFF_HOUR} * * *`, dailyMinCheck);
  cron.schedule(`30 ${(DAILY_MIN_CUTOFF_HOUR + 1) % 24} * * *`, dailyMinCheck);
}

main().catch(err => {
  console.error('[agent] fatal:', err);
  process.exit(1);
});
