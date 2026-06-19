# Kairos agent — Railway image.
# Node 24 (required for built-in node:sqlite) + the Trust Wallet CLI (`twak`).
FROM node:24-slim

# CA certs for HTTPS (CMC, BSC RPC, twak backend)
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Self-custody signing CLI — the agent shells out to `twak`
RUN npm install -g @trustwallet/cli

WORKDIR /app

# Install deps first for layer caching (agent has no own lockfile → npm install)
COPY package.json ./
RUN npm install

# App source + build
COPY . .
RUN npm run build

# Entrypoint: restore wallet to the volume, then start the agent
RUN chmod +x deploy/railway-entrypoint.sh

# Railway injects PORT; the app reads process.env.PORT
EXPOSE 3001

ENTRYPOINT ["./deploy/railway-entrypoint.sh"]
