# AUDIT LOG — Straxor VPS/SSH Stack
> Generisano: 2026-08-10  
> Stanje: HITAN RESET — SSH/VPS tok nikad nije radio end-to-end

---

## TL;DR — Zašto SSH nikad ne radi

### Root cause #1 — `parseSshTarget` bira POGREŠAN token
`tokens[tokens.length - 1]` uzima ZADNJI token iz prostora.
Ako korisnik unese `ssh root@91.99.126.64 -L 8080:...`, zadnji token je `-L`, pa host bude `8080:localhost:8080`.
**Ovo je uzrok `ENOTFOUND 22`** — korisnik je u host polje uneo `91.99.126.64 22` ili sličan string sa razmakom, a zadnji token je bio `22`.

### Root cause #2 — Parsing je suvišan jer forma već ima odvojena polja
Forma ima `host`, `port`, `username` kao **odvojena polja**. Parser `parseSshTarget` treba samo za convenience `ssh root@host` format, ali ga komplikuje situaciju kad korisnik unese čist IP.

### Root cause #3 — Retry kreira duplikate u bazi
Svaki klik na "Pokušaj ponovo" → "Poveži i pokreni" insertuje novi machine record. Nema deduplication constrainta.

### Root cause #4 — `getOpenCodePort` nikad ne radi na VPS-u
`ss -tlnp | grep 'opencode'` vraća prazan string na 90% VPS-ova (non-root, stariji iproute2). Port se ne detektuje, DB čuva pogrešan port.

### Root cause #5 — Port race condition
`pkill` + `isPortAvailable` bez sleep = stari proces još živi, port još zauzet → fallback loop → opencode startuje na port+1, ali DB upisuje originalni port.

---

## SSH Bugovi

| # | Fajl:linija | Opis | Status |
|---|---|---|---|
| 1 | `SshInput.tsx:~58`, `machines.ts:~51` | `tokens[last]` bira zadnji whitespace token — jedini uzrok ENOTFOUND greške sa "22" | **CRITICAL — FIKSIRATI** |
| 2 | `provisioner.ts:~137` | `pkill` bez sleep → race condition → port zauzet → fallback → pogrešan port u DB | FIKSIRATI |
| 3 | `provisioner.ts:~147` | Port fallback loop ne baca error kad svi portovi zauzeti, vraća originalni zauzeti port | FIKSIRATI |
| 4 | `provisioner.ts:~179` | `ss -tlnp \| grep 'opencode'` ne radi na non-root VPS-ovima | FIKSIRATI |
| 5 | `SshInput.tsx:~295` | `[DONE]` SSE event uzrokuje `throw` na kraju petlje čak i ako je provisioning uspeo | FIKSIRATI |
| 6 | `SshInput.tsx:~352` | Retry dugme ne briše failed machine record → duplikati u DB | FIKSIRATI |

---

## Route Bugovi

| # | Fajl:linija | Opis |
|---|---|---|
| 1 | `machines.ts:~265` | `body.name ?? body.name` (5x isti key) — snake_case aliases ne postoje za `name`, `host`, `port`, `username`, `password` |
| 2 | Nedostaje | Nema `PATCH /api/machines/:id` — jedini način ispravke kredencijala je delete + recreate |
| 3 | `machines.ts:~336` | `opencodePort: 4096` hardkodiran na insert, mora biti NULL ili dinamičan |

---

## UI Bugovi

| # | Fajl:linija | Opis |
|---|---|---|
| 1 | `Workspace.tsx:~171` | `projectId` inicijalizovan sa URL slug pre async resolve → SSH modal može dobiti pogrešan projectId |
| 2 | `Workspace.tsx:~181` | `found \|\| list[0]` silently otvara PRVI projekat ako URL ne matchuje → nema 404 ni upozorenja |
| 3 | `SshInput.tsx:~295` | `[DONE]` → `continue` + fallthrough → false-negative greška "Provisioning prekinut" |
| 4 | Topbar | SSH dugme ostaje zaglavljeno na "Spajanje..." kada provisioning padne bez SSE error eventa |
| 5 | `App.tsx:~101` | GitHub OAuth callback omotan sa `<GuestRoute>` → authenticated user ne može re-linkovati GitHub |

---

## Mrtav Kod

| Duplikat | Fajl A | Fajl B |
|---|---|---|
| `parseSshTarget()` — 47 linija | `machines.ts:37` | `SshInput.tsx:44` |
| `stripMarkdown()` — 11 linija | `machines.ts:24` | `SshInput.tsx:31` |
| `normalizeHost()` — 1 linija | `machines.ts:86` | `SshInput.tsx:93` |
| `normalizeProjectRef()` — 9 linija | `machines.ts:103` | `Workspace.tsx:157` |
| `isBlockedLocalHost()` / `isLikelyPrivateHost()` | `machines.ts:90` | `SshInput.tsx:97` |
| `getOpenCodeVersion/Pid/Uptime/Packages` | `provisioner.ts:163+` | nigde ne importovano |

---

## Plan fikseva (redosledom prioriteta)

1. **ODMAH** — `SshInput.tsx`: Ukloniti `parseSshTarget` sa forme. Svako polje (host, port, username) prima samo čist trim + stripMarkdown. Nema više "pametnog" parsiranja.
2. **ODMAH** — `machines.ts`: Isto — direktan trim per-field, bez parseSshTarget na backend POST.
3. **Odmah** — `provisioner.ts`: Sleep 2s posle pkill, fix port fallback loop, fix getOpenCodePort.
4. **Odmah** — `SshInput.tsx`: Fix [DONE] handling i retry flow (reuse mašine).
5. **Kad bude vremena** — Izvuci shared utils u `server/src/lib/ssh-utils.ts` i `client/src/lib/ssh-utils.ts`.
6. **Kad bude vremena** — Dodati `PATCH /api/machines/:id` za update kredencijala.
