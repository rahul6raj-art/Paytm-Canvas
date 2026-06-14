# Track 19 — API tokens (Bearer auth)

**Status:** complete (phases 19.1–19.2)

Tracks 14–18 hardened production auth with **session cookies** only. This track adds **personal access tokens** (`craft_pat_*`) for CI, scripts, and service-style clients.

## Goals

- `Authorization: Bearer craft_pat_…` on `craft-api` `/v1/*` (same RBAC as session user).
- Token CRUD at `/v1/auth/tokens` (requires **session cookie** — not bearer).
- Realtime `/yjs` accepts API tokens via `sessionToken` in join message.
- `CRAFT_API_TOKEN` env for `verify:stack:live` without login.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **19.1** | Prisma `api_tokens` + middleware + routes | **Done** |
| **19.2** | Client helpers + live smoke bearer path + docs | **Done** |

## API

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/v1/auth/tokens` | Session cookie |
| `POST` | `/v1/auth/tokens` `{ name }` | Session cookie → returns `token` once |
| `DELETE` | `/v1/auth/tokens/:id` | Session cookie |
| `GET` | `/v1/workspaces` (etc.) | Session cookie **or** Bearer token |

Token format: `craft_pat_<base64url>` (stored as SHA-256 hash).

## Create a token

```bash
# Sign in via browser or POST /v1/auth/login, then:
curl -b cookies.txt -X POST http://localhost:4000/v1/auth/tokens \
  -H 'Content-Type: application/json' \
  -d '{"name":"CI deploy"}'
```

Use in scripts:

```bash
export CRAFT_API_TOKEN=craft_pat_…
CRAFT_API_ALLOW_ANON=0 npm run verify:stack:live
```

## Verification

```bash
npm run verify:stack
npm run verify:backend   # includes apiToken.test.ts
```

## Next

- Scoped permissions — see [api-token-scopes-track.md](./api-token-scopes-track.md)
