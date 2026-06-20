/**
 * Deterministic entry-scoring layer.
 *
 * Ranks candidate tokens from quantitative signals (cross-sectional momentum,
 * recent momentum, and volume) into a reproducible 0–100 score. This grounds the
 * LLM's pick in real, backtestable signals instead of pure model judgment — the
 * Portfolio Manager receives this ranking as a strong prior.
 *
 * Pure + side-effect-free → unit-testable and (later) backtestable.
 */
import { getTokenPrices } from './cmc';

const MIN_ENTRY_SCORE   = parseFloat(process.env.MIN_ENTRY_SCORE ?? '55');   // 0–100 eligibility gate
const ELIGIBLE_MIN_24H  = parseFloat(process.env.ELIGIBLE_MIN_24H ?? '0');   // don't buy falling knives (% 24h)

// Weights (sum = 1). Trend dominates; volume confirms; recent momentum fine-tunes.
const W_TREND  = 0.5;
const W_RECENT = 0.2;
const W_VOLUME = 0.3;

export type TokenSignal = {
  symbol: string;
  priceUsd: number;
  change1h: number;   // %
  change24h: number;  // %
  volume24h: number;
};

export type TokenScore = {
  symbol: string;
  score: number;      // 0–100 composite
  rank: number;       // 1 = best
  eligible: boolean;  // passes the absolute gates (positive trend + score floor)
  components: { trend: number; recent: number; volume: number }; // each 0–1
  reason: string;
};

// Min-max normalize a value to 0–1 within the candidate set (flat set → 0.5).
function norm(v: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return (v - min) / (max - min);
}

/** Score + rank a set of candidate tokens. Cross-sectional (relative to each other). */
export function scoreTokens(signals: TokenSignal[]): TokenScore[] {
  if (signals.length === 0) return [];

  const c24 = signals.map(s => s.change24h);
  const c1h = signals.map(s => s.change1h);
  const vol = signals.map(s => s.volume24h);
  const [lo24, hi24] = [Math.min(...c24), Math.max(...c24)];
  const [lo1h, hi1h] = [Math.min(...c1h), Math.max(...c1h)];
  const [loV, hiV]   = [Math.min(...vol), Math.max(...vol)];

  const scored = signals.map(s => {
    const trend = norm(s.change24h, lo24, hi24);
    const recent = norm(s.change1h, lo1h, hi1h);
    const volume = norm(s.volume24h, loV, hiV);
    const score = 100 * (W_TREND * trend + W_RECENT * recent + W_VOLUME * volume);
    const eligible = s.change24h >= ELIGIBLE_MIN_24H && score >= MIN_ENTRY_SCORE;
    const reason =
      `score ${score.toFixed(0)} · 24h ${s.change24h >= 0 ? '+' : ''}${s.change24h.toFixed(1)}% · ` +
      `1h ${s.change1h >= 0 ? '+' : ''}${s.change1h.toFixed(1)}%` +
      (eligible ? '' : s.change24h < ELIGIBLE_MIN_24H ? ' · INELIGIBLE (downtrend)' : ' · INELIGIBLE (below score floor)');
    return { symbol: s.symbol, score, eligible, components: { trend, recent, volume }, reason, rank: 0 };
  });

  scored.sort((a, b) => b.score - a.score);
  scored.forEach((s, i) => { s.rank = i + 1; });
  return scored;
}

/** Fetch live signals for the given tokens and score them. */
export async function rankTokens(symbols: string[]): Promise<TokenScore[]> {
  if (symbols.length === 0) return [];
  const prices = await getTokenPrices(symbols);
  const signals: TokenSignal[] = prices.map(p => ({
    symbol: p.symbol,
    priceUsd: p.price_usd,
    change1h: p.percent_change_1h,
    change24h: p.percent_change_24h,
    volume24h: p.volume_24h,
  }));
  return scoreTokens(signals);
}

export const SCORE_CONFIG = { MIN_ENTRY_SCORE, ELIGIBLE_MIN_24H, W_TREND, W_RECENT, W_VOLUME };
