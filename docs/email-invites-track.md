# Track 11 — Email invites (pending)

**Status:** complete (phases 11.1–11.2)

Tracks 9–10 required registered users for workspace invites. This track adds **pending email invites** that convert to memberships on registration.

## Goals

- `workspace_invites` table for unregistered emails.
- `POST /v1/workspaces/:wsId/invites` — add member if user exists, else create pending invite.
- `GET /v1/workspaces/:wsId/invites` — list pending invites.
- Auto-accept pending invites on `POST /v1/auth/register`.
- Dashboard + editor UI show pending invites and updated success copy.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **11.1** | Prisma + craft-api routes + register hook | **Done** |
| **11.2** | Mock API + client + UI | **Done** |

## API

```bash
GET  /v1/workspaces/:wsId/invites
POST /v1/workspaces/:wsId/invites  { "email", "role?" }
# → { kind: "member", member } | { kind: "invite", invite }
```

`POST /v1/workspaces/:wsId/members` still requires an existing user (direct add).

## Verification

```bash
npm run verify:stack
```

Backend unit tests: `workspaceInvites` in `@paytm-craft/api`.

## Manual (remote)

```bash
npm run dev:remote
# Invite nobody.new@paytm.com to Experiments → pending invite
# Register that email → auto-joins workspace
```

## Next

- ~~Email delivery (SMTP) for invite notifications~~ (Track 15)
- K8s / Fly deploy manifests
- JWT or API tokens for service accounts
