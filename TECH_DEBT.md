# Tech Debt

## ✅ SSH disconnect — agent streaming (FIXED)

**Pronađeno:** Block 11 (live SSE streaming)
**Fajlovi:** `server/src/routes/agent.ts`, `server/src/runtime/opencode-adapter/ssh.ts`

### Riješeni problemi

#### 1. sseStream error handler prazan (agent.ts)
`stream.on("error")` → `finish({ abort: true })`. Stream `error`/`close` uvijek završava odgovor i aborta remote opencode.

#### 2. ssh.client error/close eventi nisu handleani
`execStream` u `ssh.ts` nakon rezolucije unistava channel na client `error`/`close` (mid-command drop → stream `error`/`close` kod pozivaoca). `openEventStream` u `opencode.ts` ima dodatne client `error`/`close` listenere koji čiste i SSH i stream.

#### 3. Partial SSE buffer se gubi
`finish({ flush: true })` (default) izbacuje nedovršeni `buffer` kao `[partial data flushed: ...]` event pri zatvaranju.

#### 4. Nema timeout-a
- SSH: `readyTimeout: 15s`, keepalive interval 10s (max 3 propuštena), connect timeout 20s.
- SSE: 30-min hard timeout na cijelu konekciju + 15s comment heartbeat (proxy keep-alive).

#### 5. Client disconnect ne prekida remote poruku
`req.on("close")` → `finish({ abort: true })` → `POST /session/:id/abort` na remote opencode.

### Dodatno za pouzdanost (100%)
- **Sve `res.write` pozive** pokriva `send()` — no-op nakon što je response zatvoren (nema crash-a pri mid-write disconnect).
- **`session.idle` filtriran po `sessionID`** — event drugog sessiona na istom opencode serveru ne prekida naš streaming rano.
- **SSE heartbeat komentari** (`: ping`) svakih 15s — proxy/load-balancer ne zatvara idle konekciju.
- `exec` u `ssh.ts` odbija promise na client `error`/`close` tokom komande.
