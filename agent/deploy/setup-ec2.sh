#!/usr/bin/env bash
#
# Kairos agent — EC2 bootstrap (Ubuntu 22.04 / 24.04).
# Installs Node 24, the Trust Wallet CLI, builds the agent, and installs a
# systemd service. Idempotent: safe to re-run after a `git pull`.
#
# Usage (on the EC2 box, as the `ubuntu` user):
#   curl -fsSL <raw-url>/setup-ec2.sh | bash
#   — or —
#   git clone <repo> ~/kairos && bash ~/kairos/agent/deploy/setup-ec2.sh
#
set -euo pipefail

REPO_URL="${REPO_URL:-}"                       # optional: set to auto-clone
APP_DIR="${APP_DIR:-$HOME/kairos}"             # repo checkout location
AGENT_DIR="$APP_DIR/agent"
DATA_DIR="${DATA_DIR:-/var/lib/kairos}"        # SQLite + persistent state
SERVICE_USER="${SERVICE_USER:-$USER}"
NODE_MAJOR=24

echo "▶ Kairos EC2 setup — user=$SERVICE_USER  app=$APP_DIR  data=$DATA_DIR"

# ── 1. System packages ───────────────────────────────────────────────────────
echo "▶ Installing base packages…"
sudo apt-get update -y
sudo apt-get install -y curl git build-essential ca-certificates

# ── 2. Node 24 (NodeSource) ──────────────────────────────────────────────────
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]; then
  echo "▶ Installing Node $NODE_MAJOR…"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "  node $(node --version) / npm $(npm --version)"

# ── 3. Trust Wallet Agent Kit CLI (provides `twak`) + pm2 ────────────────────
echo "▶ Installing @trustwallet/cli and pm2…"
sudo npm install -g @trustwallet/cli pm2
echo "  $(twak --version 2>/dev/null | tail -1 || echo 'twak installed')"
echo "  pm2 $(pm2 --version 2>/dev/null || echo 'installed')"

# ── 4. Clone (optional) + build the agent ────────────────────────────────────
if [ -n "$REPO_URL" ] && [ ! -d "$APP_DIR/.git" ]; then
  echo "▶ Cloning $REPO_URL → $APP_DIR…"
  git clone "$REPO_URL" "$APP_DIR"
fi

if [ ! -d "$AGENT_DIR" ]; then
  echo "✖ $AGENT_DIR not found. Clone the repo first or set REPO_URL." >&2
  exit 1
fi

echo "▶ Building agent…"
cd "$AGENT_DIR"
npm install
npm run build

# ── 5. Persistent data dir (SQLite + logs live here, off the code tree) ──────
echo "▶ Preparing $DATA_DIR…"
sudo mkdir -p "$DATA_DIR"
sudo chown -R "$SERVICE_USER":"$SERVICE_USER" "$DATA_DIR"

# ── 6. pm2 boot hook (resurrects managed processes after reboot) ─────────────
echo "▶ Configuring pm2 startup hook…"
# Generates and runs the systemd integration so `pm2 save` survives reboots.
sudo env PATH="$PATH:$(dirname "$(command -v node)")" \
  pm2 startup systemd -u "$SERVICE_USER" --hp "$HOME" | tail -1 || true

echo
echo "✅ Setup complete."
echo
echo "Next steps (see DEPLOY.md):"
echo "  1. Create $AGENT_DIR/.env  (copy from deploy/.env.production.example, fill secrets)"
echo "  2. cd $AGENT_DIR && set -a; source .env; set +a"
echo "  3. twak wallet create --password \"\$TWAK_WALLET_PASSWORD\"   # self-custody wallet"
echo "  4. Fund the wallet with BNB, then:  twak compete register"
echo "  5. pm2 start ecosystem.config.js && pm2 save"
echo "  6. pm2 logs kairos-agent          # live monitoring"
