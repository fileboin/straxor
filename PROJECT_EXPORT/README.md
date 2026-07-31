# STRAXOR

**AI-powered full-stack development platform.**

STRAXOR is a complete self-hosted development environment that connects to your VPS machines via SSH, lets you manage projects, run AI coding agents, deploy applications, and orchestrate entire workflows — all from a single web dashboard.

## Quick Facts

| Attribute | Value |
|-----------|-------|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS |
| **Backend** | Node.js + Express + TypeScript (ESM) |
| **Database** | PostgreSQL (Neon) + Drizzle ORM |
| **Auth** | bcryptjs + JWT + TOTP 2FA |
| **AI** | BYOK (Bring Your Own Key) — Anthropic, OpenAI, Google, etc. |
| **Deployment** | Single Render Web Service (API + client served together) |
| **Runtime** | SSH‑based remote execution on user's VPS |
| **Streaming** | Server-Sent Events (SSE) |
| **Styling** | CSS custom properties + Tailwind, OLED black theme |
| **Status** | Production‑deployed on Render (https://straxor.onrender.com) |

## Repository Structure

```
straxor/
├── client/          # React SPA (Vite + Tailwind)
├── server/          # Express API + Drizzle ORM
├── PROJECT_EXPORT/  # This documentation
├── .github/         # GitHub Actions
├── .gitignore
├── AGENTS.md        # Session summary (opencode)
├── TECH_STACK.md    # Technology notes
├── TECH_DEBT.md     # Known tech debt
└── package.json     # Root workspace scripts
```

## Key Architecture Decisions

1. **Same‑origin deployment** — Express serves both API and built client files. No CORS needed in production.
2. **Adapter pattern** — Every external capability (AI, git, deployment, search, notifications, etc.) is behind a typed interface. Easy to swap implementations.
3. **SSH‑first** — All machine operations go through SSH (`ssh2`). The user's VPS is the primary execution environment.
4. **BYOK AI** — Users bring their own API keys. Keys stored encrypted (AES‑256‑GCM) or in localStorage.
5. **Drizzle ORM** — Type‑safe Postgres access with migration‑first workflow.
6. **SSE streaming** — Real‑time AI responses, logs, and console output via Server‑Sent Events.

## Environment Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Postgres connection string (Neon) |
| `JWT_SECRET` | No (dev default) | JWT signing secret |
| `ENCRYPTION_KEY` | No | 64‑char hex for AES‑256 encryption |
| `PORT` | No (default 3001) | HTTP server port |
| `CLIENT_URL` | No | Dev CORS origin (not needed in production) |

### Client (`client/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Empty = same‑origin; set for separate API domain |

## Running Locally

```bash
# Install dependencies
cd client && npm install
cd ../server && npm install

# Set up .env files (see .env.example)

# Run both (from root)
npm run dev

# Or individually:
cd server && npm run dev    # API on :3001
cd client && npm run dev    # Dev server on :5173 with proxy
```

## Building for Production

```bash
cd server && npm run build
# This builds client/ then compiles server/
# Output: server/dist/ + client/dist/
```

## Deployment

Deployed as a single Render Web Service:
- **Build command**: `cd server && npm install && npm run build`
- **Start command**: `cd server && node dist/index.js`
- **Server file**: `server/src/index.ts` — serves API + client static files

## Block Architecture

The project was built in 84+ ordered blocks (tracked in `BLOCKS.md`), ranging from auth (Block 1) through enterprise features (Block 63+). Each block adds specific capabilities following a consistent pattern: types → storage → core engine → API routes → client lib → React components → wiring.
