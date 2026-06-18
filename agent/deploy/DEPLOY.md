# Deploying the Kairos agent to AWS EC2

The agent is a stateful, always-on service (self-custody wallet + SQLite + cron
loop). A plain EC2 box with a persistent EBS volume is the lowest-risk host:
SQLite, the twak wallet, and the trade history all just persist.

---

## 1. Launch the instance

- **AMI:** Ubuntu Server 24.04 LTS
- **Type:** `t3.micro` (free-tier eligible) or `t3.small` for headroom
- **Key pair:** create/download one for SSH
- **Storage:** default 8 GB gp3 is plenty (the DB is tiny)
- **Security group (inbound):**
  - `22/tcp` from **your IP only** (SSH)
  - `3001/tcp` from your IP (dashboard API) — or leave closed and SSH-tunnel
- **Elastic IP:** allocate one and associate it, so the IP survives stop/start

> ⚠️ Do **not terminate** the instance during the competition — the root EBS
> volume (and your wallet) is deleted on terminate. **Stop/start preserves it.**

---

## 2. SSH in and bootstrap

```bash
ssh -i your-key.pem ubuntu@<elastic-ip>

# clone your repo, then run the bootstrap
git clone <your-repo-url> ~/kairos
bash ~/kairos/agent/deploy/setup-ec2.sh
```

The script installs Node 24, `@trustwallet/cli`, **pm2**, builds the agent,
creates `/var/lib/kairos` for the database + logs, and configures the pm2 boot
hook (so the agent resurrects after a reboot). It does **not** start the agent
yet — you do that after the wallet is set up.

> To auto-clone instead: `REPO_URL=<your-repo-url> bash setup-ec2.sh`

---

## 3. Configure secrets

```bash
cp ~/kairos/agent/deploy/.env.production.example ~/kairos/agent/.env
nano ~/kairos/agent/.env     # fill in every key
chmod 600 ~/kairos/agent/.env
```

---

## 4. Create the self-custody wallet

```bash
cd ~/kairos/agent
set -a; source .env; set +a          # load TWAK_* + password into the shell

twak wallet create --password "$TWAK_WALLET_PASSWORD"
twak wallet address --chain bsc       # note this address
```

The wallet seed is stored in the `ubuntu` user's home (on the persistent EBS
volume) — it stays put across reboots and stop/start.

---

## 5. Fund + register for the competition

1. Send BNB to the address from step 4 (keep capital deployed — sub-$1 hours
   score 0% per the rules).
2. Register on-chain **before the trading window opens (June 22)**:

```bash
twak compete register
twak compete status        # confirm you're registered
```

---

## 6. Start the agent (pm2)

```bash
cd ~/kairos/agent
pm2 start ecosystem.config.js     # launch under pm2
pm2 save                          # persist the process list across reboots

pm2 status                        # process table
pm2 logs kairos-agent             # live log stream
pm2 monit                         # live CPU / memory / log dashboard
```

It now ticks every 15 min, runs the LLM pipeline inside trading windows, checks
exits, and serves the dashboard API on `:3001`. pm2 auto-restarts it on crash
(up to 10×, 5s backoff) and on out-of-memory (>400 MB), and the boot hook from
setup brings it back after a reboot.

---

## 7. Point the dashboard at it

Deploy the `web/` Next.js app (e.g. Vercel) with:

```
NEXT_PUBLIC_AGENT_URL=http://<elastic-ip>:3001
NEXT_PUBLIC_AGENT_ADDRESS=<your agent wallet address>
NEXT_PUBLIC_SITE_URL=https://<your-vercel-domain>
```

If `3001` is closed in the security group, tunnel instead:
`ssh -i your-key.pem -L 3001:localhost:3001 ubuntu@<elastic-ip>` and use
`http://localhost:3001`.

---

## Operations cheat-sheet

| Task | Command |
|------|---------|
| Live logs | `pm2 logs kairos-agent` |
| Live monitor | `pm2 monit` |
| Status | `pm2 status` |
| Restart | `pm2 restart kairos-agent` |
| Stop | `pm2 stop kairos-agent` |
| Deploy update | `cd ~/kairos && git pull && cd agent && npm install && npm run build && pm2 restart kairos-agent` |
| Backup DB | `cp /var/lib/kairos/agent.db ~/agent-backup-$(date +%F).db` |
| Wallet balance | `cd ~/kairos/agent && set -a; source .env; set +a; twak wallet balance --chain bsc` |

> After a reboot the agent comes back automatically (pm2 boot hook + `pm2 save`).
> If you ever change the process list, re-run `pm2 save`.

> **Back up the wallet and DB before stopping the instance.** The seed lives in
> the home dir; `~/.config` / twak's data dir should be included in any snapshot.
