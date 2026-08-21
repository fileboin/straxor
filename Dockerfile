# Straxor — monorepo (client + server) single-image build.
# Coolify/railpack auto-detection struggles with the client+server monorepo
# (it ran server's build script from the repo root where ../client doesn't
# exist -> "cd: can't cd to ../client"). This Dockerfile builds deterministically.

FROM node:22-alpine AS build
WORKDIR /app

# The client imports type-only modules from server/src (marketplace types), so
# the whole repo must be present in the build stage.
COPY client/package.json client/package-lock.json ./client/
COPY server/package.json server/package-lock.json ./server/
COPY client/ ./client/
COPY server/ ./server/

# Build the Vite client (its source is under /app/client; server types resolve).
RUN cd client && npm ci && npm run build

# Compile the server TypeScript to dist/.
RUN cd server && npm ci && npx tsc

# ── Runtime image ──
# Debian-based (glibc) so opencode-ai's prebuilt binaries run, and so we can
# apt-install git (Alpine has neither glibc nor git, both required at runtime:
# the local engine binary and the workspace clone/commit/push flow).
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Runtime system deps: git (clone/commit/push sandbox), git-lfs (large repos),
# ca-certificates (TLS for GitHub/Ollama/API calls), openssh-client (VPS SSH),
# curl (health checks / Ollama detection on VPS), tini (PID 1 signal handling).
RUN apt-get update && apt-get install -y --no-install-recommends \
      git \
      git-lfs \
      ca-certificates \
      openssh-client \
      curl \
      tini \
    && rm -rf /var/lib/apt/lists/*

# Server runtime deps only (no dev deps needed to run).
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Compiled server + built client.
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# opencode-ai is a runtime dependency of the server (local engine fallback).
WORKDIR /app/server
EXPOSE 3001
CMD ["tini", "--", "node", "dist/index.js"]
