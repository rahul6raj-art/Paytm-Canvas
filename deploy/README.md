# Paytm Craft — deploy manifests

Reference manifests for running the **remote stack** outside local Docker Compose.

| Path | Purpose |
|------|---------|
| [k8s/](./k8s/) | Kubernetes Deployments, Services, Ingress |
| [fly/](./fly/) | Fly.io `fly.toml` for API + realtime |
| [production/](./production/) | **Track 25** — hosted Neon/R2/Resend env template + cutover runbook |
| [web/Dockerfile](./web/Dockerfile) | Next.js `standalone` image (remote mode) |
| [nginx/craft-proxy.conf](./nginx/craft-proxy.conf) | Example TLS reverse proxy (API + WebSocket) |

## Prerequisites

Managed services (not included in these manifests):

- **Postgres** — connection string for Prisma migrations
- **Redis** — Yjs persistence / pub-sub
- **S3-compatible storage** — asset uploads (R2, S3, etc.)

## Quick start

**Fly.io** (from repo root):

```bash
fly apps create craft-api
fly deploy -c deploy/fly/craft-api.fly.toml
fly secrets set DATABASE_URL=... REDIS_URL=... S3_ACCESS_KEY=... -a craft-api

fly apps create craft-realtime
fly deploy -c deploy/fly/craft-realtime.fly.toml
fly secrets set DATABASE_URL=... REDIS_URL=... -a craft-realtime
```

**Kubernetes** — copy `k8s/secrets.example.env`, fill values, then:

```bash
kubectl apply -f deploy/k8s/namespace.yaml
# create Secret from env file (see k8s/README.md)
kubectl apply -f deploy/k8s/
```

**Next.js web** (self-hosted):

```bash
docker build -f deploy/web/Dockerfile \
  --build-arg NEXT_PUBLIC_PAYTM_CRAFT_API_URL=https://api.example.com/v1 \
  --build-arg NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=wss://sync.example.com/yjs \
  --build-arg NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL=https://cdn.example.com/craft-assets \
  -t craft-web .
```

See [docs/deploy-track.md](../docs/deploy-track.md) for manifests (Track 16) and [production/README.md](./production/README.md) for hosted cutover (Track 25).
