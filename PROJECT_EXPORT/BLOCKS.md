# BLOCKS.md — Complete Block Registry

All blocks implemented in the project, ordered by git commit history (earliest to latest).

**Total blocks: 70+ implemented** (out of 84 commits, some are fixes)

---

## Block 1 — Auth
| Field | Value |
|-------|-------|
| **Status** | ✅ Završeno |
| **Cilj** | User registration, login, JWT authentication |
| **Šta je urađeno** | Register/login endpoints, bcrypt password hashing, JWT tokens, client auth context, protected routes, login/register pages |
| **Fajlovi** | `server/src/routes/auth.ts`, `server/src/middleware/auth.ts`, `client/src/lib/auth.tsx`, `client/src/pages/Login.tsx`, `client/src/pages/Register.tsx` |
| **Šta nedostaje** | Password reset flow, email verification |
| **Poznati bugovi** | None |

## Block 2 — Dashboard
| Field | Value |
|-------|-------|
| **Status** | ✅ Završeno |
| **Cilj** | Project listing and management dashboard |
| **Šta je urađeno** | Dashboard page with project list, create project, project cards |
| **Fajlovi** | `client/src/pages/Dashboard.tsx`, `client/src/lib/projects.ts`, `server/src/routes/projects.ts` |
| **Šta nedostaje** | Project search/filter, pagination for many projects |

## Block 3 — Project Templates + App Blueprint
| Field | Value |
|-------|-------|
| **Status** | ✅ Završeno |
| **Cilj** | Project templates and blueprint system |
| **Šta je urađeno** | TemplateSelector component, BlueprintPreview, quickstart templates |
| **Fajlovi** | `client/src/components/TemplateSelector.tsx`, `client/src/components/BlueprintPreview.tsx`, `server/src/runtime/quickstart/templates.ts`, `server/src/runtime/quickstart/scaffolder.ts` |

## Block 4 — Layout + Design System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Layout component, CSS design tokens (OLED black theme, military green accent), StatusBar, responsive shell |

## Block 5 — Connection Status
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Workspace health indicator showing SSH/machine connection status |

## Block 6 — Provider/Model Dropdown
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Two-layer dropdown for AI provider + model selection, thinking budget slider |

## Block 7 — Input Toolbar
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Input toolbar with mic, camera, file upload, image upload buttons |

## Block 8 — Plan/Act Toggle
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Orchestrator mode toggle + Plan/Act mode toggle |

## Block 9 — Ask Panel
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | AI chat via SSE streaming, BYOK provider connection, first model call |
| **Poznati bugovi** | See TECH_DEBT.md for SSH disconnect issues |

## Block 10 — Auto-Provisioning
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | SSH → OpenCode auto-provisioning on VPS |
| **Fajlovi** | `server/src/runtime/opencode-adapter/provisioner.ts`, `server/src/routes/machines.ts` |

## Block 11 — Agent Panel + Live SSE Streaming
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Agent panel with tool-call rendering, live SSE streaming via SSH tunnel, SSH disconnect hardening |
| **Poznati bugovi** | None (SSH disconnect hardening applied — keepalives, timeouts, abort on drop) |

## Block 12 — Proof-of-Completion V0
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Verification checkmarks, waiting-for-confirm indicator, stale closure fix |

## Block 13 — Adapter Refactor
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Adapter pattern refactor — all capabilities behind typed interfaces |

## Block 14 — Logs System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Server logs (DB), SSE streaming, client LogViewer component |

## Block 15 — Runtime Recovery
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Machine health check, restart, reconnect endpoints |

## Block 16 — Environment Editor
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Project env vars CRUD, validation, export, history |

## Block 17 — Deployment Status
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Deployment tracking, status polling |

## Block 18 — Onboarding
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Onboarding flow, wizard pages, completion guard |

## Block 19 — Panel to Panel Copy
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Content copy between workspace panels |

## Block 20 — Fullscreen Panel Mode
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Fullscreen toggle for any workspace panel |

## Block 21 — Home Menu
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | HomeMenu panel with quick navigation |

## Block 22 — Responsive Workspace
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Mobile tab switcher, responsive layout adjustments |

## Block 23 — Diff Review System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | DiffReview component for git diff visualization |

## Block 24 — Console / Runtime Error Panel
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Console panel with SSE streaming, log levels, filtering |

## Block 25 — Agent Permissions
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Permission system, RBAC middleware, PermissionsPanel |

## Block 26 — System Prompt / Agent Role
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Prompt library CRUD, role selector, saved prompts |

## Block 27 — Security Scanner Adapter
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Multi-ecosystem vulnerability scanning (npm, pip, go, cargo, maven, pub, OSV, Socket) |
| **Fajlovi** | `server/src/adapters/security-scanner/` |

## Block 28 — Export Project
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Project export as ZIP archive, ExportPanel |

## Block 29 — Notification Adapter
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Multi-channel notifications: Slack, Discord, Telegram, Email, Browser, OS |
| **Fajlovi** | `server/src/adapters/notification/` |

## Block 30 — Command Palette
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Command palette (Ctrl+K), CommandPalette component, commands registry |

## Block 31 — Git Worktree System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Git worktree CRUD on VPS, WorktreeManager panel |

## Block 32 — Automated Proof of Completion + Browser Verification
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Browser verification via Playwright, automated screenshot capture |
| **Fajlovi** | `server/src/adapters/browser/`, `server/src/routes/browser-verify.ts` |

## Block 33 — Resume System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Session resume, session history |

## Block 34 — Code Editor
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | CodeMirror-based code editor with multi-language support |

## Block 35 — File Explorer
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | File tree, read/write/delete/search on VPS, FileExplorer component |

## Block 36 — Search System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | File content + filename search on VPS, SearchPanel |

## Block 37 — Undo/Redo System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | HistoryPanel with undo/redo for file operations |

## Block 38 — Preview Adapter
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Dev preview server on VPS, PreviewPanel |

## Block 39 — Database Adapter Panel
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Remote DB browsing, query execution, export (Postgres only) |

## Block 40 — Visual Rollback
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Snapshot/restore/diff on VPS, RollbackPanel |

## Block 41 — Plan & Cost Preview
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | PlanPreview component, cost estimation |

## Block 42 — Context Assembly Pipeline
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Context rules, file assembly, token counting, ContextPanel |

## Block 43 — AI Gateway / Token Router
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | AI provider load balancing, caching, circuit breaker, GatewayPanel |
| **Fajlovi** | `server/src/adapters/gateway/` |

## Block 44 — Direct Provider Connections
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Direct AI provider config panel, key management |

## Block 45 — Multi-Agent System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Multi-agent orchestration, frameworks, roles, tasks, workflows |
| **Fajlovi** | `server/src/adapters/multi-agent/`, `server/src/routes/multi-agent.ts` |

## Block 46 — Home Center + Usage/Cost Transparency
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | HomeCenter dashboard, usage tracking, cost display, limits |
| **Napomena** | Block 46 split into Home Center (46a) and Usage (46b) |

## Block 47 — Quick Start Templates + Design Asset Layer
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Quickstart scaffold, dev server, design assets (icons, colors, tokens), Free Claude Code GitHub Integration |
| **Fajlovi** | `server/src/runtime/quickstart/`, `server/src/adapters/design-assets/` |

## Block 48 — Website Builder + AI Design
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | AI design system with multiple providers, image generation, media library |
| **Fajlovi** | `server/src/adapters/design/` (orchestrator, presenton, providers) |

## Block 49 — Advanced Adapter Ecosystem (Faza 4)
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Gateway, WebResearch, Direct Provider, design assets expansion |

## Block 50 — ACP / Agent Protocol Support
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Agent Communication Protocol adapter with multiple drivers |
| **Fajlovi** | `server/src/runtime/acp/` |

## Block 51 — GitRemoteAdapter
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | 6 platform providers: GitHub, GitLab, Bitbucket, Gitea, Forgejo, HuggingFace |
| **Fajlovi** | `server/src/adapters/git/remote/` |

## Block 52 — DeploymentAdapter Expansion: 12 Providers
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | 12 deploy targets: VPS, Docker, Coolify, Dokploy, CapRover, Render, Railway, Fly.io, DigitalOcean, Vercel, Netlify, Cloudflare Pages |
| **Fajlovi** | `server/src/adapters/deployment/providers/` |

## Block 53 — Panel Live Steering
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Live panel steering/mirroring |

## Block 54 — Kanban Command Center
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Kanban board, aggregated command center, KanbanCommandCenter component |

## Block 55 — MCP Marketplace
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | MCP server marketplace, CRUD, install |

## Block 56 — Infrastructure Adapter
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Infrastructure provider registry, provisioning, InfrastructurePanel |

## Block 57 — Team Collaboration
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Teams CRUD, members, stats, TeamPanel |

## Block 58 — Organization Dashboard
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Orgs CRUD, members, API keys, budgets, policies, OrganizationDashboard component |

## Block 59 — Enterprise Security & Compliance
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | SSO config, audit logs, encryption keys, compliance reports |

## Block 60 — Custom Plugin & Extension SDK
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Plugin system with events, config, enable/disable/execute, PluginManager |

## Block 61 — Marketplace & Community Templates
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Marketplace items, reviews, categories, search, install |

## Block 62 — Global Scale & High Availability
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Runtime nodes, load balancers, failover configs, scaling policies |

## Block 63 — Enterprise Security, Disaster Recovery & Offline Mode
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Vault secrets, guardrails, snapshots, offline mode configuration |

## Block 64 — Admin Control Center
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Admin panel with 16+ sections: feature flags, tariffs, users, wallets, subscriptions, promo codes, logs, audit logs, support tickets, analytics, notifications, system settings, feedback, feature requests |
| **Fajlovi** | `server/src/routes/admin.ts` (27+ endpoints), `client/src/components/workspace/AdminCenter.tsx` |

## Block 65-67 — Support, Publish, Deploy, Admin
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | Support tickets, publish links, admin expansion |

## Block 68 — Knowledge System
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | KnowledgeEngine, KnowledgeGraph, ProjectMemory, LearningEngine, DecisionMemory, DocumentationEngine, ContextBuilder, VersionKnowledge, SemanticSearch, storage backends, plugin system, API routes |
| **Fajlovi** | `server/src/knowledge/` (~15 files) |

## Block 69 — Image Core
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | ImageEngine, ImagePipeline, PromptEngine, StyleEngine, BrandingEngine, TemplateEngine, LayoutEngine, ColorEngine, FontEngine, OptimizationEngine, QualityController, CostController, AssetManager, ImageLibrary, 7 image providers (Gemini, GPT-4, Qwen, SD, Flux, Comfy, NanoBanana), 3 storage backends, plugin system, API routes |
| **Fajlovi** | `server/src/image/` (~30 files) |

## Block 70 — Marketplace Core
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | MarketplaceEngine, PackageRegistry, SearchEngine (TF-IDF), RecommendationEngine, VersionManager, DependencyManager, RatingsManager, CreatorPortal, LicensingEngine (8 licenses), 3 payment stubs (Stripe, PayPal), 3 storage backends (Postgres + file + memory), plugin system, ~30 API endpoints, client lib, Marketplace page |
| **Fajlovi** | `server/src/marketplace/`, `client/src/lib/marketplace-core.ts`, `client/src/pages/Marketplace.tsx` |

## Block 71 — Universal Connections
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | ConnectionManager, 34 adaptera (7 automation, 7 hardware, 6 network, 7 cloud, 5 AI, 3 custom), REST API (~15 endpoints), client lib, Connections page, PostgresConnectionStore |
| **Fajlovi** | `server/src/connections/`, `client/src/pages/Connections.tsx`, `client/src/lib/connections.ts` |

## Block 72 — Image Agent
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | 8 server files (types, prompt-engine, domain-modes (21), brand-presets (10), session-manager, image-agent, api/routes, index), client lib, ImageAgent page (chat UI + session management + decompose + batch gen), routing, button in WorkspaceTopbar |
| **Fajlovi** | `server/src/agents/image-agent/`, `client/src/pages/ImageAgent.tsx`, `client/src/lib/image-agent.ts` |

## Block 73 — Proof Loop Verification
| Status | ✅ Završeno |
|--------|-------------|
| **Šta je urađeno** | VerificationEngine + VerificationAdapter interface + ProofLoopAdapter (5 faza: spec_freeze → evidence → verify with HARD CHECK → fix loop → passed/failed), REST API (7 endpoints), client lib, VerificationPanel modal, PostgresVerificationStore |
| **Fajlovi** | `server/src/verification/`, `client/src/components/workspace/VerificationPanel.tsx`, `client/src/lib/verification.ts` |

## Infrastructure / Cross-Cutting Blocks

| Block | Status | Description |
|-------|--------|-------------|
| Security Hardening | ✅ | AES-256-GCM encryption for API keys |
| OpenCode Provisioning | ✅ | SSH → OpenCode adapter |
| Free Claude Code | ✅ | Free Claude Code runtime adapter |
| CRUSH Runtime | ✅ | CRUSH adapter |
| Agent Runtime | ✅ | Generic agent runtime |
| Responsive Design | ✅ | Mobile tab switcher |
| PWA | ✅ | Manifest + service worker ready |
| Render Deploy | ✅ | Single-service deploy, client served from Express |
| TS Error Fixes | ✅ | All ~70 pre-existing TS errors fixed |
| CORS | ✅ | Removed (same-origin) |
| localhost Fix | ✅ | 15+ files fixed |

## Not Implemented (Identified from code)

| Feature | Evidence | Notes |
|---------|----------|-------|
| Email notifications | Notification adapter exists but SMTP not configured | Need email service |
| SMS notifications | Not in notification adapters | Could add |
| Real-time collaborative editing | Not implemented | Would need WebSocket + OT/CRDT |
| Mobile native app | PWA only | No React Native |
| CI/CD pipeline integration (GitHub Actions) | Basic GitHub Pages deploy only | No deeper integration |
| Webhook system | Not found | For external integrations |
| Analytics dashboard | Basic usage tracking only | No charts/visualization |
| AI model fine-tuning | Not implemented | Would need training infra |
| Terraform/Pulumi integration | Not found | IaC deployment |
