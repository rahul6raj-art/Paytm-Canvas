# Track 21 — Scoped API tokens

**Status:** complete (phases 21.1–21.2)

Track 20 added token management UI. This track adds **read-only vs read/write** scopes enforced on HTTP and realtime.

## Goals

- `scope: "read" | "write"` on `api_tokens` (default `write` for existing rows).
- Read tokens: **GET/HEAD** only on `/v1/*` → `403` on mutations.
- Read tokens: realtime **join + receive**; `sync` / `awareness` writes blocked.
- Dashboard scope picker when creating tokens.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **21.1** | Prisma scope + middleware `enforceApiTokenScope` | **Done** |
| **21.2** | Realtime write guard + UI scope column/picker | **Done** |

## API

```json
POST /v1/auth/tokens
{ "name": "CI read", "scope": "read", "expiresInDays": 90 }
```

Session cookies are unaffected (full access).

## Verification

```bash
npm run verify:stack
```

## Next

- Release bundle — see [integration-release-track.md](./integration-release-track.md) and [tracks.md](./tracks.md)
