import { runAnalyst } from './analyst';
import { runPortfolioManager, OpenPositionSummary } from './portfolioManager';
import { runRiskOfficer } from './riskOfficer';
import { evaluateExits, getOpenPositionsWithPnl } from './exitManager';
import { AgentRunResult, MarketBrief, TradeProposal } from './types';
import { executeTrade } from '../execution';
import {
  insertTrade, updateTradeStatus, insertSignalLog, insertAgentRun,
  openPosition, closePosition, getOpenPositionByToken,
} from '../db/queries';
import { recordTrade, getDailyTradeCount, checkTradingWindow, isInTradingWindow, checkGasReserve } from '../guardrails';
import { getTokenPrices } from '../signals/cmc';
import { isTradeable, TRADEABLE_TOKENS } from '../execution/tokens';
import { broadcast, updateAgentState } from '../api/server';

const REQUIRE_HIGH_CONFIDENCE = (process.env.REQUIRE_HIGH_CONFIDENCE ?? 'true') === 'true';

// Conviction sizing: size a BUY by the PM's confidence instead of a hard HIGH-only
// gate. HIGH → full size, MEDIUM → reduced, LOW → skipped (0). When enabled this
// supersedes REQUIRE_HIGH_CONFIDENCE. Disable to revert to strict HIGH-only.
const CONVICTION_SIZING = (process.env.CONVICTION_SIZING ?? 'true') === 'true';
const CONF_MEDIUM_MULT  = parseFloat(process.env.CONF_MEDIUM_MULT ?? '0.5');
const CONF_LOW_MULT     = parseFloat(process.env.CONF_LOW_MULT ?? '0');
// Default token for a forced daily-minimum trade when the PM proposes HOLD.
const DAILY_MIN_TOKEN   = (process.env.DAILY_MIN_TOKEN ?? 'ETH').toUpperCase();

function confidenceMult(confidence: string): number {
  if (confidence === 'HIGH') return 1;
  if (confidence === 'MEDIUM') return CONF_MEDIUM_MULT;
  return CONF_LOW_MULT;
}

// ── Small helpers to keep persistence + broadcast in one place ──────────────

async function recordRun(r: {
  action: string;
  token: string;
  marketBrief: MarketBrief | null;
  pmReasoning: string | null;
  riskReasoning: string | null;
  tradeId: number | null;
}) {
  const ts = Date.now();
  const id = await insertAgentRun({
    timestamp: ts,
    action: r.action,
    token: r.token,
    analyst_brief: r.marketBrief ? JSON.stringify(r.marketBrief) : null,
    pm_reasoning: r.pmReasoning,
    risk_reasoning: r.riskReasoning,
    trade_id: r.tradeId,
  });
  broadcast({
    type: 'run',
    data: {
      id, timestamp: ts, action: r.action, token: r.token,
      analyst_brief: r.marketBrief, pm_reasoning: r.pmReasoning,
      risk_reasoning: r.riskReasoning, trade_id: r.tradeId,
    },
  });
  return id;
}

async function recordTradeRow(t: {
  token: string;
  side: 'BUY' | 'SELL';
  amountBnb: number;
  signal: string;
  marketBrief: MarketBrief | null;
  pmReasoning: string | null;
  riskReasoning: string | null;
}): Promise<number> {
  return insertTrade({
    timestamp: Date.now(),
    token: t.token,
    side: t.side,
    amount_bnb: t.amountBnb,
    price_usd: 0,
    tx_hash: null,
    signal: t.signal,
    status: 'PENDING',
    analyst_brief: t.marketBrief?.summary ?? null,
    pm_reasoning: t.pmReasoning,
    risk_reasoning: t.riskReasoning,
  });
}

function broadcastTrade(tradeId: number, token: string, side: string, amountBnb: number, txHash: string | null, status: string, signal: string) {
  broadcast({
    type: 'trade',
    data: {
      id: tradeId, timestamp: Date.now(), token, side,
      amount_bnb: amountBnb, price_usd: 0, tx_hash: txHash, signal, status,
    },
  });
}

// Fetch token + BNB price to compute how many tokens a BNB amount buys.
async function entryPricing(token: string, bnbSpent: number): Promise<{ tokenPriceUsd: number; amountToken: number } | null> {
  try {
    const quotes = await getTokenPrices([token.toUpperCase(), 'BNB']);
    const map = Object.fromEntries(quotes.map(q => [q.symbol.toUpperCase(), q.price_usd]));
    const tokenPriceUsd = map[token.toUpperCase()];
    const bnbPriceUsd = map['BNB'];
    if (!tokenPriceUsd || !bnbPriceUsd) return null;
    const amountToken = (bnbSpent * bnbPriceUsd) / tokenPriceUsd;
    return { tokenPriceUsd, amountToken };
  } catch (err) {
    console.error('[orchestrator] entry pricing failed:', err);
    return null;
  }
}

// ── PHASE 0: deterministic exit management (runs every tick, ignores window) ──

async function processExits() {
  let exits;
  try {
    exits = await evaluateExits(Date.now());
  } catch (err) {
    console.error('[orchestrator] exit evaluation failed:', err);
    return;
  }
  if (exits.length === 0) return;

  for (const exit of exits) {
    const pos = exit.position;
    const pnlStr = `${exit.pnlPct >= 0 ? '+' : ''}${(exit.pnlPct * 100).toFixed(2)}%`;
    const reasonText = `${exit.reason} hit on ${pos.token}: ${pnlStr} (entry $${pos.entry_price_usd.toPrecision(4)} → $${exit.currentPrice.toPrecision(4)})`;
    console.log(`[orchestrator] EXIT ${reasonText}`);

    const signal = `[Exit] ${reasonText}`;
    const tradeId = await recordTradeRow({
      token: pos.token, side: 'SELL', amountBnb: pos.amount_token,
      signal, marketBrief: null, pmReasoning: 'Automated exit (TP/SL/time-stop)',
      riskReasoning: reasonText,
    });

    const result = await executeTrade({
      token: pos.token, side: 'SELL', amountBnb: pos.amount_token, signal,
    });

    await updateTradeStatus(tradeId, result.status, result.txHash ?? undefined);
    recordTrade();

    await closePosition(pos.id, {
      closed_at: Date.now(),
      exit_price_usd: exit.currentPrice,
      exit_reason: exit.reason,
      realized_pnl_pct: exit.pnlPct,
      close_trade_id: tradeId,
    });

    await recordRun({
      action: exit.reason, token: pos.token, marketBrief: null,
      pmReasoning: 'Automated exit (TP/SL/time-stop)', riskReasoning: reasonText,
      tradeId,
    });
    broadcastTrade(tradeId, pos.token, 'SELL', pos.amount_token, result.txHash, result.status, signal);
  }
}

export async function runOrchestrator(state: {
  portfolioUsd: number;
  bnbBalance: number;
  bnbUsd: number;
  maxTradeBnb: number;
  drawdownPct: number;
}, opts: { force?: boolean } = {}): Promise<AgentRunResult | null> {
  // `force` = daily-minimum safety: bypass the window + confidence gates to
  // guarantee the competition's ≥1-trade-per-day requirement.
  const force = !!opts.force;
  console.log(`[orchestrator] starting agent pipeline${force ? ' (FORCED — daily minimum)' : ''}`);

  // ── PHASE 0: Exit management (LLM-free, always runs) ─────────────────────────
  await processExits();

  // ── Window gate: skip the entire LLM pipeline outside trading windows ────────
  // No new entry can open outside a window, so running the Analyst/PM/Risk agents
  // there would burn tokens for nothing. Exits above already ran. (Skipped when forced.)
  if (!force && !isInTradingWindow()) {
    const reason = checkTradingWindow().reason ?? 'Outside trading window';
    console.log(`[orchestrator] ${reason} — skipping LLM pipeline (exits only)`);
    return null;
  }

  // ── Agent 1: Analyst ────────────────────────────────────────────────────────
  console.log('[orchestrator] → Analyst');
  let marketBrief: MarketBrief;
  try {
    marketBrief = await runAnalyst();
  } catch (err) {
    console.error('[orchestrator] Analyst failed:', err);
    return null;
  }
  console.log(`[orchestrator] ← Analyst: regime=${marketBrief.regime} F&G=${marketBrief.fearGreed}`);
  broadcast({ type: 'agent', agent: 'analyst', data: marketBrief });

  const signalTs = Date.now();
  await insertSignalLog({
    timestamp: signalTs,
    fear_greed: marketBrief.fearGreed,
    funding_rate: marketBrief.fundingRate,
    sentiment: marketBrief.sentiment,
    regime: marketBrief.regime,
    action: marketBrief.summary,
  });
  broadcast({
    type: 'signal',
    data: {
      timestamp: signalTs,
      fear_greed: marketBrief.fearGreed,
      sentiment: marketBrief.sentiment,
      regime: marketBrief.regime,
      action: marketBrief.summary,
    },
  });

  // ── Agent 2: Portfolio Manager (position-aware) ──────────────────────────────
  const enriched = await getOpenPositionsWithPnl();
  const openSummaries: OpenPositionSummary[] = enriched.map(e => ({
    token: e.position.token,
    bnbSpent: e.position.bnb_spent,
    entryPriceUsd: e.position.entry_price_usd,
    currentPriceUsd: e.currentPrice,
    unrealizedPnlPct: e.pnlPct,
  }));

  console.log('[orchestrator] → Portfolio Manager');
  let proposal: TradeProposal;
  try {
    proposal = await runPortfolioManager(marketBrief, state.portfolioUsd, state.bnbBalance, state.maxTradeBnb, openSummaries);
  } catch (err) {
    console.error('[orchestrator] Portfolio Manager failed:', err);
    return null;
  }
  console.log(`[orchestrator] ← Portfolio Manager: ${proposal.action} ${proposal.token} ${proposal.amountBnb} BNB (${proposal.confidence})`);
  broadcast({ type: 'agent', agent: 'portfolioManager', data: proposal });

  const holdResult = (reason: string): AgentRunResult => ({
    marketBrief, proposal, riskDecision: { approved: true, finalTrade: proposal, reason },
  });

  if (proposal.action === 'HOLD') {
    // Forced (daily-minimum) run: a HOLD won't satisfy the rule, so substitute a
    // minimal qualifying BUY of the best tradeable token we don't already hold.
    if (force) {
      const held = new Set(openSummaries.map(s => s.token.toUpperCase()));
      const pick = [DAILY_MIN_TOKEN, ...TRADEABLE_TOKENS].find(t => isTradeable(t) && !held.has(t.toUpperCase()));
      if (pick) {
        console.log(`[orchestrator] forced: PM held, substituting minimal qualifying BUY of ${pick}`);
        proposal = {
          action: 'BUY', token: pick, amountBnb: state.maxTradeBnb,
          reasoning: `Daily-minimum qualifying trade (PM proposed HOLD). ${proposal.reasoning}`,
          confidence: 'LOW',
        };
      } else {
        console.warn('[orchestrator] forced: PM held and all tradeable tokens already held — cannot force.');
        await recordRun({ action: 'HOLD', token: '', marketBrief, pmReasoning: proposal.reasoning, riskReasoning: 'Forced run could not find an unheld tradeable token.', tradeId: null });
        return holdResult('HOLD');
      }
    } else {
      console.log('[orchestrator] HOLD — no trade');
      broadcast({ type: 'agent', agent: 'riskOfficer', data: { approved: true, reason: 'HOLD — no trade needed.' } });
      await recordRun({ action: 'HOLD', token: proposal.token || '', marketBrief, pmReasoning: proposal.reasoning, riskReasoning: 'HOLD — no risk check performed.', tradeId: null });
      return holdResult('HOLD');
    }
  }

  // ── Pre-execution gates for NEW entries ──────────────────────────────────────
  const isBuy = proposal.action === 'BUY';

  // Tradeable-universe guard — reject tokens with no executable liquidity before
  // they reach the quote/execution layer (would otherwise throw or 400).
  if (!isTradeable(proposal.token)) {
    const reason = `${proposal.token} is not in the tradeable universe — skipped.`;
    console.log(`[orchestrator] SKIP: ${reason}`);
    await recordRun({ action: 'SKIPPED', token: proposal.token, marketBrief, pmReasoning: proposal.reasoning, riskReasoning: reason, tradeId: null });
    return holdResult(reason);
  }

  // No pyramiding — refuse to add to an existing open position.
  if (isBuy && await getOpenPositionByToken(proposal.token)) {
    const reason = `Already holding ${proposal.token} — no pyramiding.`;
    console.log(`[orchestrator] SKIP: ${reason}`);
    await recordRun({ action: 'SKIPPED', token: proposal.token, marketBrief, pmReasoning: proposal.reasoning, riskReasoning: reason, tradeId: null });
    return holdResult(reason);
  }

  // Gas-reserve gate — never spend BNB needed for BSC gas (BUYs only; SELLs add BNB).
  if (isBuy) {
    const gas = checkGasReserve(state.bnbBalance, state.bnbUsd, proposal.amountBnb);
    if (!gas.allowed) {
      console.log(`[orchestrator] SKIP: ${gas.reason}`);
      await recordRun({ action: 'SKIPPED', token: proposal.token, marketBrief, pmReasoning: proposal.reasoning, riskReasoning: gas.reason ?? 'Gas reserve', tradeId: null });
      return holdResult(gas.reason ?? 'Gas reserve protection');
    }
  }

  // Confidence → BUY size. Conviction sizing scales by confidence; legacy mode is
  // a hard HIGH-only gate. A forced (daily-minimum) run never skips on confidence.
  let sizeMult = 1;
  if (isBuy) {
    if (CONVICTION_SIZING) {
      sizeMult = confidenceMult(proposal.confidence);
      if (sizeMult <= 0) {
        if (!force) {
          const reason = `Confidence ${proposal.confidence} too low — entry skipped.`;
          console.log(`[orchestrator] SKIP: ${reason}`);
          await recordRun({ action: 'SKIPPED', token: proposal.token, marketBrief, pmReasoning: proposal.reasoning, riskReasoning: reason, tradeId: null });
          return holdResult(reason);
        }
        sizeMult = CONF_MEDIUM_MULT || 0.5; // forced: take a minimal qualifying position
      }
    } else if (REQUIRE_HIGH_CONFIDENCE && proposal.confidence !== 'HIGH' && !force) {
      const reason = `Confidence ${proposal.confidence} below HIGH threshold — entry skipped.`;
      console.log(`[orchestrator] SKIP: ${reason}`);
      await recordRun({ action: 'SKIPPED', token: proposal.token, marketBrief, pmReasoning: proposal.reasoning, riskReasoning: reason, tradeId: null });
      return holdResult(reason);
    }
  }

  // (Trading-window gate already enforced at the top of the pipeline.)

  // ── Agent 3: Risk Officer ────────────────────────────────────────────────────
  console.log('[orchestrator] → Risk Officer');
  let riskDecision;
  try {
    riskDecision = await runRiskOfficer(proposal, state.drawdownPct, getDailyTradeCount(), state.maxTradeBnb);
  } catch (err) {
    console.error('[orchestrator] Risk Officer failed:', err);
    return null;
  }
  console.log(`[orchestrator] ← Risk Officer: approved=${riskDecision.approved} reason="${riskDecision.reason}"`);
  broadcast({ type: 'agent', agent: 'riskOfficer', data: riskDecision });

  if (!riskDecision.approved || !riskDecision.finalTrade) {
    console.warn('[orchestrator] trade vetoed:', riskDecision.reason);
    await recordRun({ action: 'VETOED', token: proposal.token, marketBrief, pmReasoning: proposal.reasoning, riskReasoning: riskDecision.reason, tradeId: null });
    return { marketBrief, proposal, riskDecision };
  }

  // ── Execute ──────────────────────────────────────────────────────────────────
  const trade = riskDecision.finalTrade;
  const side = trade.action as 'BUY' | 'SELL';

  // Conviction sizing: scale the BUY by confidence (SELLs close the full position).
  if (side === 'BUY' && sizeMult !== 1) {
    const scaled = Math.min(trade.amountBnb * sizeMult, state.maxTradeBnb);
    console.log(`[orchestrator] conviction sizing (${proposal.confidence}): ${trade.amountBnb} → ${scaled.toFixed(5)} BNB`);
    trade.amountBnb = parseFloat(scaled.toFixed(6));
  }

  const reasoning = `[Analyst] ${marketBrief.summary} | [PM] ${proposal.reasoning} | [Risk] ${riskDecision.reason}`;

  // For a BUY, lock in entry pricing BEFORE executing so we can open the position.
  let pricing: { tokenPriceUsd: number; amountToken: number } | null = null;
  if (side === 'BUY') {
    pricing = await entryPricing(trade.token, trade.amountBnb);
    if (!pricing) {
      const reason = `Could not price ${trade.token} for entry — aborting BUY.`;
      console.warn(`[orchestrator] ${reason}`);
      await recordRun({ action: 'SKIPPED', token: trade.token, marketBrief, pmReasoning: proposal.reasoning, riskReasoning: reason, tradeId: null });
      return { marketBrief, proposal, riskDecision: { ...riskDecision, reason } };
    }
  }

  const tradeId = await recordTradeRow({
    token: trade.token, side, amountBnb: trade.amountBnb, signal: reasoning,
    marketBrief, pmReasoning: proposal.reasoning, riskReasoning: riskDecision.reason,
  });

  // For a SELL closing a held position, sell the tracked token amount.
  const heldPosition = side === 'SELL' ? await getOpenPositionByToken(trade.token) : null;
  const sellAmount = heldPosition ? heldPosition.amount_token : trade.amountBnb;

  const result = await executeTrade({
    token: trade.token, side, amountBnb: side === 'SELL' ? sellAmount : trade.amountBnb, signal: reasoning,
  });

  await updateTradeStatus(tradeId, result.status, result.txHash ?? undefined);
  recordTrade();

  // Position bookkeeping.
  if (result.status === 'CONFIRMED') {
    if (side === 'BUY' && pricing) {
      await openPosition({
        token: trade.token, bnb_spent: trade.amountBnb, amount_token: pricing.amountToken,
        entry_price_usd: pricing.tokenPriceUsd, opened_at: Date.now(), open_trade_id: tradeId,
      });
      console.log(`[orchestrator] opened position: ${trade.token} ${pricing.amountToken.toPrecision(4)} @ $${pricing.tokenPriceUsd.toPrecision(4)}`);
    } else if (side === 'SELL' && heldPosition) {
      const exitPrice = (await entryPricing(trade.token, 0))?.tokenPriceUsd ?? heldPosition.entry_price_usd;
      const pnlPct = (exitPrice - heldPosition.entry_price_usd) / heldPosition.entry_price_usd;
      await closePosition(heldPosition.id, {
        closed_at: Date.now(), exit_price_usd: exitPrice, exit_reason: 'PM_SELL',
        realized_pnl_pct: pnlPct, close_trade_id: tradeId,
      });
      console.log(`[orchestrator] closed position: ${trade.token} pnl=${(pnlPct * 100).toFixed(2)}%`);
    }
  }

  await recordRun({
    action: trade.action, token: trade.token, marketBrief,
    pmReasoning: proposal.reasoning, riskReasoning: riskDecision.reason, tradeId,
  });

  updateAgentState({ portfolioUsd: state.portfolioUsd, drawdownPct: state.drawdownPct });
  broadcastTrade(tradeId, trade.token, trade.action, trade.amountBnb, result.txHash, result.status, reasoning);

  console.log(`[orchestrator] trade ${result.status}: ${trade.action} ${trade.token} tx=${result.txHash}`);
  return { marketBrief, proposal, riskDecision };
}
