# Straxor — monorepo (client + server) single-image build.
# Coolify/railpack auto-detection struggles with the client+server monorepo
# (it ran server's build script from the repo root where ../client doesn't
# exist -> "cd: can't cd to ../client"). This Dockerfile builds deterministically.

FROM node:22-alpine AS build
WORKDIR /app

# Client first: install and build the Vite app.
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Server: install deps, then compile TypeScript to dist/.
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci

COPY server/ ./server/
RUN cd server && npx tsc

# ── Runtime image ──
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Server runtime deps only (no dev deps needed to run).
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Compiled server + built client.
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist

# opencode-ai is a runtime dependency of the server (local engine fallback).
WORKDIR /app/server
EXPOSE 3001
CMD ["node", "dist/index.js"]
