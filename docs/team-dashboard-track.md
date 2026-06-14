# Track 9 — Dashboard team API

**Status:** complete (phases 9.1–9.2)

Track 8 added workspace RBAC and member endpoints on `craft-api`. This track wires the **dashboard Team UI** to those APIs in `api` and `remote` modes.

## Goals

- Load workspace members for sidebar avatars and Team tab from `GET /v1/workspaces/:wsId/members`.
- Invite teammates via `POST /v1/workspaces/:wsId/members` (existing registered users).
- Mock API parity — Next.js `/api/v1/workspaces/:wsId/members` backed by `mockApiStore`.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **9.1** | `apiClient` + mock store + route handlers | **Done** |
| **9.2** | `DashboardShell` / sidebar team preview + invites | **Done** |

## Client

- `apiClient.listWorkspaceMembers(workspaceId)`
- `apiClient.inviteWorkspaceMember(workspaceId, { email, role? })`
- `dashboardApiAdapters` maps API roles (`owner` / `admin` / `member` / `guest`) to sidebar badges.

## Verification

```bash
npm run verify:stack
```

Offline tests: `dashboardApiAdapters`, `mockApiStoreMembers`.

## Manual (remote)

```bash
npm run dev:remote
# Sign in: rahul.verma@paytm.com / craft-dev
# Dashboard → Team → Paytm Design should list Aisha, Dev, Meera
# Invite dev.sharma@paytm.com to Experiments (already registered in seed)
```

## Next

- ~~Editor `WorkspaceTeamModals` parity with API members~~ (Track 10)
- Email invite flow for users not yet registered
- Full `teams` model per `docs/database-schema.md`
