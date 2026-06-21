# Kairos — Autonomous AI Trading Agent on BNB Smart Chain

> **See the moment. Seize it.**
> An autonomous agent that reads the market, reasons through a multi-agent
> pipeline, and signs its own trades self-custody on BSC — fully hands-off,
> inside hard risk limits.

**Track 1 — Autonomous Trading Agents**

| | |
|---|---|
| **Agent wallet (on-chain proof)** | `0x644ae63803121De0fF3628db0B3f588E65759a1d` |
| **BscScan** | https://bscscan.com/address/0x644ae63803121De0fF3628db0B3f588E65759a1d |
| **Live dashboard** | _<your Vercel URL>_ |
| **Repo** | _<your GitHub URL>_ |
| **Demo video** | _<your video link>_ |

---

## The idea

Most "AI trading agents" are an LLM with a single `swap()` bolted on — the model
emits a token and a number, and something else does the rest. Kairos is built the
other way around: it's a **team of specialised agents** that genuinely reason over
live market data, debate the trade, and only then act — with execution that never
leaves the user's custody.

It runs unattended. You set the rules; it reads CoinMarketCap, decides, signs via
Trust Wallet, and manages its own positions on BNB Smart Chain.

## How it works — a 3-agent pipeline + a deterministic risk layer

Every cycle runs a role-based pipeline (raw Anthropic tool-use loop, no framework):

1. **🔬 Analyst** — pulls live market data through the **CoinMarketCap Agent Hub
   (MCP)**: technical analysis (RSI, MACD, EMA), derivatives (funding, open
   interest, liquidations), Fear & Greed, trending narratives, news, and upcoming
   macro events. Produces a structured market brief and ranked opportunities.
2. **📊 Portfolio Manager** — position-aware. Given the brief and current holdings,
   it decides a single action (BUY / SELL / HOLD) with a confidence rating, pulling
   live swap quotes before committing.
3. **🛡️ Risk Officer** — an adversarial check that can resize or veto the trade
   against the rule set (drawdown, size, daily limit, allowlist).

Wrapping the LLM agents is a **deterministic risk layer** that does *not* rely on
model judgment — because capital protection shouldn't be a vibe:

- **Take-profit / stop-loss / time-stop** evaluated every tick, independent of the
  LLM, so winners are banked and losers are cut on rails.
- **Drawdown gate** — hard stop well under the competition's 30% disqualify cap.
- **Gas reserve** — never spends the BNB needed for BSC gas.
- **Tradeable-universe allowlist** — only tokens with verified on-chain liquidity.
- **Trading-window gating, daily-trade limit, no-pyramiding, HIGH-confidence gate.**

## Self-custody execution (Trust Wallet Agent Kit)

TWAK is the **sole execution layer** — there is no custodial hop anywhere in the
loop. The agent:

- signs every transaction on-device via TWAK; keys stay in the wallet the whole way,
- runs fully autonomously (signs and processes its own swaps, hands-off),
- registered itself on-chain for the competition via `twak compete register`.

This is self-custody autonomous trading end to end, not plumbing bolted onto an LLM.

## The strategy (how results are produced)

Kairos is a **regime-aware, signal-confluence swing trader**, deliberately
conservative to respect the drawdown gate:

- **Entry:** only when the Analyst sees confluence (technicals + sentiment +
  narrative align) *and* the Portfolio Manager rates it HIGH confidence. Entries
  are limited to high-liquidity UTC windows.
- **Sizing:** a fixed fraction of the live BNB balance per trade, never breaching
  the gas reserve.
- **Exit:** mechanical — take-profit, stop-loss, and a time-stop close positions
  deterministically; the PM only forces an early exit when the thesis clearly breaks.
- **Universe:** a curated set of liquid, competition-eligible BEP-20 tokens.

The thesis: in a noisy week, **most edge comes from not blowing up** — tight,
rules-based risk control plus a handful of high-conviction entries beats
over-trading into fees and slippage.

## Why it's transparent

The live dashboard streams the agents *thinking* in real time over WebSocket — the
full pipeline, each agent's reasoning (click any stage for the full rationale),
every position with realized/unrealized PnL, win rate, drawdown vs. cap, and a
trade log with on-chain tx links. Every decision (including HOLDs and vetoes) is
persisted, so the agent's behaviour is fully auditable.

## Tech stack

- **Reasoning:** Anthropic Claude (raw tool-use loop), with prompt caching to cut cost
- **Data:** CoinMarketCap Agent Hub via **MCP** (12 tools)
- **Execution:** Trust Wallet Agent Kit (`twak`) — self-custody signing on BSC
- **Backend:** Node.js (Express + WebSocket), PostgreSQL, Dockerised on **Railway**
- **Frontend:** Next.js dashboard on Vercel
- **Chain:** BNB Smart Chain

## What's novel

- A real **multi-agent debate** (analyst → manager → adversarial risk officer),
  not single-shot prompting.
- **Deterministic risk rails around the LLM** — the model can't talk itself out of
  a stop-loss.
- **Glass-box transparency** — you can watch and audit every decision live.
- **Genuinely hands-off self-custody** — registered on-chain, signing its own txs.
