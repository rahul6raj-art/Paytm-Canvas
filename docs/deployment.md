# Paytm Craft — Deployment

The **default** app is a standalone Next.js editor (localStorage). This document covers the **optional full stack** (Tracks 4–7): Postgres, Redis, MinIO, `craft-api`, `craft-realtime`, and remote-mode Next.js.

## Topology

| Tier | Suggested |
|------|-----------|
| Web | Vercel, Netlify, or self-hosted Node (Next `standalone` Docker image) |
| API | `packages/craft-api` container (ECS/Fly/K8s) — see [deploy/](../deploy/) |
| Realtime | `packages/craft-realtime` container (WebSocket, sticky sessions) — see [deploy/](../deploy/) |
| Postgres | RDS, Neon, or managed HA Postgres |
| Redis | ElastiCache, Upstash, or Redis 7+ |
| Objects | S3 or Cloudflare R2 (MinIO locally) |

## Docker (development / staging)

**Infrastructure only** (host-run API with `npm run api:dev`):

```bash
npm run db:up
npm run stack:setup
npm run api:dev
npm run sync:dev
```

**Full containerized stack** (API + realtime in Docker):

```bash
npm run stack:up
npm run stack:setup
```

Then run Next.js on the host with remote env (see `.env.example`) or use `npm run dev:remote` for a host-run overlay.

Services:

| Service | URL |
|---------|-----|
| craft-api | http://localhost:4000/v1 |
| craft-realtime | ws://localhost:4001/yjs |
| MinIO | http://localhost:9000 (console :9001) |
| Mailpit (invite emails) | http://localhost:8025 (SMTP :1025) |
| Postgres | localhost:5432 |

MinIO console: [http://localhost:9001](http://localhost:9001) (`craft` / `craftcraft`).

Environment files:

- **API**: `DATABASE_URL`, `REDIS_URL`, `S3_*`, `CRAFT_API_ALLOW_ANON`
- **Realtime**: `DATABASE_URL`, `REDIS_URL`, `CRAFT_SYNC_*`
- **Web**: `NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote`, `NEXT_PUBLIC_PAYTM_CRAFT_API_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL`

## Verification

```bash
npm run verify:stack          # offline Tracks 2–36
npm run verify:stack:live     # live Docker stack (see live-stack-track.md)
npm run verify:production     # production env template + runbook (Track 25)
npm run verify:release        # verify:stack + verify:migration (full release gate)
npm run verify:ci             # Rust checks + verify:release (GitHub Actions)
npm run verify:migration      # Native renderer + WASM (Track 1)
```

CI runs `npm run verify:ci` — see `.github/workflows/ci.yml` and [ci-release-gate-track.md](./ci-release-gate-track.md).

## Production hardening (Track 14)

- **`CRAFT_API_ALLOW_ANON=0`** — require session cookie on `/v1/*` (except `/v1/auth/*`).
- **`CRAFT_API_CORS_ORIGIN`** — comma-separated allowed origins (required in production profile).
- **`CRAFT_API_COOKIE_SECURE=1`** — `Secure` flag on `craft_sid` (auto when `CRAFT_API_ENV=production`).
- **`docker-compose.prod.yml`** — `npm run stack:prod` for auth-required stack.

See [production-track.md](./production-track.md).

## Deploy manifests (Track 16)

Reference Kubernetes and Fly.io configs live under [`deploy/`](../deploy/). Self-hosted Next.js uses `deploy/web/Dockerfile` (`output: standalone`).

```bash
npm run verify:deploy
```

See [deploy-track.md](./deploy-track.md).

## Production deploy (Track 25)

Hosted cutover kit for **Neon Postgres**, **Upstash Redis**, **Cloudflare R2**, **Resend SMTP**, and custom domains:

- [`deploy/production/env.example.env`](../deploy/production/env.example.env) — secrets template
- [`deploy/production/README.md`](../deploy/production/README.md) — runbook + cutover checklist

```bash
npm run verify:production
```

See [production-deploy-track.md](./production-deploy-track.md). Live prod deploy still requires your accounts and filled secrets.

## Live stack smoke test (Track 18)

Against a running Docker stack (`npm run stack:up && npm run stack:setup`):

```bash
npm run verify:stack:live
```

Offline contract tests run inside `npm run verify:stack`. See [live-stack-track.md](./live-stack-track.md).

## API tokens (Track 19)

Personal access tokens (`craft_pat_*`) for Bearer auth in CI and scripts. See [api-tokens-track.md](./api-tokens-track.md), [api-token-ui-track.md](./api-token-ui-track.md), and [api-token-scopes-track.md](./api-token-scopes-track.md).

## Production hardening (infra)

- **Secrets**: KMS / Doppler / Vault; rotate JWT signing keys.
- **DB**: migrations in CI; backups + PITR; connection pooling (PgBouncer).
- **WS**: TLS via reverse proxy (nginx, Caddy, ALB); idle timeouts; max message size.
- **R2/S3**: block public ACLs; lifecycle rules for abandoned uploads.

## Current local app (this repository)

```bash
npm install
npm run dev
npm run build
```

No Docker is **required** for the editor demo; persistence is **browser localStorage** by default. Use **`api`** or **`remote`** mode for HTTP-backed file sessions.

## Native GPU renderer (WASM)

The optional **native** renderer serves prebuilt WASM from `public/craft-engine/`. Build artifacts before deploy:

```bash
# Requires Rust + wasm-pack (see docs/native-renderer-migration.md)
npm run build:engine
npm run verify:engine
npm run verify:golden
npm run test:all          # cargo test + TS tests + verify scripts
npm run build:with-engine   # engine + Next.js production build
```

Runtime env (browser):

| Variable | Value |
|----------|--------|
| `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER` | `native` |
| `NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY` | `false` to disable WASM undo (default **on** for native) |
| `NEXT_PUBLIC_PAYTM_CRAFT_DEBUG_CANVAS` | `true` (optional; footer GPU readout) |

**CI / Vercel:** Either run `build:engine` in the build image (install Rust + `wasm-pack`) or commit built files under `public/craft-engine/` and run `npm run verify:engine` before `next build`. GitHub Actions runs `npm run verify:ci` (Rust tests + full `verify:release`) — see `.github/workflows/ci.yml`.

Headless PNG export (no browser):

```bash
npm run build:engine
npm run render:native -- fixtures/golden-tile-scene.json /tmp/scene.png
```

## See also

- [backend-architecture.md](./backend-architecture.md)
- [realtime-collaboration.md](./realtime-collaboration.md)
- [native-renderer-migration.md](./native-renderer-migration.md)
