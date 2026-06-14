# Track 35 — Docker stack gate (offline)

**Status:** complete

Track 7 ships `docker-compose.yml`, `stack:up`, and `stack:setup` for the full local backend stack, but compose service wiring was only partially guarded via deploy manifest tests. This track adds an explicit offline gate for the Docker stack bundle.

## Goals

- **`src/lib/dockerStackManifest.ts`** — compose paths, required services, stack npm scripts, setup markers, Dockerfiles.
- **`npm run verify:docker-stack-gate`** — asserts compose defines postgres/redis/minio/mailpit/craft-api/craft-realtime; `stack:setup` chains db + storage bootstrap.
- Wire into **`verify:stack`**.

## Full Docker stack (unchanged)

```bash
npm run stack:up
npm run stack:setup
npm run dev:remote
```

Requires Docker. Builds and starts API, realtime, Postgres, Redis, MinIO, and Mailpit.

## Offline gate

```bash
npm run verify:docker-stack-gate
npm run verify:stack
```

## See also

- [release-track.md](./release-track.md) — Track 7 Docker stack + `verify:stack`
- [live-stack-gate-track.md](./live-stack-gate-track.md) — Track 33 live smoke wiring gate
