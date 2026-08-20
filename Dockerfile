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
