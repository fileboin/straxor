# BUGS.md — Known Bugs & Issues

## 🔴 Critical

### 1. SSH Disconnect — Agent Streaming (FIXED)
**Files**: `server/src/routes/agent.ts`, `server/src/runtime/opencode-adapter/ssh.ts`

**Fix**:
1. `ssh.ts` — 15s `readyTimeout`, 10s keepalive interval with max 3 missed heartbeats, 20s overall connect timeout, client `error`/`close` handlers surface drops as promise rejection / stream close.
2. `agent.ts` — `finish({ flush?, abort? })` options; stream `error` and `close` events call `finish({ abort: true })`; client disconnect (`req.on("close")`) aborts the remote opencode session; partial SSE buffer flushed on close; interrupted flows (timeout/error/client-disconnect) always abort the remote session.

**Status**: ✅ Fixed and typechecked.

### 2. CORS Was Blocking Production (FIXED)
**Root cause**: CORS allowlist used `CLIENT_URL` (default `http://localhost:5173`), blocking `https://straxor.onrender.com`.
**Fix**: Removed CORS restriction — `origin: (origin, cb) => cb(null, origin || true)`.

### 3. White Screen — Hardcoded localhost URLs (FIXED)
**Root cause**: 15 client lib files had `const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"`. Since `VITE_API_URL=""` is falsy, `||` fell through to `localhost`.
**Fix**: Changed fallback to `""` (same-origin) in all 15 files + FileExplorer.tsx (x2).

## 🟡 Medium

### 4. No Email Verification / Password Reset (FIXED)
**Fix**: Added `emailVerified`/`verificationToken`/`resetToken`/`resetTokenExpires` columns to `users` (migration `0002_absurd_thunderbolt.sql`). New endpoints: `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`. Emails sent via Resend HTTP API (`RESEND_API_KEY`) with console-log fallback in dev. New pages: `VerifyEmail.tsx`, `ForgotPassword.tsx`, `ResetPassword.tsx`. Reset token TTL 1h. Registration now requires 6+ char password and returns `emailVerified`.

### 5. No Test Coverage
Zero test files found across the entire codebase (no `*.test.ts`, `*.spec.ts`, `__tests__/`).

### 6. Rate Limiting Incomplete
Only auth routes have stricter limits (20/15min). Most other routes share the general 500/15min limit.

### 7. Inconsistent API Usage in Client
Many lib modules don't use the shared `api.ts` helper — they call `fetch()` directly with hardcoded paths. While the fallback is now fixed, this makes the code harder to maintain.

### 8. Large JS Bundle (1.6MB+)
Client build produces a 1.6MB+ JS bundle. No code splitting. Vite warns about chunk size.

## 🟢 Low

### 9. Missing `noUnusedLocals` on Server
Server tsconfig lacks strict checks. Client has them but this may cause build warnings.

### 10. Marketplace Listed Twice
Two marketplace systems exist:
- Old marketplace at `/api/marketplace` (simpler, integrated earlier)
- New Marketplace Core (Block 70) at `/api/marketplace-core` (comprehensive)

This may confuse users.

### 11. Incomplete Onboarding
Onboarding exists but may not cover all features. The `isOnboardingComplete()` check redirects to `/` if done.

### 12. Client SDK Is Minimal
`sdk/index.ts` just re-exports lib modules. Not a proper SDK with documentation.

### 13. No API Documentation
No Swagger/OpenAPI spec. APIs are only documented in code.

### 14. No README at Root
Project root has no README.md. Only TECH_STACK.md and TECH_DEBT.md exist.

### 15. No Error Boundaries in React
React app doesn't have error boundaries. A runtime error in any component could crash the entire app (white screen).

## 📝 Notes

- All ~70 pre-existing TypeScript errors have been fixed (circular refs, missing properties, param types)
- `tsc --noEmit` passes with 0 errors on both client and server
- Client build clean (no errors, warnings about chunk size only)
