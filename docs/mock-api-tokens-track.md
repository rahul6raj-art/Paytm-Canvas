# Track 24 — Mock API bearer tokens (`api` mode)

**Status:** complete (phases 24.1–24.2)

Track 20–23 added API tokens on the remote Docker stack. This track brings the same **token UI and Bearer auth** to **`api` mode** (`/api/v1` mock routes) so you can develop without Docker.

## Goals

- `POST/GET/DELETE /api/v1/auth/tokens` backed by `mockApiStore`.
- Dashboard **API tokens** panel in `NEXT_PUBLIC_PAYTM_CRAFT_MODE=api`.
- Bearer `craft_pat_*` tokens authenticate mock routes; granular `resourceScopes` enforced on files/comments/workspaces.
- No bearer header → existing dev behavior (full mock access).

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **24.1** | `mockApiStore` token CRUD + `/api/v1/auth/tokens` routes | **Done** |
| **24.2** | Bearer guards on mock routes + dashboard panel in api mode | **Done** |

## Manual

```bash
NEXT_PUBLIC_PAYTM_CRAFT_MODE=api npm run dev
# Dashboard → Team → API tokens
# Use token: Authorization: Bearer craft_pat_…
```

## Verification

```bash
npm run verify:stack
```

## Next

- Native renderer maintenance (Track 1 terminal at v3.43)
