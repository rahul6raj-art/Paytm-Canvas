# Track 23 — Per-resource API token scopes

**Status:** complete (phases 23.1–23.2)

Track 21 added coarse `read` / `write` scopes. This track adds **granular resource permissions** (`files:read`, `assets:write`, …) enforced per HTTP route and on realtime sync.

## Goals

- `resourceScopes: string[]` on `api_tokens` (empty = legacy `scope` preset applies).
- HTTP middleware maps `/v1/*` paths to required scopes.
- Realtime writes require `realtime:write` when using custom scopes.
- Dashboard **Custom** scope mode with per-resource checkboxes.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **23.1** | Prisma `resource_scopes` + `apiTokenResourceScope` helpers + middleware | **Done** |
| **23.2** | Token create API + dashboard custom scope UI | **Done** |

## Resource scopes

| Scope | Grants |
|-------|--------|
| `files:read` | GET `/files`, file detail, versions |
| `files:write` | POST/PUT files, versions, restore |
| `assets:read` | GET workspace assets |
| `assets:write` | Upload / register assets |
| `comments:read` | GET comments |
| `comments:write` | POST/PATCH/DELETE comments |
| `teams:read` | GET teams, members |
| `teams:write` | Team/member/invite mutations |
| `workspaces:read` | GET `/workspaces` |
| `realtime:write` | WebSocket `sync` / `awareness` writes |

Legacy presets still work: `scope: "read"` expands to all `*:read`; `scope: "write"` grants everything including `realtime:write`.

## API

```json
POST /v1/auth/tokens
{
  "name": "Exporter",
  "scope": "write",
  "resourceScopes": ["files:read", "assets:read"]
}
```

## Verification

```bash
npm run verify:stack
```

## Next

- Mock API bearer tokens in `api` mode — see [mock-api-tokens-track.md](./mock-api-tokens-track.md)
