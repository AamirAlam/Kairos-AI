/**
 * Position exit manager — enforces take-profit and stop-loss on open positions.
 * Runs every tick BEFORE the LLM pipeline so winners are banked and losers are
 * cut deterministically, independent of agent reasoning or trading windows.
 */
import { getOpenPositions, updatePositionPeak } from '../db/queries';
import { getTokenPrices } from '../signals/cmc';
import { Position } from '../db/schema';

const TAKE_PROFIT_PCT = parseFloat(process.env.TAKE_PROFIT_PCT ?? '0.06'); // +6% hard cap (safety)
const STOP_LOSS_PCT   = parseFloat(process.env.STOP_LOSS_PCT   ?? '0.035'); // -3.5% from entry
const MAX_HOLD_HOURS  = parseFloat(process.env.MAX_HOLD_HOURS  ?? '48');    // time stop

// Trailing stop: once a position is up TRAIL_ACTIVATE_PCT, replace the fixed TP
// with a stop that trails TRAIL_PCT below the peak — let winners run, lock gains.
const TRAILING_ENABLED      = (process.env.TRAILING_ENABLED ?? 'true') === 'true';
const TRAIL_ACTIVATE_PCT    = parseFloat(process.env.TRAIL_ACTIVATE_PCT ?? '0.04'); // arm at +4%
const TRAIL_PCT             = parseFloat(process.env.TRAIL_PCT ?? '0.025');          // give back 2.5%

// A single-reading move larger than this (vs the previous reading) is treated as
// a suspect/bad price tick and not acted on until the next reading confirms it.
const PRICE_SANITY_MOVE_PCT = parseFloat(process.env.PRICE_SANITY_MOVE_PCT ?? '0.25'); // 25% per ~5 min

// Last seen price per token (in-memory) for the sanity guard above.
const lastPrice = new Map<string, number>();

export type PositionPnl = {
  position: Position;
  currentPrice: number;
  pnlPct: number;
};

export type ExitSignal = PositionPnl & {
  reason: 'TAKE_PROFIT' | 'STOP_LOSS' | 'TIME_STOP' | 'TRAILING_STOP';
};

async function fetchPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  const quotes = await getTokenPrices(symbols);
  return Object.fromEntries(quotes.map(q => [q.symbol.toUpperCase(), q.price_usd]));
}

/** Open positions enriched with live price and unrealized PnL. */
export async function getOpenPositionsWithPnl(): Promise<PositionPnl[]> {
  const positions = await getOpenPositions();
  if (positions.length === 0) return [];

  let prices: Record<string, number> = {};
  try {
    prices = await fetchPrices([...new Set(positions.map(p => p.token))]);
  } catch (err) {
    console.error('[positions] price fetch failed:', err);
    return [];
  }

  return positions.flatMap(pos => {
    const currentPrice = prices[pos.token.toUpperCase()];
    if (!currentPrice || pos.entry_price_usd <= 0) return [];
    const pnlPct = (currentPrice - pos.entry_price_usd) / pos.entry_price_usd;
    return [{ position: pos, currentPrice, pnlPct }];
  });
}

/**
 * Evaluate every open position against TP / SL / time-stop rules.
 * Returns the positions that should be closed this tick, with the reason.
 */
export async function evaluateExits(now: number): Promise<ExitSignal[]> {
  const enriched = await getOpenPositionsWithPnl();

  const exits: ExitSignal[] = [];
  for (const { position, currentPrice, pnlPct } of enriched) {
    const heldHours = (now - position.opened_at) / 3_600_000;

    // Sanity guard: a single implausible price jump (vs the last reading) is more
    // likely a bad/stale CMC tick than a real move. Skip acting on it this tick —
    // but update the reference so the NEXT reading confirms. A genuine crash then
    // triggers one tick (~5 min) later; a glitch never causes a false stop, and a
    // spurious spike never inflates the trailing-stop peak.
    const token = position.token.toUpperCase();
    const last = lastPrice.get(token);
    lastPrice.set(token, currentPrice);
    if (last !== undefined && last > 0 && Math.abs(currentPrice - last) / last > PRICE_SANITY_MOVE_PCT) {
      console.warn(`[positions] ${token} price jumped ${(((currentPrice - last) / last) * 100).toFixed(1)}% since last read ($${last.toPrecision(4)}→$${currentPrice.toPrecision(4)}) — treating as suspect, skipping exit eval this tick`);
      continue;
    }

    // Ratchet the high-water mark first.
    const peak = Math.max(position.peak_price_usd || position.entry_price_usd, currentPrice);
    if (currentPrice > (position.peak_price_usd || 0)) {
      await updatePositionPeak(position.id, currentPrice);
    }
    const armed = TRAILING_ENABLED && peak >= position.entry_price_usd * (1 + TRAIL_ACTIVATE_PCT);
    const drawdownFromPeak = peak > 0 ? (peak - currentPrice) / peak : 0;

    let reason: ExitSignal['reason'] | null = null;
    if (pnlPct <= -STOP_LOSS_PCT) reason = 'STOP_LOSS';
    else if (armed && drawdownFromPeak >= TRAIL_PCT) reason = 'TRAILING_STOP';
    // Hard TP only matters when trailing is OFF (otherwise we let winners run).
    else if (!TRAILING_ENABLED && pnlPct >= TAKE_PROFIT_PCT) reason = 'TAKE_PROFIT';
    else if (heldHours >= MAX_HOLD_HOURS) reason = 'TIME_STOP';

    if (reason) exits.push({ position, currentPrice, pnlPct, reason });
  }

  return exits;
}

export const EXIT_CONFIG = { TAKE_PROFIT_PCT, STOP_LOSS_PCT, MAX_HOLD_HOURS };
