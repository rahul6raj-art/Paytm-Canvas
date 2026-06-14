# Track 12 — Teams model

**Status:** complete (phases 12.1–12.2)

Tracks 8–11 scoped access at the workspace level. This track adds the **`teams` / `team_members`** layer from `docs/database-schema.md` with workspace inheritance.

## Goals

- `teams` and `team_members` tables; `workspaces.team_id` FK.
- Workspace slug unique **per team** (`team_id`, `slug`).
- Access: `workspace_members` overrides `team_members` when present.
- API: `GET /v1/teams`, `GET /v1/teams/:teamId/members`; workspaces include `teamId`.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **12.1** | Prisma + migration + seed + access inheritance | **Done** |
| **12.2** | Mock API + `apiClient.listTeams()` | **Done** |

## Access model

```
effectiveRole = workspace_members.role ?? team_members.role (for workspace.team_id)
```

Users see workspaces they can access via **either** direct workspace membership **or** team membership.

## API

```bash
GET /v1/teams
GET /v1/teams/:teamId/members
GET /v1/workspaces   # each row includes teamId
```

## Verification

```bash
npm run verify:stack
```

Backend: `teamAccess` in `@paytm-craft/api`. Client: `teamsApi` mock store tests.

## Manual

```bash
npm run stack:setup   # applies migration + seed
npm run dev:remote
# u4 (team guest) can read Experiments via team inheritance
# ws-paytm-design workspace override keeps u4 as guest there too
```

## Next

- ~~Dashboard UI grouped by team~~ (Track 13)
- Production auth hardening (JWT, anon disabled)
- SMTP invite notifications
