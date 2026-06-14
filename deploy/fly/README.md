# Fly.io deployment

Deploy **craft-api** and **craft-realtime** as separate Fly apps. Postgres, Redis, and S3 remain external (Neon, Upstash, R2, etc.).

## craft-api

```bash
fly apps create craft-api
fly deploy -c deploy/fly/craft-api.fly.toml

fly secrets set \
  DATABASE_URL='postgresql://...' \
  REDIS_URL='redis://...' \
  S3_ENDPOINT='https://...' \
  S3_PUBLIC_URL='https://cdn.example.com' \
  S3_BUCKET='craft-assets' \
  S3_ACCESS_KEY='...' \
  S3_SECRET_KEY='...' \
  CRAFT_API_CORS_ORIGIN='https://craft.example.com' \
  CRAFT_APP_URL='https://craft.example.com' \
  -a craft-api
```

Health: `https://craft-api.fly.dev/health`

## craft-realtime

```bash
fly apps create craft-realtime
fly deploy -c deploy/fly/craft-realtime.fly.toml

fly secrets set \
  DATABASE_URL='postgresql://...' \
  REDIS_URL='redis://...' \
  -a craft-realtime
```

Point the Next.js client at `wss://craft-realtime.fly.dev/yjs`.

## Web (Next.js)

Host on Vercel with remote env vars, or build `deploy/web/Dockerfile` on Fly / any container platform.
