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
- **OpenCode server eventi (≥1.16)**: streaming teksta = `message.part.delta` sa `properties.{messageID, field:"text", delta}`; puni snapshot = `message.part.updated` sa `properties.part`; tool parts u opencode 1.18.11 = `part.type==="tool"` sa `part.tool` (npr. "write"), `part.callID`, `part.state.status` (pending|running|completed|error), `part.state.input` (args), `part.state.output`/`part.state.error`. Stari `tool-call`/`tool-result` tipovi NE postoje u 1.18.11. Parser u `agent.ts` mapira `tool` → `tool_call`/`tool_result` SSE evente. Tačno JEDAN `session.idle` po turn-u; sessionID na `properties.sessionID`.
- **agent.ts auth bug**: rute su čitale `(req as any).userId` (uvijek undefined); sada `router.use(requireAuth)` + `req.user!.userId`.
- **runtimes.ts auth bug (FIXED 886be2b)**: iste rute su koristile `(req as any).userId` → `createOpenCodeUniversalAdapter(undefined)` → sve DB operacije bound adaptera su padale sa `500 UNDEFINED_VALUE: Undefined values are not allowed` (npr. `GET /api/runtimes/opencode/health?machineId=local:opencode`). Popravljeno: `(req as any).user?.userId` (20 zamjena).
- **Server restart napomena**: bilo je više `tsx watch` procesa koji su se nadmetali za port 3001 (uzrok čudnih 500/429). Uvijek ugasiti SVE `node.exe` sa `src/index.ts`/`tsx watch` prije starta JEDNOG servera.
- **GitHub token flow (b2975fa)**: korisnik SAM unosi token kroz UI (agent ga nikad ne vidi). `POST /api/git-remote/config/:platform` enkriptuje (AES-256-GCM) i čuva u `git_connections` (zamjenjuje dummy). `POST /api/repos/push` — server interno dekriptuje token, `ensureWorkspace` osvježi origin URL (već ima `git remote set-url origin` na svaki run), pa `git push origin <branch>` u sandboxu. UI: GitRemotePanel ima password polje "GitHub Personal Access Token" + fine-grained uputstvo, "🔑 Token" dugme za izmjenu, "↑ Push" na aktivnom repou; EnginePicker uvijek pokazuje "GitHub repo".
- **Spawn opencode na dev (win32)**: resolveBin → `%APPDATA%\npm\opencode.cmd`. Moj vlastiti opencode ACP sesija sluša na portu 4096 (NE ubijati). Test-engine procesi su portovi 4100+.
- **sandbox dir**: `server/.straxor-workspaces/<userId>/<owner>__<name>` (gitignored). Token u klon URL: `https://x-access-token:TOKEN@github.com/...`.
- Build komande: server `npx.cmd tsc --noEmit`, client `npm.cmd run build`. Restart servera: Stop-Process na portu 3001 pa Start-Process node + tsx.
- **PowerShell/curl**: Invoke-RestMethod/Invoke-WebRequest prompta za kredencijale na 401 u NonInteractive modu → koristiti `curl.exe`. JSON body za curl pisati u fajl (`-d @fajl`), jer PowerShell mangle navodnike.

## Work State
### Completed
- **FAZA 1** (commit `6103ff6`): `git_connections` + `repo_connections` tabele (migracija `0003_happy_gorilla_man.sql` primijenjena na Neon); `setGitRemoteConfig`/`hydrateGitRemoteConfig`/`getGitRemoteToken` perzistiraju u DB (AES-256-GCM); `/api/repos` connect/active/disconnect/list; klijent repo picker "Poveži za agenta" + "Aktivni repo"; auth-token fix u `lib/git-remote.ts`.
- **FAZA 2** (commit `c78c60c`): `server/src/runtime/local/workspace.ts` — klonira/pull aktivni repo u sandbox preko tokenizovanog URL-a, git binary + isomorphic-git fallback, git config user; `/api/repos/prepare` + `/api/repos/workspace`. Verifikovano: stvarni clone fileboin/straxor (lastCommit 6103ff6).
- **FAZA 3** (commit `80a339d`): `server/src/runtime/local/engine.ts` — spawn `opencode serve` kao child process u workspace diru, machineId konvencija `local:<engine>`, registry per user+repo, free-port, health wait, cleanup na shutdown; `opencode.ts` BoundAdapter refaktorisan na pluggable transport SSH|Localhost (`withTransport`/`httpCall`/`localEventStream`); `agent.ts` requireAuth fix + version-aware SSE parser (delta streaming, finish na prvom session.idle); `repos.ts` gasi engine na switch/disconnect. **Verifikovano end-to-end**: agent bez VPS-a streamuje pravi tekst (202 znaka, 45 delta chunk-ova) preko `message.part.delta` i završava `[DONE]`.
- **FAZE 4–5** (commit `9ccf4d8`): `Workspace.tsx` učitava activeRepo iz baze, kada postoji a VPS nije spojen — postavlja `agentMachineId="local:opencode"` (agent radi na lokalnom klonu repa, bez fallback na čist chat na `:653`). `EnginePicker.tsx` (novi) — per-panel dropdown u headeru Agent panela koji prikazuje trenutni engine (Lokalno · OpenCode / VPS / nema) sa opcijama prebacivanja, otvaranja SSH modala, GitHub repa ili Runtime Managera. `ChatPanel.tsx` novi `runtimeControl` slot. `GitRemotePanel.tsx` — "Postavi aktivni" dugme + `onRepoChanged` callback. VPS-blokade u FileExplorer/Editor/Preview/Rollback/Database komponentama ažurirane (umesto "Poveži VPS" sada "Poveži GitHub repo ili VPS").
- **Password reset + email verification (POTVRĐENO, dev)**: `forgot-password` → token u `server.log` (`[mail:dev]`, nema RESEND_API_KEY) → `reset-password` → login sa novom lozinkom radi → vraćeno na `shotpass123`. `verify-email` sa tokenom → "Email potvrđen", DB `email_verified=true`. Test nalog `shots@straxor.local` je sada verificiran.
- Svi prethodni radovi: Render single-service deploy, white screen fix, SSH disconnect fix (P1), layout toggle (P2), model catalogs + picker (P3), expand/fullscreen (P4), password reset + email verification.

### Active
- **FAZA 6**: Verifikovano do push-a — agent čita/pisne/commituje u sandbox klonu (commit `6507db3`), tool eventi (`tool_call`/`tool_result`) stižu kroz SSE, `/api/repos/push` radi (server dekriptuje token interno, GitHub odbija samo dummy token). Preostaje: korisnik unese PRAVI token kroz UI → `POST /api/repos/push` → 200/OK → screenshot.

### Blocked
- **(push test)** — čeka korisnikov pravi GitHub token unesen LIČNO kroz UI (GitRemotePanel → 🔑 Token → "GitHub Personal Access Token" polje). Agent nikad ne rukuje sirovim tokenom.

## Next Move
1. **FAZA 6**: Korisnik unese pravi token kroz UI (Workspace → Agent panel → EnginePicker ▾ → "GitHub repo" → "🔑 Token") → pokrenuti `POST /api/repos/push` (ili "↑ Push" dugme) → potvrditi 200/OK sa GitHub-a → screenshot.
2. Per user's rule: do NOT touch tests or Swagger until password reset + email verification are confirmed working.
