# Deploying the Kairos agent to Railway

The agent is a stateful, always-on service (self-custody wallet + database + cron
loop). Railway runs it as a Docker container backed by **Railway Postgres** (trade
history, positions, PnL) and a small **volume** that persists the twak wallet.

> The image (`agent/Dockerfile`) installs Node 24 + the `twak` CLI, builds the
> agent, and runs `deploy/railway-entrypoint.sh`, which restores your wallet onto
> the volume and starts the agent.

---

## 1. Create the service

1. New Project → **Deploy from GitHub repo** → pick this repo.
2. In the service settings, set **Root Directory** to `agent` (monorepo — the
   Dockerfile and `railway.json` live there).
3. Railway auto-detects the Dockerfile and `railway.json` (healthcheck +
   restart policy are already configured).

## 2. Add Postgres + a volume

**Postgres (database):**
- Project → **New → Database → PostgreSQL** (you already have this).
- On the **agent** service, add a variable referencing it:
  `DATABASE_URL = ${{Postgres.DATABASE_URL}}` (use the internal URL — same private
  network, no TLS needed). Tables are created automatically on first boot.

**Volume (wallet only):**
- Agent service → **Settings → Volumes → New Volume**, **Mount path:** `/data`.
- With Postgres handling the DB, the volume now only persists the twak wallet
  (`/data/.twak/wallet.json`). Still required — without it the wallet resets and
  the agent can't sign.

## 3. Export your existing wallet

You already have a funded, competition-registered wallet. Encode it so the
container can restore it (don't generate a new one):

```bash
# macOS
base64 -i ~/.twak/wallet.json | pbcopy
# Linux
base64 -w0 ~/.twak/wallet.json
```

## 4. Set environment variables

Copy every key from `deploy/.env.production.example` into the service Variables.
Critical ones:

| Variable | Value |
|----------|-------|
| `TWAK_WALLET_JSON_B64` | the base64 string from step 3 |
| `TWAK_WALLET_PASSWORD` | your wallet password |
| `TWAK_ACCESS_ID` / `TWAK_HMAC_SECRET` / `AGENT_ID` | from Trust Wallet portal |
| `ANTHROPIC_API_KEY`, `CMC_API_KEY` | API keys |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (Railway reference) |
| `GAS_RESERVE_USD`, `TRADING_WINDOWS`, etc. | tune as needed |

> Do **not** set `PORT` — Railway injects it and the app reads `process.env.PORT`.

## 5. Deploy

Trigger a deploy (push to the branch or hit Deploy). On first boot the entrypoint:
- symlinks `~/.twak → /data/.twak`
- writes `wallet.json` from `TWAK_WALLET_JSON_B64` (only if the volume is empty)
- starts the agent; the Express API comes up immediately and the healthcheck
  (`GET /api/state`) goes green

Watch **Deploy Logs** for `restored wallet.json` and the first `── tick ──`.

## 6. Expose + point the dashboard

- Service → **Settings → Networking → Generate Domain** to get a public URL.
- On the Vercel frontend set:
  ```
  NEXT_PUBLIC_AGENT_URL=https://<your-service>.up.railway.app
  NEXT_PUBLIC_AGENT_ADDRESS=<your agent wallet address>
  ```
  WebSocket upgrades work over the same HTTPS domain (wss://).

---

## Operations

| Task | How |
|------|-----|
| Logs | Railway dashboard → Deploy Logs (or `railway logs`) |
| Restart | Railway → Deployments → Restart |
| One-off shell | `railway shell` / `railway run <cmd>` (loads env vars) |
| Update | push to the branch → Railway auto-redeploys; the volume persists |
| Wallet balance | `railway run sh -c 'twak wallet balance --chain bsc'` |

## Notes & caveats

- **Trading windows:** the LLM pipeline only runs 00–03 / 13–16 UTC
  (`TRADING_WINDOWS`); outside those it runs exit checks only. Widen for a demo.
- **Wallet security:** the seed lives in a Railway secret + the private volume,
  never in the image. Treat `TWAK_WALLET_JSON_B64` like a private key.
- **Volume backups:** Railway volumes aren't auto-backed-up. Keep your local
  `~/.twak/wallet.json` (and its password) as the source of truth.
- **Re-registration:** because you're restoring the same wallet, your existing
  on-chain `twak compete register` still counts — no need to re-register.
- **Fresh DB starts empty:** the prod Postgres won't know about positions you
  opened during local testing. The agent will treat any tokens already in the
  wallet as untracked (it tracks positions it opens from boot onward). Start with
  a clean wallet, or expect the first run to ignore pre-existing holdings.
- **Local dev** stays on SQLite automatically (no `DATABASE_URL` → `data/agent.db`).
