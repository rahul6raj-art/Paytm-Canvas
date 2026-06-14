# Track 14 — Production auth hardening

**Status:** complete (phases 14.1–14.2)

Tracks 4–13 shipped the full stack with **dev-friendly anon access**. This track adds a **production profile**: require sign-in, secure cookies, and restricted CORS.

## Goals

- Centralized env parsing in `craft-api` and `craft-realtime`.
- `CRAFT_API_ALLOW_ANON=0` — no seeded fallback user; `/v1/*` returns 401 without session.
- Secure session cookies when `CRAFT_API_ENV=production` or `CRAFT_API_COOKIE_SECURE=1`.
- Configurable CORS via `CRAFT_API_CORS_ORIGIN`.
- `docker-compose.prod.yml` overlay for staging/production-like local runs.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **14.1** | `config.ts` + secure cookies + CORS + health metadata | **Done** |
| **14.2** | Realtime anon guard + compose prod overlay + docs | **Done** |

## Environment

| Variable | Dev | Production |
|----------|-----|------------|
| `CRAFT_API_ALLOW_ANON` | `1` (default) | `0` |
| `CRAFT_API_ENV` | `development` | `production` |
| `CRAFT_API_COOKIE_SECURE` | off | `1` (auto in production) |
| `CRAFT_API_CORS_ORIGIN` | open | your web origin(s) |
| `CRAFT_SYNC_ALLOW_ANON` | `1` | `0` |

Auth remains **HttpOnly session cookies** (`craft_sid`) for browsers. **Personal access tokens** (`craft_pat_*`, Bearer) were added in Track 19 — see [api-tokens-track.md](./api-tokens-track.md).

## Docker production profile

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
npm run stack:setup
```

Sign in via the editor (`rahul.verma@paytm.com` / `craft-dev` after seed).

## Verification

```bash
npm run verify:stack
```

Unit tests: `config` in `@paytm-craft/api` and `@paytm-craft/realtime`.

## Next

- ~~SMTP invite notifications~~ (Track 15)
- K8s / Fly deploy manifests
- JWT or API tokens for service accounts
