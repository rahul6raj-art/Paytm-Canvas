# Track 8 — Workspace RBAC

**Status:** complete (phases 8.1–8.2)

Track 7 packaged the deploy stack. This track adds **workspace-scoped access control** to `craft-api`.

## Goals

- **`workspace_members`** table with roles: `owner`, `admin`, `member`, `guest`.
- **Scoped listings** — users only see workspaces and files they belong to.
- **Mutation guards** — create/edit files, comments, and assets require `member+`.
- **Member API** — list and invite workspace members.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **8.1** | Prisma schema + seed memberships | **Done** |
| **8.2** | Route guards + `/v1/workspaces/:wsId/members` | **Done** |

## Roles

| Role | Read | Edit files | Invite members |
|------|------|------------|----------------|
| `guest` | yes | no | no |
| `member` | yes | yes | no |
| `admin` | yes | yes | yes |
| `owner` | yes | yes | yes (+ assign owner) |

Set `CRAFT_API_RBAC=0` to disable checks (open dev mode).

## API

```bash
GET  /v1/workspaces/:wsId/members
POST /v1/workspaces/:wsId/members  { "email", "role" }
```

## Verification

```bash
npm run verify:stack
```

Re-seed after pulling: `npm run stack:setup`

## Related docs

- [database-schema.md](./database-schema.md)
- [api-contracts.md](./api-contracts.md)
- [backend-track.md](./backend-track.md)
