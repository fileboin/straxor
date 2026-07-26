# Security TODO

## Riješeno

### ✅ API ključevi — premješteni iz localStorage u DB, enkriptovano (AES-256-GCM)
- **Status:** Riješeno u Block 10 (Security hardening)
- **Rješenje:** 
  - `server/src/lib/crypto.ts` — AES-256-GCM enkripcija/dekripcija
  - Nova DB tabela `user_api_keys` sa enkriptovanim ključevima
  - API rute `/api/api-keys` za CRUD operacije
  - Frontend koristi server API umjesto localStorage
  - ENCRYPTION_KEY env varijabla za enkripcijski ključ

### ✅ SSH ključevi/lozinke — enkriptovani u bazi
- **Status:** Riješeno u Block 10 (Security hardening)
- **Rješenje:**
  - SSH password i privateKey se enkriptuju prije spremanja u DB
  - Dekriptuju se samo pri SSH konekciji (provisioning)
  - GET rute vraćaju maskirane podatke (••••••••)
  - Kompatibilno sa postojećim neenkriptovanim zapisima (backward compatible)

## Otvoreno

- [ ] Rate limiting na API endpointima
- [ ] CORS hardening za produkciju
- [ ] Input sanitization / validation
- [ ] SQL injection zaštita (Drizzle ORM već štiti)
- [ ] XSS zaštita (React escapeuje po defaultu)
