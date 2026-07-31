# TODO.md — What Needs to Be Done

## High Priority

- [ ] **Add React Error Boundaries** — Prevent full white screen on component crash
- [ ] **Add API documentation** — Swagger/OpenAPI spec for all 54+ route modules
- [ ] **Add proper test coverage** — Unit + integration tests for critical paths (auth, chat, agent)

## Medium Priority

- [ ] **Code-split client bundle** — Dynamic imports for workspace panels, reduce 1.6MB+
- [ ] **Consolidate marketplace** — Merge old `/api/marketplace` with Block 70 `/api/marketplace-core`
- [ ] **Refactor client lib modules** — Make all use shared `api.ts` helper instead of raw `fetch()`
- [ ] **Add rate limiting per-route** — Apply appropriate limits to all endpoints
- [ ] **Add server-side validation** — Input validation middleware for all routes
- [ ] **Add logging middleware** — Request/response logging for debugging
- [ ] **Add health check details** — More detailed health check (version, uptime, memory)

## Low Priority

- [ ] **Create root README.md** — Project overview
- [ ] **Add migration guide** — For users upgrading between versions
- [ ] **Add Docker Compose** — For local development setup
- [ ] **Add CI pipeline** — Run tests, lint, type-check on PR
- [ ] **Complete PWA** — Add service worker for offline support
- [ ] **Add proper client SDK** — With TypeScript types and documentation
- [ ] **Add keyboard shortcuts** — Beyond basic command palette
- [ ] **Add dark/light theme toggle** — Currently only OLED black by default
- [ ] **Add i18n** — Currently Serbian/Croatian mixed with English

## Missing Features (Identified)

- [ ] **Email service integration** — SMTP config for notification adapter (auth emails use Resend HTTP API)
- [ ] **Webhook system** — For external integrations
- [ ] **Real-time collaborative editing** — Would need WebSocket + OT/CRDT
- [ ] **Mobile native app** — Currently PWA only
- [ ] **Analytics dashboard** — Charts and visualizations for usage data
- [ ] **AI model fine-tuning** — Would need training infrastructure
- [ ] **Terraform/Pulumi integration** — IaC deployment
- [ ] **WebSocket support** — Currently only SSE for streaming
