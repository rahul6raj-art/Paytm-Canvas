# Track 10 — Editor team modals API

**Status:** complete (phases 10.1–10.2)

Track 9 wired the dashboard Team tab. This track brings the **editor workspace picker and invite modal** to the same members API.

## Goals

- `WorkspaceTeamModals` loads workspaces and members from the API in `api` / `remote` modes.
- Invite flow uses `POST /v1/workspaces/:wsId/members` (registered users only).
- Shared invite helper reused by dashboard and editor.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **10.1** | `workspaceTeamInvite.ts` shared helper | **Done** |
| **10.2** | `WorkspaceTeamModals` API wiring | **Done** |

## Client

- `inviteTeammateToWorkspace(workspaceId, email)` — shared validation + API call.
- Editor uses `apiWorkspaceId` from the open file when inviting (falls back to mock active workspace).
- Workspace picker lists API workspaces; highlights the file's workspace when API-backed.

## Verification

```bash
npm run verify:stack
```

Offline tests: `workspaceTeamInvite`, `dashboardTeamApi`.

## Manual

```bash
npm run dev:remote
# Open an API file → command menu → Invite teammate
# Or: workspace switcher shows API workspaces
```

## Next

- ~~Email invite flow for unregistered users~~ (Track 11)
- Full `teams` model per `docs/database-schema.md`
- Production auth hardening (JWT, anon disabled)
