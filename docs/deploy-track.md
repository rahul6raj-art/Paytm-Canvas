# Track 16 — Deploy manifests (K8s / Fly / web Docker)

**Status:** complete (phases 16.1–16.3)

Tracks 4–15 built the backend stack and production auth. This track adds **reference deploy artifacts** for staging and production outside local Docker Compose.

## Goals

- Kubernetes Deployments, Services, Ingress, ConfigMap, and secrets template.
- Fly.io `fly.toml` for `craft-api` and `craft-realtime`.
- Next.js `standalone` Docker image for self-hosted remote mode.
- NGINX example for TLS + WebSocket upgrade.
- Offline `verify:deploy` regression tests.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **16.1** | `deploy/k8s/*` + `deploy/fly/*` | **Done** |
| **16.2** | `deploy/web/Dockerfile` + `next.config` standalone | **Done** |
| **16.3** | `verify:deploy` + docs | **Done** |

## Layout

```
deploy/
  k8s/           # namespace, configmap, deployments, ingress
  fly/           # craft-api + craft-realtime fly.toml
  web/           # Next.js standalone Dockerfile
  nginx/         # reverse-proxy example
```

## Verification

```bash
npm run verify:deploy
npm run verify:stack   # includes deploy checks
```

## Manual deploy (Fly)

```bash
fly deploy -c deploy/fly/craft-api.fly.toml
fly deploy -c deploy/fly/craft-realtime.fly.toml
```

Set secrets (`DATABASE_URL`, `REDIS_URL`, `S3_*`, `CRAFT_API_CORS_ORIGIN`) per [deploy/fly/README.md](../deploy/fly/README.md).

## Next tracks

Integration tracks **2–36** are complete. See [tracks.md](./tracks.md).
