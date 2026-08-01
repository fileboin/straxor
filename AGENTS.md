# Session Summary

## Objective
Definitivna arhitektura: GitHub repo konekcija = prioritet #1 (agent radi punom snagom na repo-u BEZ VPS-a), VPS = opciona opcija iz "+" menija. Faze: (1) trajna šifrovana GitHub konekcija + aktivni repo, (2) lokalni workspace modul (clone/pull/git config), (3) lokalni engine runner + pluggable transport, (4) agent radi bez VPS-a, (5) per-panel engine picker; zatim finalni test + screenshot.

## Important Details
- **Render deploy**: Single Web Service serves both API and client. `server/package.json` builds `client/` then compiles server. Express serves `client/dist/` static files with SPA fallback.
- **No CORS needed** between frontend and backend — same origin.
- **White screen root cause**: 15 client lib files had `const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001"`. Since `VITE_API_URL=""` (empty) is falsy, `||` fell through to `localhost`, breaking all API calls in production. Fixed by changing fallback to `""` (same‑origin).
- **`client/.env`**: `VITE_API_URL=` empty → same‑origin `/api/*` calls. File is now tracked in git.
- **Email**: Auth emails go through Resend HTTP API (`RESEND_API_KEY`) with console-log fallback in dev (`server/src/lib/mail.ts`). `server/.env` is gitignored; `.env.example` is tracked.
- **Note**: Client `tsc --noEmit` still reports many pre‑existing errors (unused vars, implicit any in enterprise/scale/marketplace libs). Vite build (esbuild) does NOT type‑check, so `npm run build` passes — these are not blockers.
- **Lokalni engine**: `opencode-ai` npm paket (NE `opencode`) — provisioner koristi pogrešan `npm i -g opencode`. Instaliran globalno u dev (verzija 1.18.11). Za Render treba dodati `npm i -g opencode-ai` u build skriptu.
- **OpenCode server eventi (≥1.16)**: streaming teksta = `message.part.delta` sa `properties.{messageID, field:"text", delta}`; puni snapshot = `message.part.updated` sa `properties.part`; tool parts na `part.type==="tool-call"/"tool-result"`; tačno JEDAN `session.idle` po turn-u (stara logika dva-idle visi); sessionID na `properties.sessionID`. Agent.ts parser je ažuriran na ovaj format.
- **agent.ts auth bug**: rute su čitale `(req as any).userId` (uvijek undefined); sada `router.use(requireAuth)` + `req.user!.userId`.
- **Spawn opencode na dev (win32)**: resolveBin → `%APPDATA%\npm\opencode.cmd`. Moj vlastiti opencode ACP sesija sluša na portu 4096 (NE ubijati). Test-engine procesi su portovi 4100+.
- **sandbox dir**: `server/.straxor-workspaces/<userId>/<owner>__<name>` (gitignored). Token u klon URL: `https://x-access-token:TOKEN@github.com/...`.
- Build komande: server `npx.cmd tsc --noEmit`, client `npm.cmd run build`. Restart servera: Stop-Process na portu 3001 pa Start-Process node + tsx.

## Work State
### Completed
- **FAZA 1** (commit `6103ff6`): `git_connections` + `repo_connections` tabele (migracija `0003_happy_gorilla_man.sql` primijenjena na Neon); `setGitRemoteConfig`/`hydrateGitRemoteConfig`/`getGitRemoteToken` perzistiraju u DB (AES-256-GCM); `/api/repos` connect/active/disconnect/list; klijent repo picker "Poveži za agenta" + "Aktivni repo"; auth-token fix u `lib/git-remote.ts`.
- **FAZA 2** (commit `c78c60c`): `server/src/runtime/local/workspace.ts` — klonira/pull aktivni repo u sandbox preko tokenizovanog URL-a, git binary + isomorphic-git fallback, git config user; `/api/repos/prepare` + `/api/repos/workspace`. Verifikovano: stvarni clone fileboin/straxor (lastCommit 6103ff6).
- **FAZA 3** (commit `80a339d`): `server/src/runtime/local/engine.ts` — spawn `opencode serve` kao child process u workspace diru, machineId konvencija `local:<engine>`, registry per user+repo, free-port, health wait, cleanup na shutdown; `opencode.ts` BoundAdapter refaktorisan na pluggable transport SSH|Localhost (`withTransport`/`httpCall`/`localEventStream`); `agent.ts` requireAuth fix + version-aware SSE parser (delta streaming, finish na prvom session.idle); `repos.ts` gasi engine na switch/disconnect. **Verifikovano end-to-end**: agent bez VPS-a streamuje pravi tekst (202 znaka, 45 delta chunk-ova) preko `message.part.delta` i završava `[DONE]`.
- **FAZE 4–5** (commit `9ccf4d8`): `Workspace.tsx` učitava activeRepo iz baze, kada postoji a VPS nije spojen — postavlja `agentMachineId="local:opencode"` (agent radi na lokalnom klonu repa, bez fallback na čist chat na `:653`). `EnginePicker.tsx` (novi) — per-panel dropdown u headeru Agent panela koji prikazuje trenutni engine (Lokalno · OpenCode / VPS / nema) sa opcijama prebacivanja, otvaranja SSH modala, GitHub repa ili Runtime Managera. `ChatPanel.tsx` novi `runtimeControl` slot. `GitRemotePanel.tsx` — "Postavi aktivni" dugme + `onRepoChanged` callback. VPS-blokade u FileExplorer/Editor/Preview/Rollback/Database komponentama ažurirane (umesto "Poveži VPS" sada "Poveži GitHub repo ili VPS").
- Svi prethodni radovi: Render single-service deploy, white screen fix, SSH disconnect fix (P1), layout toggle (P2), model catalogs + picker (P3), expand/fullscreen (P4), password reset + email verification.

### Active
- **FAZA 6**: Finalni end-to-end test — spojiti pravi GitHub repo (korisnikov token, ne dummy) u dev, otvoriti Agent panel, poslati zadatak, potvrditi da agent čita/pisne u kloniranom repou i da `git push` radi. Ovo je poslednja stvar prije screenshot-a.

### Blocked
- **(none)** — nema blokera; pravi GitHub connect + agent commit/push test na kraju (treba korisnikov pravi token).

## Next Move
1. **FAZA 6**: Korisnik spoji svoj GitHub repo (pravi token) → otvori Agent panel → pošalje zadatak (npr. "Napravi TODO.md sa 3 stavke") → potvrditi čitanje/pisanje/commit/push u kloniranom repou + screenshot.
2. Per user's rule: do NOT touch tests or Swagger until password reset + email verification are confirmed working.
