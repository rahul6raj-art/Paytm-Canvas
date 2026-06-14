# Track 25 — Production deploy (hosted Postgres, R2, SMTP, domains)

**Status:** complete (phases 25.1–25.2)

Track 16 added K8s/Fly **manifests**. This track adds the **production cutover kit**: hosted-service env templates, runbook, and offline validation — not a live prod deployment (that requires your accounts and secrets).

## Goals

- `deploy/production/env.example.env` — Neon + Upstash + R2 + Resend + domain placeholders.
- `deploy/production/README.md` — migrations, R2, TLS/WS, cutover checklist.
- `productionDeployChecks` + `npm run verify:production`.
- Wire into `verify:stack`.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **25.1** | Production env template + runbook | **Done** |
| **25.2** | Offline checks + docs + verify script | **Done** |

## Manual cutover (your infra)

1. Copy `deploy/production/env.example.env` → secrets manager.
2. Provision Neon, Upstash, R2, Resend; fill values.
3. `prisma migrate deploy` against production `DATABASE_URL`.
4. Deploy API/realtime (Fly or K8s) + web (Vercel or `deploy/web/Dockerfile`).
5. Run cutover checklist in `deploy/production/README.md`.
6. Optional: `CRAFT_API_BASE=… npm run verify:stack:live` against prod.

## Verification

```bash
npm run verify:production
npm run verify:stack
```

## Next

- **Track 26** — Figma canvas chrome (editor UX)
- **Track 27** — Legacy renderer cleanup
