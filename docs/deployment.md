# Paytm Craft — Deployment (planned)

This describes how to run **API**, **realtime**, **Postgres**, **Redis**, and **S3/R2-compatible storage** in development and production. The **current** repo ships a **standalone Next.js** app that works without any of these services.

## Topology

| Tier | Suggested |
|------|-----------|
| Web | Vercel, Netlify, or self-hosted Node (Next `standalone` Docker image) |
| API | Container on ECS/Fly.io/Kubernetes, or same host as monolith split |
| Realtime | Stateful WebSocket service (sticky sessions or single leader) |
| Postgres | RDS, Cloud SQL, Neon, or managed HA Postgres |
| Redis | ElastiCache, Upstash, or self-hosted Redis 7+ |
| Objects | AWS S3 or Cloudflare R2 with private bucket + signed URLs |

## Docker (development)

Example `docker-compose.yml` (future repo layout) would include:

- `postgres:16` with volume `pgdata`
- `redis:7-alpine`
- `minio/minio` (S3 API) with console on `:9001`
- `api` service built from `apps/api/Dockerfile`
- `realtime` service from `apps/realtime/Dockerfile`
- optional `web` or rely on `next dev` on host

Environment files:

- **API**: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `S3_*`, `CORS_ORIGINS`
- **Realtime**: same `DATABASE_URL` or dedicated read replica; `REDIS_URL` for presence
- **Web**: `NEXT_PUBLIC_PAYTM_CRAFT_API_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_MODE`

## Production hardening

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

No Docker is **required** for the editor demo; persistence is **browser localStorage** only until remote mode is implemented.

## See also

- [backend-architecture.md](./backend-architecture.md)
- [realtime-collaboration.md](./realtime-collaboration.md)
- `postgres:16` with volume `pgdata`
- `redis:7-alpine`
- `minio/minio` (S3 API) with console on `:9001`
- `api` service built from `apps/api/Dockerfile`
- `realtime` service from `apps/realtime/Dockerfile`
- optional `web` or rely on `next dev` on host

Environment files:

- **API**: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `S3_*`, `CORS_ORIGINS`
- **Realtime**: same `DATABASE_URL` or dedicated read replica; `REDIS_URL` for presence
- **Web**: `NEXT_PUBLIC_PAYTM_CRAFT_API_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL`, `NEXT_PUBLIC_PAYTM_CRAFT_MODE`

## Production hardening

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

No Docker is **required** for the editor demo; persistence is **browser localStorage** only until remote mode is implemented.

## See also

- [backend-architecture.md](./backend-architecture.md)
- [realtime-collaboration.md](./realtime-collaboration.md)
