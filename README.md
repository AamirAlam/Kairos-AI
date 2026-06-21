# Kairos — Autonomous AI Trading Agent on BNB Smart Chain

> **See the moment. Seize it.**

Autonomous, self-custody trading agent built for **BNB Hack: AI Trading Agent Edition**.

A three-agent Claude pipeline reads CoinMarketCap data, grounds its pick in a
deterministic signal-scoring layer, and signs its own trades on BNB Smart Chain via
the Trust Wallet Agent Kit — hands-off, inside hard risk limits, with a live dashboard.

**Agent wallet (on-chain proof):** [`0x644ae63803121De0fF3628db0B3f588E65759a1d`](https://bscscan.com/address/0x644ae63803121De0fF3628db0B3f588E65759a1d)

---

## Stack

| Layer | Technology |
|---|---|
| AI reasoning | Claude (Anthropic SDK) — 3 role-based agents, raw tool-use loop, prompt caching |
| Market data | CoinMarketCap **Agent Hub via MCP** (12 tools: TA, derivatives, F&G, narratives, news, macro) |
| Execution | **Trust Wallet Agent Kit** (`twak`) — self-custody local signing on BSC |
| Chain | BNB Smart Chain |
| Runtime | Node.js 24 + TypeScript |
| Database | **PostgreSQL** in prod / `node:sqlite` for local dev (dual-driver, `DATABASE_URL` switch) |
| Deploy | Docker on **Railway** (agent) + **Vercel** (dashboard) |
| Dashboard | Next.js + Tailwind + Recharts, live over WebSocket |

---

## How it works

The agent runs two independent loops:

- **Exit + portfolio loop — every 5 min, LLM-free.** Checks take-profit / stop-loss /
  trailing-stop / time-stop on open positions, refreshes net worth and unrealized PnL.
- **Decision loop — every 15 min, inside trading windows.** Runs the deterministic
  scorer + the 3-agent LLM pipeline to open/close positions.

```
EXIT LOOP (every 5 min, no LLM, 24/7)
  evaluate TP / SL / trailing / time-stop  ──►  TWAK sell if triggered

DECISION LOOP (every 15 min, only in trading windows)

  1. SIGNAL SCORING  (deterministic)
     rank tradeable tokens by momentum + relative strength + volume → top 4

  2. ANALYST          reads market via CMC MCP → MarketBrief (regime, F&G, opportunities, risks)
        │
  3. PORTFOLIO MGR    brief + ranked prior + open positions → BUY / SELL / HOLD + confidence
        │
  4. RISK OFFICER     adversarial check → approve / resize / veto
        │
  5. PRE-EXEC GATES   tradeable allowlist · HIGH-confidence only · position cap (8) ·
                      gas reserve · trading window · price-sanity
        │
  6. TWAK EXECUTOR    signs locally, submits to BSC, returns tx hash
        │
  7. PERSIST + BROADCAST   Postgres + WebSocket → dashboard updates live
```

### Deterministic signal scoring (grounds the pick)
Before the LLM runs, a pure scoring function ranks the tradeable universe by
cross-sectional **momentum (24h + 1h)** and **volume**, producing a reproducible
0–100 score with eligibility gates (rejects downtrends and weak setups). The
Portfolio Manager receives the **top 4** as a strong prior — so the quant layer
chooses candidates and the LLM is the context-aware veto/selector on top, not the
unreliable sole source of alpha. Reproducible and backtestable.

### Deterministic risk layer (independent of the LLM)
Capital protection never relies on model judgment:

- **Stop-loss** −3.5% from entry · **Trailing stop** arms at +3%, trails 2% below peak
  (lets winners run, locks gains) · **Time-stop** 48h
- **Drawdown gate** — hard stop under the competition's 30% disqualify cap
- **Gas reserve** — never spends the BNB needed for BSC gas
- **Max open positions** (8) · **HIGH-confidence-only entries** · **no pyramiding**
  (except controlled top-ups of undersized positions) · **dust cleanup**
- **Tradeable allowlist** — only competition-eligible tokens with verified liquidity
- **Price-sanity guard** — ignores anomalous single-tick prices to avoid false stops
- **Daily-minimum safety** — guarantees the competition's ≥1-trade/day rule
- Position state changes **only on a confirmed swap** — a failed tx never desyncs the DB

### Self-custody execution (TWAK)
Trust Wallet Agent Kit is the **sole execution layer** — no custodial hop. The agent
signs every transaction on-device, registered itself on-chain via `twak compete register`,
and trades fully autonomously. Net worth is read directly on-chain (decimals-aware) and
priced via CMC.

---

## Dashboard

Live over WebSocket (`web/`, deployed on Vercel):

- **KPI row** — net worth (BNB/token split), total PnL, realized PnL + win rate, drawdown vs cap
- **Agent Pipeline** — Analyst → PM → Risk thinking in real time; click any agent for full reasoning
- **Positions** — open/closed tabs, live unrealized PnL, exit reasons
- **Decision History & Trade Log** — every decision and on-chain trade; click any row for the
  full Analyst→PM→Risk decision chain (tx links to BscScan)

---

## Repo structure

```
bnb-hackathon/
├── agent/                       # Node 24 agent — Dockerised on Railway
│   ├── src/
│   │   ├── agents/
│   │   │   ├── orchestrator.ts   # chains scorer → 3 agents → gates → execute
│   │   │   ├── analyst.ts        # CMC MCP market read
│   │   │   ├── portfolioManager.ts
│   │   │   ├── riskOfficer.ts
│   │   │   ├── exitManager.ts    # deterministic TP/SL/trailing/time-stop (no LLM)
│   │   │   └── base.ts           # Anthropic tool-use loop + prompt caching
│   │   ├── signals/              # cmc.ts (REST), cmcMcp.ts (MCP), score.ts (ranking)
│   │   ├── guardrails/           # drawdown, gas reserve, windows, daily limit, allowlist
│   │   ├── execution/            # TWAK CLI wrapper, tokens.ts, networth.ts (on-chain)
│   │   ├── db/                   # driver.ts (PG/SQLite), schema.ts, queries.ts
│   │   └── api/                  # Express REST + WebSocket
│   ├── deploy/                   # RAILWAY.md, Dockerfile entrypoint, env template
│   ├── Dockerfile · railway.json
│   └── ecosystem… (n/a — Railway)
├── web/                          # Next.js dashboard (Vercel)
│   └── app/components/           # Header, KpiRow, AgentPipeline, Positions,
│                                 # DecisionChainModal, TradeLog, SignalFeed, PnlChart
└── SUBMISSION.md                 # hackathon submission write-up
```

---

## Configuration

All tunable via env (see `agent/deploy/.env.production.example`):

| Group | Vars |
|---|---|
| Secrets | `ANTHROPIC_API_KEY`, `CMC_API_KEY`, `TWAK_ACCESS_ID/HMAC_SECRET/WALLET_PASSWORD`, `AGENT_ID` |
| Database | `DATABASE_URL` (Postgres; unset → local SQLite) |
| Sizing | `TRADE_PCT`, `MAX_TRADE_SIZE_BNB`, `MAX_OPEN_POSITIONS`, `TARGET_POSITION_PCT` |
| Risk | `STOP_LOSS_PCT`, `TRAIL_ACTIVATE_PCT`, `TRAIL_PCT`, `MAX_HOLD_HOURS`, `DRAWDOWN_CAP`, `GAS_RESERVE_USD` |
| Gating | `TRADING_WINDOWS`, `DAILY_TRADE_LIMIT`, `DAILY_MIN_CUTOFF_HOUR`, `REQUIRE_HIGH_CONFIDENCE`, `SCORING_ENABLED` |

---

## Running it

**Local (SQLite, zero-config DB):**
```bash
pnpm install
# agent/.env from agent/deploy/.env.production.example (omit DATABASE_URL → SQLite)
pnpm dev:agent      # agent + API on :3001
pnpm dev:web        # dashboard on :3000
```

**Production:** Docker on Railway with a Postgres service + a volume for the wallet.
Full walkthrough in [`agent/deploy/RAILWAY.md`](agent/deploy/RAILWAY.md).

---

## Why a 3-agent pipeline + deterministic rails

| | Single LLM | This design |
|---|---|---|
| Decision quality | one blob of reasoning | quant scorer ranks → Analyst → PM → adversarial Risk Officer |
| Capital safety | model can skip its own rules | TP/SL/trailing/drawdown are deterministic — the LLM can't override them |
| Reliability | breaks if the API hiccups | exits run LLM-free, 24/7 |
| Transparency | opaque | every decision + trade is logged and inspectable live |
| Self-custody | usually plumbing | TWAK is the whole execution layer; keys never leave the wallet |
