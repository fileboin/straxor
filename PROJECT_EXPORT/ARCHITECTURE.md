# System Architecture

## High-Level Overview

```
┌────────────────────────────────────────────────┐
│              Browser (PWA)                      │
│  React 18 + Vite + Tailwind + React Router     │
│  ├── Pages (13)                                │
│  ├── Workspace Components (43)                 │
│  ├── Lib Modules (50+)                         │
│  └── API Client (api.ts)                       │
└──────────────┬─────────────────────────────────┘
               │ HTTP / SSE (same origin)
               ▼
┌────────────────────────────────────────────────┐
│         Express API Server (ESM)                │
│  ├── Rate Limiting (auth: 20/15m, api: 500/15m)│
│  ├── JWT Auth + 2FA (TOTP)                     │
│  ├── RBAC Middleware                            │
│  ├── 54 API Route Modules                       │
│  ├── Adapter Registry (~25 adapter types)       │
│  └── Static File Serving (client/dist/)         │
└──────────────┬─────────────────────────────────┘
               │
     ┌─────────┼─────────┬──────────────────┐
     ▼         ▼         ▼                  ▼
┌────────┐ ┌──────┐ ┌──────────┐ ┌──────────────┐
│Postgres│ │ SSH  │ │ AI API   │ │External APIs  │
│(Neon)  │ │(VPS) │ │(BYOK)    │ │(Git, Deploy,  │
│Drizzle │ │ssh2  │ │HTTP/SSE  │ │ Notifications,│
│ ORM    │ │      │ │          │ │ Web Search...)│
└────────┘ └──────┘ └──────────┘ └──────────────┘
```

## Data Flow

### Request Lifecycle
1. Browser → HTTP(S) → Express (same origin)
2. `cors` middleware (accepts any origin)
3. Rate limiter (20/15m for auth, 500/15m for API)
4. JSON body parser (1mb limit, depth < 20)
5. Route matching → auth middleware (JWT verify)
6. Route handler → adapter interface → concrete implementation
7. JSON response → client

### SSE Streaming (AI Chat, Logs, Console)
1. Client opens `GET /api/{resource}/stream`
2. Server creates SSE connection
3. Server spawns SSH session / connects to AI provider
4. Events streamed as `data: {...}\n\n`
5. Client closes connection (browser tab close, abort button)

## Adapter Architecture

```
Adapter Interface (abstract)     ──→  Concrete Implementations
     │                                        │
     ├── RuntimeAdapter         ──→  OpenCode, CRUSH, ACP, Claude
     ├── AIProviderAdapter      ──→  HTTP (Anthropic, OpenAI, etc.)
     ├── GitAdapter             ──→  SSH, Local
     ├── DeploymentAdapter      ──→  12 providers (Render, Vercel, etc.)
     ├── NotificationAdapter    ──→  Slack, Discord, Telegram, Email, Browser, OS
     ├── WebResearchAdapter     ──→  Tavily, Firecrawl, Brave, SearXNG
     ├── SecurityScannerAdapter ──→  npm-audit, pip-audit, OSV, Socket, etc.
     ├── UsageAdapter           ──→  Custom, OpenMeter, Lago
     ├── ImageProviderAdapter   ──→  Gemini, GPT-4, Qwen, SD, Flux, Comfy, NanoBanana
     ├── GatewayAdapter         ──→  Router (load balancing, caching, circuit breaker)
     ├── ...
     └── Registry (adapters/registry.ts) wires everything
```

## Database Schema (Drizzle ORM)

**~180 tables** across these domains:
- Auth & Users (users, user_api_keys, sessions)
- Projects & Collaboration (projects, project_collaborators, comments)
- Machines & SSH (machines)
- AI & Agents (session_messages, agent_sessions, prompts)
- Deployments (deployments, deployment_build_logs)
- Logging (logs, console_entries, audit_logs)
- Organizations & Teams (organizations, teams, org_members)
- Billing (wallet_accounts, subscriptions, tariffs, promo_codes)
- Marketplace (marketplace_items, reviews, installations)
- Plugins (plugins, plugin_events)
- Security (vault_secrets, encryption_keys, sso_configs)
- Infrastructure (infra_configs, runtime_nodes, load_balancers)
- Resilience (system_snapshots, failover_configs, scaling_policies)
- Block 70-73 (marketplace_core_*, connection_instances, verification_tasks)

## Security Model

1. **Authentication**: JWT tokens (bcrypt password hashing, optional TOTP 2FA)
2. **Authorization**: Role-based (user → admin) + project-level RBAC (owner/admin/member/viewer)
3. **Encryption**: AES-256-GCM for stored API keys and secrets (`ENCRYPTION_KEY`)
4. **Input Validation**: Express JSON depth limiter, rate limiting
5. **SSH**: Key-based auth to user VPS
6. **CORS**: Open in production (same-origin architecture)
7. **BYOK**: Users manage their own AI provider keys

## Deployment Architecture (Render)

```
Single Render Web Service
├── Build: cd server && npm install && npm run build
│   ├── 1. cd client && npm install && npm run build  →  client/dist/
│   └── 2. cd server && npx -y tsc                    →  server/dist/
├── Start: cd server && node dist/index.js
│   ├── Express serves /api/* (all routes)
│   ├── Express serves static files (client/dist/)
│   └── SPA fallback: app.get("*") → index.html
└── Environment:
    ├── DATABASE_URL (Neon Postgres)
    ├── JWT_SECRET
    ├── ENCRYPTION_KEY
    └── PORT (set by Render)
```

## React Component Architecture

```
App (ThemeProvider → AuthProvider → Layout)
├── GuestRoute
│   ├── /login → Login
│   └── /register → Register
├── OnboardingGuard → /onboarding → Onboarding
└── ProtectedRoute
    ├── / → Dashboard
    ├── /project/:id → Workspace (43 sub-panels)
    ├── /project/:id/deploy → DeployManager
    ├── /project/:id/image → ImageStudio
    ├── /project/:id/image-agent → ImageAgent
    ├── /project/:id/knowledge → Knowledge
    ├── /help → Help
    ├── /marketplace → Marketplace
    ├── /marketplace/category/:category → Marketplace
    ├── /connections → Connections
    └── /admin → Admin
```
