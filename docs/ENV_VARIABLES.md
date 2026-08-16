# STRAXOR — Environment Variables

> Referentni spisak svih env varijabli. `.env` je u `.gitignore` i nikada se ne
> commit-uje; ovde su isključivo **placeholder** vrednosti.

## Baza podataka

| Varijabla | Obavezno | Opis |
|-----------|----------|------|
| `DATABASE_URL` | ✅ produkcija | Postgres connection string (Neon) |

## Auth / kripto

| Varijabla | Obavezno | Opis |
|-----------|----------|------|
| `JWT_SECRET` | ✅ produkcija | JWT signing secret (dugačak slučajan string) |
| `ENCRYPTION_KEY` | preporučeno | 64-char hex seed za AES-256-GCM enkripciju tajni |

## GitHub OAuth

| Varijabla | Obavezno | Opis |
|-----------|----------|------|
| `GITHUB_CLIENT_ID` | ako se koristi OAuth | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | ako se koristi OAuth | GitHub OAuth App client secret |

## OpenCode / AI engine

| Varijabla | Obavezno | Opis |
|-----------|----------|------|
| `OPENROUTER_API_KEY` | opciono | Fallback provider za single-tenant instancu |
| `OPENCODE_MODEL` | opciono | Glavni model (npr. `openrouter/deepseek/deepseek-chat-v3-0324`) |
| `OPENCODE_SMALL_MODEL` | opciono | Mali model za engine |
| `OPENCODE_BIN` | opciono | Override za lokaciju opencode binary-ja |

## Preview

| Varijabla | Obavezno | Opis |
|-----------|----------|------|
| `PREVIEW_BASE_URL` | opciono | Spoljni base URL pod kojim se preview izlaže (`http://localhost:3001`) |

## Workspace / procesi / limiti

| Varijabla | Default | Opis |
|-----------|---------|------|
| `WORKSPACE_ROOT` | `.straxor-workspaces` | Koreni direktorijum sandbox radnih direktorijuma |
| `MAX_WORKSPACE_SIZE` | `512mb` | Maksimalna veličina workspace-a |
| `MAX_PROCESS_TIME` | `30m` | Maksimalno trajanje procesa/taska |
| `MAX_PREVIEW_STARTUP` | `3m` | Maksimalno čekanje da preview server odgovori |
| `MAX_PREVIEW_TIME` | `30m` | Maksimalan život preview instance |
| `CLEANUP_INTERVAL` | `5m` | Interval pozadinskog čistača |
| `TASK_WORKSPACE_TTL` | `24h` | Koliko se čuva task workspace posle završetka |

## Primer `.env`

```bash
DATABASE_URL=postgresql://user:password@host:5432/database
JWT_SECRET=change-me-long-random-string
ENCRYPTION_KEY=0000000000000000000000000000000000000000000000000000000000000000
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
OPENROUTER_API_KEY=
OPENCODE_MODEL=openrouter/deepseek/deepseek-chat-v3-0324
OPENCODE_SMALL_MODEL=openrouter/deepseek/deepseek-chat-v3-0324
PREVIEW_BASE_URL=http://localhost:3001
WORKSPACE_ROOT=.straxor-workspaces
MAX_WORKSPACE_SIZE=512mb
MAX_PROCESS_TIME=30m
MAX_PREVIEW_STARTUP=3m
MAX_PREVIEW_TIME=30m
CLEANUP_INTERVAL=5m
TASK_WORKSPACE_TTL=24h
```
