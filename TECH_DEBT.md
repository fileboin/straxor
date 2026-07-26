# Tech Debt

## 🔴 SSH disconnect — agent streaming

**Pronađeno:** Block 11 (live SSE streaming)
**Fajlovi:** `server/src/routes/agent.ts`, `server/src/runtime/opencode-adapter/ssh.ts`

### Problemi

#### 1. sseStream error handler prazan (agent.ts:244)
`error` event ne poziva `finish()`. Ako stream emituje error bez kasnijeg `close`, konekcija visi zauvijek — resource leak.

#### 2. ssh.client error/close eventi nisu handleani (agent.ts:134-140)
Ako TCP padne (half-open, network timeout), ssh.client emituje `error`/`close` ali naš kod to ne čuje. sseStream možda nikad ne emituje `close`. Rezultat: beskonačno visanje.

#### 3. Partial SSE buffer se gubi (agent.ts:174-180)
Ako SSH padne usred SSE chunka, `sseBuffer` sadrži nedovršeni event. `finish()` ga nikad ne parsira — zadnji događaj se tiho gubi.

#### 4. Nema timeout-a
Ako SSH konekcija tiho umre (nema error/close eventa), konekcija visi zauvijek. Nema keepalive-a, nema heartbeat-a.

#### 5. Client disconnect ne prekida remote poruku (agent.ts:302-304)
`req.on("close")` zatvara SSH, ali opencode na remote serveru nastavlja obrađivati poruku. Nema abort poziva ka opencode instanci.

### Prioritet
- **#1 i #2:** Prije javnog lansiranja — resource leak + hang
- **#3:** UX problem — gubitak zadnjeg eventa
- **#4:** Infra problem — resource leak u produkciji
- **#5:** Niski prioritet — opencode će sam završiti, samo troši resurse

### Planirano rješenje
- `sseStream.on("error")` → pozovi `finish()`
- `ssh.client.on("error"/"close")` → pozovi `finish()`
- Flush `sseBuffer` pri zatvaranju (parsiraj šta se može)
- 30-min timeout na cijelu konekciju
- `POST /session/:id/abort` pri client disconnect
