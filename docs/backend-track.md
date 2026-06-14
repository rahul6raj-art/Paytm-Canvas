# Track 4 — Postgres backend scaffold

**Status:** complete (phases 4.1–4.5)

Tracks 1–3 are complete. This track adds a **real** HTTP API backed by **Postgres**, consumable via `NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote`.

## Goals

- **Postgres** as canonical store for users, workspaces, files, comments, versions.
- **`packages/craft-api`** — standalone Node service implementing `/v1/*` (same envelope as mock Route Handlers).
- **Docker Compose** — local Postgres + Redis for development.
- **No change** to `local` / `api` mock modes.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **4.1** | Docker Compose + Prisma schema + `craft-api` `/v1` routes | **Done** |
| **4.2** | Auth (register/login, sessions) | **Done** |
| **4.3** | Hocuspocus realtime + Postgres Yjs persistence | **Done** |
| **4.4** | Object storage (MinIO / R2 signed uploads) | **Done** |
| **4.5** | `dev:remote` stack + `verify:backend` CI | **Done** |

## Architecture

```
Next.js (remote mode)
    ↓ NEXT_PUBLIC_PAYTM_CRAFT_API_URL
packages/craft-api :4000/v1
    ↓ Prisma
Postgres (docker compose)

Next.js (realtime)
    ↓ NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL
packages/craft-realtime :4001/yjs
    ↓ onLoadDocument / onStoreDocument
Postgres (file_yjs_states) + Redis presence (optional)

MinIO / S3 (docker compose :9000)
    ↓ presigned PUT + multipart upload
packages/craft-api /v1/workspaces/:wsId/assets/*
    ↓ assets table
Postgres
```

## Dev usage

```bash
# Terminal 1 — databases
npm run db:up

# Terminal 2 — apply schema + seed
npm run db:setup

# Terminal 3 — API server
npm run api:dev

# Terminal 4 — Postgres-backed Yjs sync (replaces mock relay for remote)
npm run sync:dev

# Terminal 5 — web app in remote mode
NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote \
NEXT_PUBLIC_PAYTM_CRAFT_API_URL=http://localhost:4000/v1 \
NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=ws://localhost:4001/yjs \
npm run dev
```

Or one command (requires Docker):

```bash
npm run dev:remote
```

`dev:remote` starts **craft-api**, **craft-realtime** (`ws://localhost:4001/yjs`), and Next.js in remote mode.

## Verification

```bash
curl -s http://localhost:4000/v1/me | jq .
curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rahul.verma@paytm.com","password":"craft-dev"}' -c cookies.txt
npm run verify:backend
```

Seeded dev login: `rahul.verma@paytm.com` / `craft-dev` (after `npm run db:setup`).

**Object storage** (after `npm run db:up`):

```bash
npm run storage:setup
curl -s http://localhost:4000/v1/workspaces/ws-paytm-design/assets/health | jq .
```

## Related docs

- [backend-architecture.md](./backend-architecture.md)
- [database-schema.md](./database-schema.md)
- [api-contracts.md](./api-contracts.md)
- [deployment.md](./deployment.md)
