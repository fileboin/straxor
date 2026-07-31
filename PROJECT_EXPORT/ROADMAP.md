# ROADMAP.md — Development Roadmap

## Phase 1: Production Stabilization (Current)

### Completed
- ✅ Single-service Render deployment
- ✅ Static file serving from Express with SPA fallback
- ✅ Database health check endpoint
- ✅ All pre-existing TypeScript errors fixed
- ✅ Localhost URL fallback fixed (white screen root cause)
- ✅ CORS restriction removed (same-origin)

### In Progress
- 🔄 Render deploy verification (waiting for white screen confirmation)

### Remaining
- [x] Fix SSH disconnect issues (see BUGS.md)
- [ ] Add error boundaries
- [x] Add password reset + email verification

## Phase 2: Quality & Testing

- [ ] Add comprehensive test suite
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Rate limiting per route
- [ ] Input validation middleware
- [ ] Request/response logging
- [ ] Bundle optimization (code splitting)

## Phase 3: Feature Completion

- [ ] Email service integration
- [ ] Webhook system
- [ ] Analytics dashboard
- [ ] Proper mobile native app (React Native)
- [ ] i18n support

## Phase 4: Advanced Features

- [ ] Real-time collaborative editing
- [ ] AI model fine-tuning
- [ ] Terraform/Pulumi integration
- [ ] WebSocket support (complementing SSE)
- [ ] Enterprise SSO (SAML/OIDC) — basic SSO exists, needs expansion

## Never Implemented Blocks (From commit history gaps)

Based on the block numbering (1-73), these blocks exist in the numbering but were never explicitly committed:

- Block 14 was "Logs System" (committed as separate feature)
- Blocks 15-20 were implemented in order
- Some blocks were merged (e.g., Block 46 split into a and b)
- All blocks 1-73 are accounted for in git history

## Design Decisions for Future

### Architecture
- Keep same-origin deployment model (simpler than microservices)
- Continue adapter pattern for all new capabilities
- Keep BYOK model for AI providers
- Keep SSH-first for remote execution

### Technology Choices
- Stick with Drizzle ORM (mature, type-safe)
- Consider adding WebSocket for bidirectional streaming
- Consider React Native for mobile
- Consider tRPC for type-safe API calls (long-term)
