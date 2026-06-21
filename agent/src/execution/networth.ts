/**
 * On-chain net worth — twak's balance/portfolio endpoints only return the native
 * BNB balance (token holdings come back empty), so we read BEP-20 balances directly
 * from chain via JSON-RPC eth_call and price them through CoinMarketCap. This matches
 * what a block explorer shows.
 *
 * Note: BSC BEP-20 tokens are uniformly 18 decimals (including USDT/USDC, unlike on
 * Ethereum), so we treat all balances as 18-decimal. Stablecoins are valued via CMC.
 */
import { BSC_TOKENS } from './tokens';
import { getTokenPrices } from '../signals/cmc';

const RPC_URL = process.env.BSC_RPC_URL ?? 'https://bsc-dataseed1.binance.org';
const BALANCE_OF_SELECTOR = '0x70a08231'; // balanceOf(address)
const DECIMALS_SELECTOR   = '0x313ce567'; // decimals()

export type TokenHolding = {
  symbol: string;
  amount: number;
  priceUsd: number;
  valueUsd: number;
};

// Distinct symbol→address pairs (the registry has a couple of aliases sharing an address).
function tokenEntries(): { symbol: string; address: string }[] {
  const seen = new Set<string>();
  const out: { symbol: string; address: string }[] = [];
  for (const [symbol, address] of Object.entries(BSC_TOKENS)) {
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ symbol, address });
  }
  return out;
}

async function ethCall(to: string, data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'eth_call',
      params: [{ to, data }, 'latest'],
    }),
  });
  const json = await res.json() as { result?: string; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result ?? '0x0';
}

async function balanceOf(token: string, owner: string): Promise<bigint> {
  const padded = owner.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const raw = await ethCall(token, BALANCE_OF_SELECTOR + padded);
  if (!raw || raw === '0x') return 0n;
  return BigInt(raw);
}

// decimals() — must be read per token, NOT assumed 18. Binance-Peg tokens like
// DOGE use 8 decimals; assuming 18 values them at ~$0.
async function decimalsOf(token: string): Promise<number> {
  try {
    const raw = await ethCall(token, DECIMALS_SELECTOR);
    if (!raw || raw === '0x') return 18;
    const d = Number(BigInt(raw));
    return d > 0 && d <= 36 ? d : 18;
  } catch {
    return 18;
  }
}

function toAmount(raw: bigint, decimals: number): number {
  return Number(raw) / 10 ** decimals;
}

// Actual on-chain amount of a single token held by `owner` (null if not in the
// registry or the read fails). Used to size SELLs off the real balance, not the
// estimated position size (which overshoots and reverts the swap).
export async function getTokenAmount(symbol: string, owner: string): Promise<number | null> {
  const address = BSC_TOKENS[symbol.toUpperCase()];
  if (!address) return null;
  try {
    const raw = await balanceOf(address, owner);
    if (raw <= 0n) return 0;
    return toAmount(raw, await decimalsOf(address));
  } catch {
    return null;
  }
}

export type HoldingsResult = {
  holdings: TokenHolding[];
  missing: string[]; // held tokens we hold a balance of but could NOT price this call
};

/**
 * Read non-zero BEP-20 balances for `owner` across the token registry and value them.
 * Reports any held token we couldn't price in `missing` — the caller decides whether
 * to trust the total (a priced-as-$0 token would otherwise corrupt net worth/PnL).
 */
export async function getTokenHoldings(owner: string): Promise<HoldingsResult> {
  const entries = tokenEntries();

  const balances = await Promise.all(
    entries.map(async e => {
      try {
        return { symbol: e.symbol, address: e.address, raw: await balanceOf(e.address, owner) };
      } catch {
        return { symbol: e.symbol, address: e.address, raw: 0n };
      }
    }),
  );

  // Read decimals per held token (NOT assumed 18) so 8-decimal tokens like DOGE
  // are valued correctly.
  const heldRaw = balances.filter(b => b.raw > 0n);
  const held = await Promise.all(
    heldRaw.map(async b => ({ symbol: b.symbol, amount: toAmount(b.raw, await decimalsOf(b.address)) })),
  );

  if (held.length === 0) return { holdings: [], missing: [] };

  let priceMap: Record<string, number> = {};
  try {
    const quotes = await getTokenPrices(held.map(h => h.symbol));
    priceMap = Object.fromEntries(quotes.map(q => [q.symbol.toUpperCase(), q.price_usd]));
  } catch (err) {
    console.error('[networth] price fetch failed:', err);
    // priceMap stays empty → every held token reported as missing below
  }

  const holdings: TokenHolding[] = [];
  const missing: string[] = [];
  for (const h of held) {
    const priceUsd = priceMap[h.symbol.toUpperCase()];
    if (priceUsd && priceUsd > 0) {
      holdings.push({ symbol: h.symbol, amount: h.amount, priceUsd, valueUsd: h.amount * priceUsd });
    } else {
      missing.push(h.symbol); // hold it, but couldn't price it — don't value at $0
    }
  }
  return { holdings, missing };
}
