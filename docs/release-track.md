# Track 7 — Release & deploy polish

**Status:** complete (phases 7.1–7.3)

Tracks 1–6 are complete. This track packages the **full backend stack** for Docker and adds a **unified verification** entry point.

## Goals

- **Docker images** for `craft-api` and `craft-realtime`.
- **docker-compose** runs Postgres, Redis, MinIO, API, and realtime together.
- **`verify:stack`** — one command for Tracks 2 + 4–6 offline regression.
- **`stack:setup`** — migrate, seed, and MinIO bucket after containers are up.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **7.1** | `verify:stack` + CI consolidation | **Done** |
| **7.2** | Dockerfiles + compose services | **Done** |
| **7.3** | `stack:up` / `stack:setup` scripts + docs | **Done** |

## Docker full stack

```bash
npm run stack:up      # build + start all services
npm run stack:setup   # migrate, seed, MinIO bucket (from host)
npm run dev           # Next.js — set remote env (see .env.example)
```

Or keep using the Node dev overlay:

```bash
npm run dev:remote    # host-run api + sync + Next (no container rebuild)
```

## Verification

```bash
npm run verify:stack
npm run verify:docker-stack-gate   # offline compose wiring (Track 35)
```

Includes `verify:persistence`, `verify:backend`, and `verify:remote`.

`npm run db:up` starts **Postgres, Redis, and MinIO** only. `npm run stack:up` also builds and starts **craft-api** and **craft-realtime** containers.

## Related docs

- [deployment.md](./deployment.md)
- [backend-track.md](./backend-track.md)
