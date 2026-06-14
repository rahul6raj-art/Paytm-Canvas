# Production deploy — hosted services

Cutover runbook for **Neon Postgres**, **Upstash Redis**, **Cloudflare R2**, **Resend SMTP**, and custom domains. Builds on Track 16 manifests ([`deploy/`](../deploy/)) and Track 14 production auth.

## 1. Provision managed services

| Service | Suggested provider | Notes |
|---------|-------------------|--------|
| Postgres | [Neon](https://neon.tech) | Enable connection pooling; run migrations from CI or one-off job |
| Redis | [Upstash](https://upstash.com) | Use `rediss://` URL for TLS |
| Objects | [Cloudflare R2](https://developers.cloudflare.com/r2/) | Private bucket; public reads via custom domain or signed URLs |
| SMTP | [Resend](https://resend.com) | `smtp.resend.com:587`, user `resend`, API key as password |
| Web | Vercel or `deploy/web/Dockerfile` | Set `NEXT_PUBLIC_*` at build time |

Copy [`env.example.env`](./env.example.env) into your secrets store (Doppler, Vault, Fly secrets, K8s Secret).

## 2. Database migrations

From a machine with `DATABASE_URL` set:

```bash
cd packages/craft-api
npx prisma migrate deploy
npm run db:seed   # optional — dev/staging only; skip in prod unless intentional
```

## 3. R2 bucket + public domain

1. Create bucket `craft-assets` (or match `S3_BUCKET`).
2. Create R2 API token with Object Read & Write.
3. Bind custom domain `assets.craft.example.com` → bucket (or use `*.r2.dev` for staging).
4. Set `S3_ENDPOINT` to `https://<account_id>.r2.cloudflarestorage.com`.
5. Set `S3_PUBLIC_URL` to the public asset hostname (no trailing slash).

Block public ACLs; serve via CDN/custom domain only.

## 4. Deploy API + realtime

**Fly.io** — see [deploy/fly/README.md](../fly/README.md).

**Kubernetes** — see [deploy/k8s/README.md](../k8s/README.md). Use production values from `env.example.env` in the Secret; align `configmap.yaml` CORS/app URL with your web domain.

Health after deploy:

```bash
curl -fsS https://api.craft.example.com/health
curl -fsS https://sync.craft.example.com/
```

## 5. Deploy web (remote mode)

**Vercel** — project env vars from the `NEXT_PUBLIC_*` section of `env.example.env`. Run `npm run build:engine` in CI or commit `public/craft-engine/` artifacts.

**Self-hosted Docker**:

```bash
docker build -f deploy/web/Dockerfile \
  --build-arg NEXT_PUBLIC_PAYTM_CRAFT_API_URL=https://api.craft.example.com/v1 \
  --build-arg NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=wss://sync.craft.example.com/yjs \
  --build-arg NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL=https://assets.craft.example.com \
  -t craft-web .
```

## 6. TLS + WebSocket

Terminate TLS at your edge (Vercel, Fly, ALB, or [deploy/nginx/craft-proxy.conf](../nginx/craft-proxy.conf)). WebSocket path `/yjs` must support `Upgrade` and long `proxy-read-timeout` (see K8s ingress).

## 7. Cutover checklist

- [ ] `CRAFT_API_ALLOW_ANON=0` and `CRAFT_SYNC_ALLOW_ANON=0`
- [ ] `CRAFT_API_CORS_ORIGIN` matches web origin exactly (HTTPS)
- [ ] `CRAFT_APP_URL` set for invite email links
- [ ] SMTP vars set (or accept log-only invites)
- [ ] Prisma migrations applied
- [ ] R2 upload smoke: create asset via editor or `POST /v1/workspaces/:id/assets/upload-url`
- [ ] Sign-in flow works (session cookie `Secure` on HTTPS)
- [ ] Realtime: open file in two browsers, edits sync
- [ ] `npm run verify:stack:live` against prod URLs (set `CRAFT_API_BASE`, `CRAFT_SYNC_URL`, optional `CRAFT_API_TOKEN`)

## Verification (offline)

```bash
npm run verify:production
npm run verify:stack   # includes production template checks
```

See [docs/production-deploy-track.md](../../docs/production-deploy-track.md).
