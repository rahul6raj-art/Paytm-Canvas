# Track 20 — API token management UI

**Status:** complete (phases 20.1–20.2)

Track 19 added Bearer tokens on the backend. This track adds a **dashboard UI** to create, list, and revoke tokens in **remote** mode, plus optional expiry.

## Goals

- Team page → **API tokens** section when `NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote`.
- Create token with name + expiry preset (none / 30 / 90 / 365 days).
- One-time secret shown in alert after create.
- Optional `expiresInDays` on `POST /v1/auth/tokens`.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **20.1** | Token expiry backend + `apiTokenExpiry.ts` | **Done** |
| **20.2** | `DashboardApiTokensPanel` + `apiTokenManagement.ts` | **Done** |

## Manual

```bash
npm run dev:remote
# Dashboard → Team → API tokens (below workspace members)
```

## Verification

```bash
npm run verify:stack
```

## Next

- Scoped permissions — see [api-token-scopes-track.md](./api-token-scopes-track.md)
