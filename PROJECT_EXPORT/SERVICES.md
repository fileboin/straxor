# Services, APIs, and Adapters

## API Route Modules (54 total)

All mounted under `/api/*` prefix in `server/src/index.ts`.

| # | Route File | Mount Path | Key Endpoints |
|---|-----------|------------|---------------|
| 1 | `auth.ts` | `/api/auth` | POST register, login, enable-2fa, verify-2fa, disable-2fa |
| 2 | `projects.ts` | `/api/projects` | GET, POST, DELETE :id |
| 3 | `machines.ts` | `/api/machines` | CRUD + test, provision |
| 4 | `chat.ts` | `/api/chat` | POST (SSE streaming) |
| 5 | `agent.ts` | `/api/agent` | POST send (SSE), POST abort, GET status |
| 6 | `logs.ts` | `/api/logs` | GET, GET stream (SSE) |
| 7 | `runtime.ts` | `/api/runtime` | GET health/:machineId, POST restart/:machineId, POST reconnect/:machineId |
| 8 | `envs.ts` | `/api/envs/:projectId` | CRUD + validate, export, history |
| 9 | `deployments.ts` | `/api/deployments` | GET providers, CRUD, rollback, logs |
| 10 | `console.ts` | `/api/console` | GET, POST, GET stream (SSE), DELETE |
| 11 | `permissions.ts` | `/api/permissions` | GET, PUT |
| 12 | `prompts.ts` | `/api/prompts` | CRUD |
| 13 | `security.ts` | `/api/security` | GET scanners, POST scan |
| 14 | `export.ts` | `/api/export` | POST, GET manifest, GET :id, GET :id/status |
| 15 | `notifications.ts` | `/api/notifications` | GET configs, PUT, DELETE :id, POST test |
| 16 | `worktrees.ts` | `/api/worktrees` | GET, GET :machineId/live, POST create, POST delete |
| 17 | `verify.ts` | `/api/verify` | POST, POST build |
| 18 | `browser-verify.ts` | `/api/browser-verify` | POST, POST screenshot |
| 19 | `sessions.ts` | `/api/sessions` | GET, GET :id, DELETE :id, POST :id/transfer |
| 20 | `files.ts` | `/api/files` | GET tree, GET read, POST write, POST delete, POST create-dir, POST move, POST search, POST upload, GET download |
| 21 | `search.ts` | `/api/search` | GET, GET filename |
| 22 | `preview.ts` | `/api/preview` | POST start/stop, GET status/url |
| 23 | `database.ts` | `/api/database` | POST connect, GET databases, GET :name/tables, POST query, POST export |
| 24 | `rollback.ts` | `/api/rollback` | POST create, GET list, POST restore, DELETE delete, GET diff |
| 25 | `context.ts` | `/api/context` | CRUD rules, GET files, POST compile, GET status |
| 26 | `gateway.ts` | `/api/gateway` | GET config, PUT/POST/DELETE config/:id, POST route |
| 27 | `providers.ts` | `/api/providers` | GET, GET definitions, POST :id/key, GET :id/status, POST check-all |
| 28 | `multi-agent.ts` | `/api/multi-agent` | GET frameworks/roles, CRUD instances, tasks, workflows, stats |
| 29 | `home-center.ts` | `/api/home-center` | GET stats |
| 30 | `design-assets.ts` | `/api/design-assets` | GET collections/icons/tokens/stats |
| 31 | `usage.ts` | `/api/usage` | POST events, GET events/summary/costs/limits |
| 32 | `runtimes.ts` | `/api/runtimes` | GET, POST install/uninstall/enable/disable, GET status, POST execute, session, MCP servers |
| 33 | `quickstart.ts` | `/api/quickstart` | GET templates, POST scaffold/start-dev/stop-dev, GET dev-status |
| 34 | `design.ts` | `/api/design` | GET providers, POST generate/generate-image, POST media upload, GET/DELETE media |
| 35 | `web-research.ts` | `/api/web-research` | GET providers, POST search/search-all |
| 36 | `acp.ts` | `/api/acp` | GET agents, POST :agentId/execute, GET :agentId/status |
| 37 | `git-remote.ts` | `/api/git-remote` | GET/POST config/:platform, GET repos, GET repos/:owner/:repo, POST issues, POST pulls |
| 38 | `kanban.ts` | `/api/kanban` | GET (aggregated) |
| 39 | `mcp-marketplace.ts` | `/api/mcp-marketplace` | CRUD servers |
| 40 | `infrastructure.ts` | `/api/infrastructure` | GET providers, CRUD infra configs, POST provision |
| 41 | `teams.ts` | `/api/teams` | CRUD, members, stats |
| 42 | `collaborators.ts` | `/api/projects/:projectId/collaborators` | CRUD |
| 43 | `comments.ts` | `/api/projects/:projectId/comments` | CRUD, resolve |
| 44 | `organizations.ts` | `/api/organizations` | CRUD, members, API keys, policies, budget |
| 45 | `enterprise.ts` | `/api/enterprise` | GET/POST audit-logs, SSO config, encryption keys, compliance reports |
| 46 | `plugins.ts` | `/api/plugins` | GET, POST install, PUT :id/config, POST enable/disable, DELETE, POST execute |
| 47 | `marketplace.ts` | `/api/marketplace` | GET items, CRUD, POST install, reviews, categories, search |
| 48 | `scale.ts` | `/api/scale` | GET status, POST nodes, DELETE nodes/:id, load-balancers, failover, policies |
| 49 | `resilience.ts` | `/api/resilience` | CRUD vault, guardrails, snapshots, restore, offline config |
| 50 | `publish.ts` | `/api/publish` | CRUD publish links |
| 51 | `support.ts` | `/api/support` | CRUD tickets, messages, feedback, feature requests, votes |
| 52 | `admin.ts` | `/api/admin` | 27+ endpoints: feature flags, tariffs, users, wallets, subscriptions, promo codes, logs, audit, support, analytics, notifications, system settings |
| 53 | `api-keys.ts` | `/api/api-keys` | CRUD per provider |
| 54 | *health* | `/api/health` | GET (DB ping) |

### Blocks 68-73 Additional Routes

| Module | Mount | Routes |
|--------|-------|--------|
| `knowledge/api/routes.ts` | `/api/knowledge` | Knowledge CRUD, search, graph |
| `image/api/routes.ts` | `/api/image` | Image generation, providers, media |
| `marketplace/api/routes.ts` | `/api/marketplace-core` | Package registry, search, recommendations, etc. (~30 endpoints) |
| `connections/api/routes.ts` | `/api/connections` | Connection instances CRUD (~15 endpoints) |
| `agents/image-agent/api/routes.ts` | `/api/image-agent` | Image agent chat, sessions |
| `verification/api/routes.ts` | `/api/verification` | Verification tasks, proof loop |

## Adapter Registry

Central registry at `server/src/adapters/registry.ts`. All adapters registered here.

| Adapter Type | Interface | Implementations |
|-------------|-----------|-----------------|
| **RuntimeAdapter** | `runtime/adapter.ts` | OpenCode, CRUSH, Free Claude Code, ACP, Agent Runtime |
| **AIProviderAdapter** | `ai-provider/adapter.ts` | HTTP (generic, supports all providers) |
| **GitAdapter** | `git/adapter.ts` | SSH, Local |
| **LogAdapter** | `log/adapter.ts` | DB |
| **DeploymentAdapter** | `deployment/adapter.ts` | 12 providers: VPS, Docker, Coolify, Dokploy, CapRover, Render, Railway, Fly.io, DigitalOcean, Vercel, Netlify, Cloudflare Pages |
| **SecurityScannerAdapter** | `security-scanner/adapter.ts` | npm-audit, pip-audit, cargo-audit (via OSV), go-audit, maven, pub, OSV scanner, Socket.dev, GitHub Advisory |
| **ExportAdapter** | `export/adapter.ts` | ZIP (archiver) |
| **NotificationAdapter** | `notification/adapter.ts` | Slack, Discord, Telegram, Email, Browser, OS |
| **SearchAdapter** | `search/adapter.ts` | SSH |
| **PreviewAdapter** | `preview/adapter.ts` | VPS |
| **DatabaseAdapter** | `database/adapter.ts` | Postgres |
| **RollbackAdapter** | `rollback/adapter.ts` | VPS |
| **ContextEngine** | `context/adapter.ts` | Engine, Web Research |
| **GatewayAdapter** | `gateway/adapter.ts` | Router (load balancing, caching, circuit breaker) |
| **WebResearchAdapter** | `web-research/adapter.ts` | Tavily, Firecrawl, Brave, SearXNG |
| **BrowserAdapter** | `browser/adapter.ts` | Playwright |
| **UsageAdapter** | `usage/adapter.ts` | Custom, OpenMeter, Lago |
| **Verifier** | `verifier/adapter.ts` | Checks |
| **GitRemoteAdapter** | `git/remote/adapter.ts` | GitHub, GitLab, Bitbucket, Gitea, Forgejo, HuggingFace |
| **ImageProvider** | `image/providers/interfaces.ts` | Gemini, GPT-4, Qwen, Stable Diffusion, Flux, Comfy UI, NanoBanana |
| **ImagePlugin** | `image/plugins/interfaces.ts` | Plugin manager |
| **KnowledgePlugin** | `knowledge/plugins/interfaces.ts` | Plugin manager |
| **MarketplacePlugin** | `marketplace/plugins/interfaces.ts` | Plugin manager |
| **MarketplacePayment** | `marketplace/payments/interfaces.ts` | Stripe, PayPal |
| **MarketplaceStorage** | `marketplace/storage/interfaces.ts` | Postgres, File, Memory |
| **DesignProvider** | `adapters/design/types.ts` | GPT-4 Image, Gemini Image, Flux, Stable Diffusion, Comfy UI |
| **DirectProvider** | `adapters/direct-providers/types.ts` | AI provider manager |
| **InfrastructureProvider** | `adapters/infrastructure/types.ts` | Provider registry |
| **MultiAgent** | `adapters/multi-agent/types.ts` | Orchestrator |
| **ConnectionAdapter** | `connections/core/types.ts` | 34 adapters (AI, automation, cloud, custom, hardware, network) |

## Core Modules

| Module | Location | Description |
|--------|----------|-------------|
| **Drizzle ORM** | `server/src/db/` | ~180 table definitions, Postgres client |
| **Crypto** | `server/src/lib/crypto.ts` | AES-256-GCM encrypt/decrypt |
| **Auth Middleware** | `server/src/middleware/auth.ts` | JWT verify, requireAuth, requireAdmin |
| **RBAC Middleware** | `server/src/middleware/rbac.ts` | Project-level access control |
| **Image Core** | `server/src/image/core/` | ImageEngine, Pipeline, Prompt, Style, Branding, Template, Layout, Color, Font, Optimization, Quality, Cost, Asset, Library engines |
| **Knowledge Core** | `server/src/knowledge/core/` | KnowledgeEngine, Graph, ProjectMemory, Learning, Decision, Documentation, ContextBuilder, VersionKnowledge |
| **Marketplace Core** | `server/src/marketplace/core/` | MarketplaceEngine, PackageRegistry, Search, Recommendation, Version, Dependency, Ratings, CreatorPortal, Licensing |
| **Verification** | `server/src/verification/` | VerificationEngine, ProofLoopAdapter, PostgresVerificationStore |
| **Connection Manager** | `server/src/connections/core/` | ConnectionManager |

## Database Schema (~180 tables)

Major entity groups:

- **Users & Auth**: users, user_api_keys, sessions, session_messages, user_permissions
- **Projects**: projects, project_envs, project_env_history, project_rules, project_deploy_configs, project_collaborators
- **Machines**: machines, vault_secrets
- **AI**: agent_sessions, session_guardrails, saved_prompts, memories
- **Deployments**: deployments, deployment_build_logs, publish_links
- **Logging**: logs, console_entries, audit_logs
- **Organizations**: organizations, organization_members, organization_policies, organization_api_keys
- **Teams**: teams, team_members
- **Billing**: wallet_accounts, wallet_transactions, subscriptions, tariffs, promo_codes, budget_limits
- **Marketplace**: marketplace_items, marketplace_installations, marketplace_reviews
- **Plugins**: plugins, plugin_events
- **Security**: encryption_keys, sso_configs, feature_flags
- **Infrastructure**: infra_configs, runtime_nodes, load_balancer_configs, failover_configs, scaling_policies
- **Resilience**: system_snapshots, restore_points, offline_config
- **Support**: support_tickets, support_messages, feedback, feature_requests, feature_votes
- **MCP**: mcp_servers
- **Admin**: admin_registry, system_settings
- **Block 70-73**: marketplace_core_packages, marketplace_core_reviews, marketplace_core_creators, marketplace_core_payments, marketplace_core_events, connection_instances, connection_events, verification_tasks

## Design System

- **Theme**: OLED true black (`#000000`), light theme via `[data-theme="light"]`
- **Accent**: Military olive green (`#6b8c42`), customizable via `[data-accent]`
- **Tokens**: CSS custom properties for surface, border, accent, danger colors
- **Breakpoints**: Responsive with mobile tab switcher
- **PWA**: Manifest + service worker ready
