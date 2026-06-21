import { exec } from 'child_process';
import { promisify } from 'util';
import { resolveToken } from './tokens';
import { getTokenHoldings, getTokenAmount } from './networth';

const execAsync = promisify(exec);

export type TradeOrder = {
  token: string;
  side: 'BUY' | 'SELL';
  amountBnb: number;
  signal: string;
};

export type TradeResult = {
  txHash: string | null;
  status: 'CONFIRMED' | 'FAILED';
  priceUsd: number;
};

function twakEnv() {
  return {
    ...process.env,
    TWAK_ACCESS_ID: process.env.TWAK_ACCESS_ID ?? '',
    TWAK_HMAC_SECRET: process.env.TWAK_HMAC_SECRET ?? '',
    TWAK_WALLET_PASSWORD: process.env.TWAK_WALLET_PASSWORD ?? '',
  };
}

async function twak(args: string): Promise<unknown> {
  const { stdout } = await execAsync(`twak ${args} --json`, {
    env: twakEnv(),
    timeout: 60_000,
  });
  return JSON.parse(stdout);
}

// Resolve symbol to contract address and build swap args.
// BUY:  BNB → token contract  →  `swap <amt> BNB <addr> --chain bsc`
// SELL: token contract → BNB  →  `swap <amt> <addr> BNB --chain bsc`
function swapArgs(order: TradeOrder): string {
  const addr = resolveToken(order.token);
  const [from, to] = order.side === 'BUY' ? ['BNB', addr] : [addr, 'BNB'];
  return `swap ${order.amountBnb} ${from} ${to} --chain bsc`;
}

export type WalletBalance = {
  bnb: number;
  totalUsd: number;
  bnbUsd: number;
  tokenUsd: number;
  holdings: { symbol: string; amount: number; valueUsd: number }[];
  // false when a price/balance fetch failed — the USD total is incomplete and
  // must NOT be persisted as PnL (would otherwise show a fake crash).
  reliable: boolean;
};

export async function getWalletBalance(): Promise<WalletBalance> {
  try {
    const result = await twak('wallet balance --chain bsc') as {
      available?: string;
      total?: string;
      totalUsd?: number;
      address?: string;
    };
    const bnb = parseFloat(result.available ?? result.total ?? '0');
    const bnbUsd = result.totalUsd ?? 0;

    // twak only reports native BNB — read BEP-20 holdings on-chain and price them.
    let tokenUsd = 0;
    let holdings: WalletBalance['holdings'] = [];
    let reliable = true;
    try {
      const address = result.address ?? await getAgentAddress();
      const { holdings: th, missing } = await getTokenHoldings(address);
      holdings = th.map(h => ({ symbol: h.symbol, amount: h.amount, valueUsd: h.valueUsd }));
      tokenUsd = th.reduce((sum, h) => sum + h.valueUsd, 0);
      if (missing.length > 0) {
        reliable = false;
        console.warn(`[execution] could not price held tokens: ${missing.join(', ')} — marking net worth unreliable`);
      }
    } catch (err) {
      reliable = false;
      console.error('[execution] on-chain token holdings failed:', err);
    }

    // BNB held but unpriced (twak hiccup) → also unreliable.
    if (bnb > 0.0001 && bnbUsd <= 0) {
      reliable = false;
      console.warn('[execution] BNB balance > 0 but priced at $0 — marking net worth unreliable');
    }

    return { bnb, bnbUsd, tokenUsd, totalUsd: bnbUsd + tokenUsd, holdings, reliable };
  } catch (err) {
    console.error('[execution] failed to fetch wallet balance:', err);
    return { bnb: 0, totalUsd: 0, bnbUsd: 0, tokenUsd: 0, holdings: [], reliable: false };
  }
}

// kept for backward compat
export async function getBnbBalance(): Promise<number> {
  return (await getWalletBalance()).bnb;
}

// Amount of a token actually sellable right now: the real on-chain balance (which
// can be slightly below the position's estimated size), minus a tiny haircut to
// absorb rounding so the swap doesn't revert. Falls back to `estimated` if the
// on-chain read fails.
export async function getSellableAmount(symbol: string, estimated: number): Promise<number> {
  try {
    const address = await getAgentAddress();
    const onchain = await getTokenAmount(symbol, address);
    if (onchain == null || onchain <= 0) return estimated;
    return Math.min(onchain, estimated) * 0.999;
  } catch {
    return estimated;
  }
}

export async function getAgentAddress(): Promise<string> {
  const result = await twak('wallet address --chain bsc') as { address: string };
  return result.address;
}

export async function signMessage(message: string): Promise<string> {
  const result = await twak(`wallet sign-message --chain bsc --message "${message}"`) as { signature: string };
  return result.signature;
}

export async function executeTrade(order: TradeOrder): Promise<TradeResult> {
  console.log(`[execution] ${order.side} ${order.amountBnb} BNB of ${order.token}`);
  try {
    const result = await twak(swapArgs(order)) as { hash?: string; txHash?: string };
    const txHash = result.hash ?? result.txHash ?? null;
    console.log(`[execution] swap confirmed tx=${txHash}`);
    return { txHash, status: 'CONFIRMED', priceUsd: 0 };
  } catch (err) {
    console.error('[execution] swap failed:', err);
    return { txHash: null, status: 'FAILED', priceUsd: 0 };
  }
}

export async function quoteSwap(order: TradeOrder): Promise<unknown> {
  return twak(`${swapArgs(order)} --quote-only`);
}

export async function testnetTransfer(toAddress: string, amountBnb: number): Promise<TradeResult> {
  console.log(`[execution] testnet transfer ${amountBnb} tBNB → ${toAddress}`);
  try {
    const result = await twak(
      `transfer --to ${toAddress} --amount ${amountBnb} --chain bsctestnet`
    ) as { hash?: string; txHash?: string };
    const txHash = result.hash ?? result.txHash ?? null;
    return { txHash, status: 'CONFIRMED', priceUsd: 0 };
  } catch (err) {
    console.error('[execution] testnet transfer failed:', err);
    return { txHash: null, status: 'FAILED', priceUsd: 0 };
  }
}
