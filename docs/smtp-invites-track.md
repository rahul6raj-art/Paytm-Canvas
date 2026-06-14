# Track 15 — SMTP invite notifications

**Status:** complete (phases 15.1–15.2)

Track 11 created pending workspace invites in the database. This track sends **optional SMTP email** when inviting an unregistered address.

## Goals

- Email template + sender when `CRAFT_SMTP_HOST` is set.
- `POST /v1/workspaces/:wsId/invites` returns `emailSent: true` when delivery succeeds.
- **Mailpit** in Docker compose for local inbox at http://localhost:8025.
- Graceful no-op when SMTP is unset (pending invite still saved).

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **15.1** | `inviteEmail` builder + `sendWorkspaceInviteEmail` (nodemailer) | **Done** |
| **15.2** | Mailpit compose + client success copy + docs | **Done** |

## Environment

| Variable | Example |
|----------|---------|
| `CRAFT_SMTP_HOST` | `mailpit` (compose) or `smtp.sendgrid.net` |
| `CRAFT_SMTP_PORT` | `1025` / `587` |
| `CRAFT_SMTP_FROM` | `Paytm Craft <noreply@yourco.com>` |
| `CRAFT_APP_URL` | `http://localhost:3000` (register link in email) |

## Manual

```bash
npm run stack:up && npm run stack:setup
npm run dev   # remote env + sign in
# Invite nobody.new@paytm.com → open http://localhost:8025
```

Host-run API (`npm run dev:remote`):

```bash
docker compose up -d mailpit
# packages/craft-api/.env: CRAFT_SMTP_HOST=localhost CRAFT_SMTP_PORT=1025
```

## Verification

```bash
npm run verify:stack
```

## Next

- K8s / Fly deploy manifests
- JWT or API tokens for service accounts
- Team switcher when multiple teams exist
