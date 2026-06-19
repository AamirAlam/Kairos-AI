#!/bin/sh
# Railway entrypoint for the Kairos agent.
#
# Persists the twak wallet + SQLite DB on the mounted volume (/data), and restores
# the EXISTING funded/registered wallet from a secret on first boot so the agent
# keeps its on-chain identity (0x644ae6…) instead of generating a new wallet.
set -e

VOLUME="${DATA_DIR:-/data}"
TWAK_DIR="$VOLUME/.twak"

# 1. Point twak at the volume ($HOME/.twak -> /data/.twak) so wallet.json persists.
mkdir -p "$TWAK_DIR"
ln -sfn "$TWAK_DIR" "$HOME/.twak"

# 2. Restore wallet.json from the Railway secret if the volume doesn't have it yet.
#    Create it locally:  base64 -i ~/.twak/wallet.json | pbcopy   (then paste as the secret)
if [ ! -f "$TWAK_DIR/wallet.json" ] && [ -n "$TWAK_WALLET_JSON_B64" ]; then
  echo "$TWAK_WALLET_JSON_B64" | base64 -d > "$TWAK_DIR/wallet.json"
  chmod 600 "$TWAK_DIR/wallet.json"
  echo "[entrypoint] restored wallet.json from TWAK_WALLET_JSON_B64"
fi

if [ ! -f "$TWAK_DIR/wallet.json" ]; then
  echo "[entrypoint] WARNING: no wallet.json on volume and no TWAK_WALLET_JSON_B64 secret — agent cannot sign."
fi

# 3. Start the agent (DB_PATH should point at the volume, e.g. /data/agent.db).
exec node dist/index.js
