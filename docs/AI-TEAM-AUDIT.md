# STRAXOR — AI Agent ↔ OpenCode ↔ GitHub Team Audit & Architecture

> Status: AUDIT (FAZA 1–3). Nema izmena koda — čisto istraživanje sa dokazima (file:line).
> Datum: 2026-08-05. Autor: Euro Krater zadatak → audit izvršen kroz kod.

---

## FAZA 1 — Kako OpenCode trenutno radi u STRAXOR

### 1.1 Gde je OpenCode integrisan

OpenCode je jedini **lokalni** engine i glavni "izvršilac" za Agent panele.

- **Spawner:** `server/src/runtime/local/engine.ts` → `ensureLocalEngine()` (line 102).
- **Razrešavanje binara:** `resolveBin()` (line 58) — win32 `%APPDATA%\npm\opencode.cmd`, override preko `OPENCODE_BIN`/`ENGINE_BIN`. (Paket je `opencode-ai`, ne `opencode`.)
- **Radi kao child process:** `spawn(bin, ["serve","--port",N], { cwd: ws.dir, shell:true })` (lines 135–144).

### 1.2 Kako se pokreće

| Stavka | Vrednost | Dokaz |
|---|---|---|
| Komanda | `opencode serve --port <N>` | engine.ts:135 |
| Radni dir | klonirani repo sandbox `ws.dir` | engine.ts:139 |
| Port | deterministički `4100 + hash(user:engine:repo) % 1000`, pa probaj gore dok slobodan | engine.ts:133, `findFreePort` :72 |
| Env | `{ PORT, OPENCODE_SERVER_PORT }` | engine.ts:141 |
| Registry | in-memory `Map`, ključ `userId:engine:fullName` | engine.ts:37, :96 |
| Cleanup | `stopHandle` kill + SIGKILL, briše iz mape | engine.ts:195–206 |

### 1.3 Koji AI model koristi i odakle dobija AI sposobnosti — **KRITIČAN NALAZ**

**OpenCode se spawnuje BEZ ijednog modela/providerea. Samo `serve --port`.**

- Nema `--model`, nema provider env var u spawn pozivu — engine.ts:135,141.
- `server/.env` i `.env.example` NE sadrže AI ključeve (samo `DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, CLIENT_URL, PORT, RESEND_API_KEY, EMAIL_FROM`).
- Nema `opencode.json`/`opencode.jsonc` u repo-u ni u sandbox-u (glob prazan).
- Globalni `~/.config/opencode/opencode.jsonc` je **prazan** — samo `$schema`.
- Nema `~/.local/share/opencode/auth.json` (pretraženo rekurzivno) → **nema opencode auth prijave na ovoj mašini**.

**Zaključak:** lokalni `local:opencode` nema konfigurisan AI backend. OpenCode bi se oslanjao na sopstveno stanje autentikacije, koje ne postoji. Postojeći "chat/Ask" paneli koriste **zaseban** model-router sloj (`model-router.ts`, `ai-provider/http.ts`) koji **NE hrani OpenCode**.

> Ovo je najveći prazan hod: OpenCode kao "developer agent" trenutno nema garanciju da ima model. Zato su prethodni testovi koristili fallback env `STRAXOR_TEST_GITHUB_TOKEN` i lokalni opencode koji je (u mom testu) odgovorio — ali to ne znači da je produkcijski ispravan.

### 1.4 Kako se šalju promptovi i vraćaju rezultati

- **Transport:** `server/src/adapters/runtime/opencode.ts` — dualni. `local:` → native `fetch` na `127.0.0.1:<port>` (`localHttp`, :143). SSH/VPS → `curl` preko SSH tunela (`curlExec`, :120).
- **Endpointi:** `POST /session`, `POST /session/:id/prompt_async|message`, `GET /event` (SSE), `POST /session/:id/abort`, `GET /session/:id/diff|todo`.
- **SSE parser:** `server/src/routes/agent.ts:151–245` — `message.part.delta` → text; `part.type==="tool"` (`state.status`) → `tool_call`/`tool_result`; jedan `session.idle` = kraj turn-a.
- **Attachments:** `buildMessageParts` (opencode.ts:212) → `{type:"file", mime, filename, url:"data:..."}`.

### 1.5 Registry engine-a

| Runtime | Local? | Instaliran? |
|---|---|---|
| **opencode** | **DA** | **DA** |
| crush, free-claude-code | SSH/VPS | NE |
| openhands/deerflow/voltagent/langgraph/crewai/autogen/agentarius | SSH/VPS | NE |
| acp/claude-code/codex/gemini-cli/cline/goose/qwen-code | SSH/VPS | NE |
| continue | SSH | NE (disabled) |

Izvor: `routes/runtimes.ts:21+`, `runtime/manager.ts:23`. machineId konvencija `local:<engine>` (`engine.ts:32,40`).

---

## FAZA 2 — Analiza AI Agent sistema

### 2.1 Gde su agenti i kako komuniciraju

- **Rute:** `server/src/routes/agent.ts` — `/send`, `/steer`, `/sessions`, `/todos`, `/diff`, `/approve`, `/reject`, `/file`, `/background`.
- **Chat:** `server/src/routes/chat.ts` — `/`, `/route`, `/orchestrate`.
- **Orkestracija:** `POST /agent/send` → `getAdapters().runtime(userId)` → `createOpenCodeUniversalAdapter` → `ensureLocalEngine` → `ensureWorkspace` → `opencode serve` → HTTP + SSE nazad.

### 2.2 Šta agenti mogu

| Sposobnost | Ima? | Dokaz |
|---|---|---|
| Filesystem | ✅ cwd = repo sandbox | engine.ts:139 |
| Terminal | ✅ bash/tool builtini + `executeCommand` | opencode.ts:573 |
| GitHub repo | ✅ clone/pull/push | workspace.ts:87–138, repos.ts:269 |
| Database | ⚠️ indirektno preko postgres adaptera | registry.ts:69–72 |
| Deployment | ✅ zaseban adapter (ne agent) | registry.ts:57 |
| Git identitet | "Straxor Agent" / agent@straxor.dev | workspace.ts:104 |

### 2.3 Prekid komunikacije (gaps)

1. **OpenCode nema model** (vidi 1.3) — spawn bez providera/auth.
2. **Nema "tim" između agenata** — samo jedan OpenCode proces po (user, repo). Nema AI Architect → OpenCode Developer → Testing tok.
3. **Model nije injektibilan u engine spawn** — samo `PORT` env (engine.ts:141). Ne možeš reći opencode-u "koristi opus za ovaj task".
4. **Nema Agent Memory** — background jobs in-memory, gube se na restart (agent.ts:449).
5. **Nema Task Queue** — nema prioritizacije/reda između uloga.
6. **`POST /api/chat` nije auth-gated** i veruje client-supplied `apiKey` (chat.ts:156) — bezbednosna rupa.

---

## FAZA 3 — STRAXOR Development Team Architecture (cilj)

```
                    USER
                     │
                STRAXOR CORE
                     │
        ┌────────────┴────────────┐
        │                         │
   AI AGENTS                 OpenCode Engine
 (Architect/UI/Backend/    (developer izvršilac,
  DB/Security/Testing)     sada: 1 proces / repo)
        │                         │
        └────────────┬────────────┘
                     │
             Project Workspace
           (.straxor-workspaces/<user>/<repo>)
                     │
                  GitHub
                     │
             Deploy / Runtime
```

### 3.1 Koji adapter nedostaje

| Sloj | Postoji? | Nedostaje |
|---|---|---|
| Agent Communication Layer | delimično (SSE /send) | fan-out na više uloga |
| OpenCode Adapter | ✅ opencode-universal | model-injekcija u spawn |
| GitHub Adapter | ✅ git-remote/registry | — |
| Project Context Manager | delimično (workspace) | zajednički deljeni kontekst |
| Shared Workspace | ✅ sandbox | deljenje između više uloga |
| Task Queue | ❌ | red zadataka između uloga |
| Agent Memory | ❌ | perzistentno pamćenje |
| Code Review Loop | delimično (diff/approve/reject) | automatski review korak |

---

## FAZA 4–7 — Implementacioni plan (predlog, čeka odobrenje)

> Cilj FAZA 1–3 je audit. Sledeći koraci su predlozi — ništa se ne piše dok korisnik ne odobri redosled.

1. **FAZA 7a — Model injekcija u OpenCode spawn** (`engine.ts`): proslediti `--model`/provider env iz `user_api_keys` + model-router ljestvice u spawn. Rešava gap 1.3 i omogućava "koristi opus za ovaj task".
2. **FAZA 4 — OpenCode Adapter (developer izvršilac)**: API da Agent panel može da šalje plan, traži izmene, pregleda diff, proverava greške, predloži popravke. Već 90% tu (diff/approve/reject) — treba vezati u flow.
3. **FAZA 5 — GitHub workflow**: poveži repo → učitaj projekat → analiziraj → plan → izvrši → diff → odobri → commit+push. Već delimično (repos.ts push). Nedostaje: "diff prikaz + odobravanje" kao ceo ciklus.
4. **FAZA 6 — App Builder kao tim**: UI/Backend/DB/Security agenti kao fan-out kroz `POST /agent/send` (već postoji `/orchestrate` za multi-model). Nedostaje: Task Queue + deljeni workspace između uloga.
5. **FAZA 7b — Agent Memory + Task Queue**: perzistencija job-ova u DB (tabela), red zadataka.

### Prioritet redosled (preporuka)

1. **Model injekcija u OpenCode** (unblokira sve — bez modela agent ne radi pouzdano).
2. **Auth fix za `/api/chat`** (bezbednost).
3. **Diff+odobri+push kao zatvoren ciklus** (FAZA 5).
4. **Multi-uloga (Architect/UI/Backend/DB/Security/Testing)** (FAZA 6).
5. **Agent Memory + Task Queue** (FAZA 7b).

---

## Dokazna baza / trenutno stanje (verifikovano)

- Testovima (vitest) pokriveni: model-router, crypto, github adapter.
- End-to-end dokazano: Agent → OpenCode lokalni → edit fajla u klonu (`// agent-test` na `server/src/index.ts:234`), lokalni commit `20ad249`.
- Push na GitHub **blokiran** jer origin URL nosi placeholder `ghp_xxxxxxxxxxxx` — treba pravi PAT unet kroz UI (GitRemotePanel → 🔑 Token, ili ⚙ PanelMenu → GitHub token → +, pa klikni slot da aktiviraš). Token je per-nalog (globalno), server koristi **default slot** (registry.ts:134).
