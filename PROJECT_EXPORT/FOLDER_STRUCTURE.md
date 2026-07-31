# Complete Folder Structure

```
straxor/
├── .github/
│   └── workflows/
│       └── deploy-pages.yml          # GitHub Pages deploy (legacy)
│
├── PROJECT_EXPORT/                   # This documentation
│   ├── README.md
│   ├── BLOCKS.md
│   ├── PROJECT_STATUS.md
│   ├── FOLDER_STRUCTURE.md
│   ├── COMPONENTS.md
│   ├── SERVICES.md
│   ├── BUGS.md
│   ├── TODO.md
│   ├── ROADMAP.md
│   └── ARCHITECTURE.md
│
├── client/                           # React SPA
│   ├── public/
│   │   ├── manifest.json             # PWA manifest
│   │   └── icon-192.png / icon-512.png
│   ├── src/
│   │   ├── components/
│   │   │   ├── workspace/            # 43 workspace panel components
│   │   │   ├── BlueprintPreview.tsx
│   │   │   ├── Layout.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── TemplateSelector.tsx
│   │   ├── lib/                      # 50+ client library modules
│   │   │   ├── api.ts                # Generic fetch helper
│   │   │   ├── auth.tsx              # Auth context + hooks
│   │   │   ├── theme.tsx             # Theme context + provider
│   │   │   ├── commands.ts           # Command palette entries
│   │   │   ├── models.ts             # AI model registry
│   │   │   ├── onboarding.ts         # Onboarding state
│   │   │   ├── admin.ts
│   │   │   ├── agent.ts
│   │   │   ├── browser-verify.ts
│   │   │   ├── chat.ts
│   │   │   ├── connections.ts
│   │   │   ├── console.ts
│   │   │   ├── context.ts
│   │   │   ├── database.ts
│   │   │   ├── deployments.ts
│   │   │   ├── design.ts
│   │   │   ├── design-assets.ts
│   │   │   ├── enterprise.ts
│   │   │   ├── envs.ts
│   │   │   ├── export.ts
│   │   │   ├── files.ts
│   │   │   ├── gateway.ts
│   │   │   ├── git-remote.ts
│   │   │   ├── history.ts
│   │   │   ├── home-center.ts
│   │   │   ├── image.ts
│   │   │   ├── image-agent.ts
│   │   │   ├── infrastructure.ts
│   │   │   ├── kanban.ts
│   │   │   ├── knowledge.ts
│   │   │   ├── logs.ts
│   │   │   ├── marketplace.ts
│   │   │   ├── marketplace-core.ts
│   │   │   ├── mcp-marketplace.ts
│   │   │   ├── multi-agent.ts
│   │   │   ├── notifications.ts
│   │   │   ├── organization.ts
│   │   │   ├── permissions.ts
│   │   │   ├── plan-preview.ts
│   │   │   ├── plugins.ts
│   │   │   ├── preview.ts
│   │   │   ├── projects.ts
│   │   │   ├── providers.ts
│   │   │   ├── publish.ts
│   │   │   ├── quickstart.ts
│   │   │   ├── resilience.ts
│   │   │   ├── roles.ts
│   │   │   ├── rollback.ts
│   │   │   ├── runtime-manager.ts
│   │   │   ├── scale.ts
│   │   │   ├── search.ts
│   │   │   ├── security.ts
│   │   │   ├── sessions.ts
│   │   │   ├── support.ts
│   │   │   ├── teams.ts
│   │   │   ├── usage.ts
│   │   │   ├── verification.ts
│   │   │   ├── verify.ts
│   │   │   ├── web-research.ts
│   │   │   └── worktrees.ts
│   │   ├── pages/
│   │   │   ├── Admin.tsx
│   │   │   ├── Connections.tsx
│   │   │   ├── Dashboard.tsx
│   │   │   ├── DeployManager.tsx
│   │   │   ├── Help.tsx
│   │   │   ├── ImageAgent.tsx
│   │   │   ├── ImageStudio.tsx
│   │   │   ├── Knowledge.tsx
│   │   │   ├── Login.tsx
│   │   │   ├── Marketplace.tsx
│   │   │   ├── Onboarding.tsx
│   │   │   ├── Register.tsx
│   │   │   └── Workspace.tsx
│   │   ├── sdk/
│   │   │   └── index.ts              # Client SDK (exports lib modules)
│   │   ├── App.tsx                   # Root with routes
│   │   ├── main.tsx                  # Entry point
│   │   ├── index.css                 # Global styles + design tokens
│   │   └── vite-env.d.ts
│   ├── .env                          # VITE_API_URL=
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── server/                           # Express API
│   ├── drizzle/
│   │   ├── 0000_abandoned_randall.sql   # Initial schema (50+ tables)
│   │   ├── 0001_pretty_havok.sql        # Block 70-73 tables (9 tables)
│   │   └── meta/
│   ├── src/
│   │   ├── adapters/
│   │   │   ├── ai-provider/             # AI chat provider
│   │   │   ├── browser/                 # Playwright browser verification
│   │   │   ├── context/                 # Context assembly pipeline
│   │   │   ├── database/                # Remote DB browsing
│   │   │   ├── deployment/              # 12 deployment providers
│   │   │   ├── design/                  # AI design/image generation
│   │   │   ├── design-assets/           # Design asset management
│   │   │   ├── direct-providers/        # Direct AI provider connections
│   │   │   ├── export/                  # Project export
│   │   │   ├── gateway/                 # AI gateway router
│   │   │   ├── git/                     # Git operations
│   │   │   ├── infrastructure/          # Infra provider registry
│   │   │   ├── log/                     # Log ingestion & search
│   │   │   ├── multi-agent/             # Multi-agent orchestration
│   │   │   ├── notification/            # 6 notification channels
│   │   │   ├── preview/                 # Dev preview server
│   │   │   ├── registry.ts              # Central adapter registry
│   │   │   ├── rollback/                # Snapshot/rollback
│   │   │   ├── runtime/                 # SSH runtime adapter
│   │   │   ├── search/                  # File search on VPS
│   │   │   ├── security-scanner/        # Vulnerability scanning
│   │   │   ├── usage/                   # Usage tracking & billing
│   │   │   ├── verifier/                # Project verification
│   │   │   └── web-research/            # 4 web search providers
│   │   ├── agents/
│   │   │   └── image-agent/             # Image generation agent
│   │   ├── connections/                 # Universal Connections (Block 71)
│   │   │   ├── ai/                      # AI connections
│   │   │   ├── api/routes.ts
│   │   │   ├── automation/              # Automation connections
│   │   │   ├── cloud/                   # Cloud connections
│   │   │   ├── core/                    # ConnectionManager + types
│   │   │   ├── custom/                  # Custom connections
│   │   │   ├── hardware/                # Hardware connections
│   │   │   ├── index.ts
│   │   │   ├── network/                 # Network connections
│   │   │   └── storage/                 # PostgresConnectionStore
│   │   ├── db/
│   │   │   ├── index.ts                 # Drizzle client init
│   │   │   └── schema.ts                # ~180 Drizzle table definitions
│   │   ├── image/                       # Image Core (Block 69)
│   │   │   ├── api/routes.ts
│   │   │   ├── core/                    # 15+ engine modules
│   │   │   ├── index.ts
│   │   │   ├── plugins/                 # Plugin system
│   │   │   ├── providers/               # 7 image providers
│   │   │   └── storage/                 # Image storage backends
│   │   ├── knowledge/                   # Knowledge System (Block 68)
│   │   │   ├── api/routes.ts
│   │   │   ├── core/                    # 8+ engine modules
│   │   │   ├── index.ts
│   │   │   ├── plugins/                 # Plugin system
│   │   │   ├── search/                  # Semantic search
│   │   │   └── storage/                 # Knowledge storage
│   │   ├── lib/
│   │   │   └── crypto.ts                # AES-256-GCM encryption
│   │   ├── marketplace/                 # Marketplace Core (Block 70)
│   │   │   ├── api/routes.ts
│   │   │   ├── core/                    # 10+ engine modules
│   │   │   ├── index.ts
│   │   │   ├── payments/                # Stripe + PayPal
│   │   │   ├── plugins/                 # Plugin system
│   │   │   └── storage/                 # Postgres + file + memory stores
│   │   ├── middleware/
│   │   │   ├── auth.ts                  # JWT auth middleware
│   │   │   └── rbac.ts                  # Role-based access control
│   │   ├── routes/                      # 54 route modules
│   │   ├── runtime/                     # Runtime adapters
│   │   │   ├── acp/                     # ACP protocol
│   │   │   ├── agent-runtime/           # Agent runtime
│   │   │   ├── crush/                   # CRUSH adapter
│   │   │   ├── free-claude-code/        # Free Claude Code
│   │   │   ├── manager.ts               # Runtime manager
│   │   │   ├── opencode-adapter/        # OpenCode SSH adapter
│   │   │   ├── opencode-universal.ts
│   │   │   ├── quickstart/              # Quickstart scaffolder
│   │   │   └── types.ts
│   │   ├── verification/                # Proof Loop Verification (Block 73)
│   │   │   ├── adapters/proof-loop/
│   │   │   ├── api/routes.ts
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── VerificationEngine.ts
│   │   ├── index.ts                     # Express entry point
│   │   └── types.ts                     # (global types)
│   ├── .env
│   ├── .env.example
│   ├── drizzle.config.ts
│   ├── package.json
│   └── tsconfig.json
│
├── AGENTS.md
├── TECH_STACK.md
├── TECH_DEBT.md
├── package.json                         # Root workspace scripts
└── .gitignore
```

## File Count

| Area | Files |
|------|-------|
| **Server source** | ~190 files (routes, adapters, core modules, etc.) |
| **Client source** | ~105 files (pages, components, lib modules) |
| **Database** | 1 schema file (~180 tables), 2 migration SQL files |
| **Total** | ~300+ source files |
