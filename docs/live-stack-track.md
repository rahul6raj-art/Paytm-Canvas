# Track 18 — Live stack smoke test

**Status:** complete (phases 18.1–18.2)

Tracks 4–17 built the Docker stack and offline `verify:stack`. This track adds a **live integration smoke test** that hits a running `craft-api` + `craft-realtime` stack.

## Goals

- `npm run verify:stack:live` — auth, workspaces, teams, files, WebSocket `/yjs` join.
- Offline contract tests in `stackLiveChecks.ts` (no Docker required).
- Clear error when stack is not running.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **18.1** | `stackLiveChecks.ts` + unit tests | **Done** |
| **18.2** | `verify-stack-live.ts` + docs | **Done** |

## Usage

```bash
npm run stack:up && npm run stack:setup
npm run verify:stack:live
```

Skip when stack is intentionally down:

```bash
CRAFT_VERIFY_SKIP_LIVE=1 npm run verify:stack:live
```

## Environment

| Variable | Default |
|----------|---------|
| `CRAFT_API_URL` | `http://localhost:4000` |
| `CRAFT_SYNC_URL` | `ws://localhost:4001/yjs` |
| `CRAFT_LIVE_EMAIL` | `rahul.verma@paytm.com` |
| `CRAFT_LIVE_PASSWORD` | `craft-dev` |
| `CRAFT_LIVE_TIMEOUT_MS` | `8000` |
| `CRAFT_API_TOKEN` | optional Bearer `craft_pat_…` (skips login) |

## Checks

1. `GET /health` — craft-api
2. `POST /v1/auth/login` → session cookie
3. `GET /v1/auth/me`, `/v1/workspaces`, `/v1/teams`, `/v1/files`
4. Realtime HTTP banner on port 4001
5. WebSocket `join` → `sync` response for a seeded file

## Verification

```bash
npm run verify:stack              # offline contract + live smoke gate (Track 33)
npm run verify:stack-live-gate    # offline script wiring only
npm run verify:stack:live         # requires Docker stack
```

## See also

- [live-stack-gate-track.md](./live-stack-gate-track.md) — Track 33 offline gate
- [api-tokens-track.md](./api-tokens-track.md) — Bearer token smoke path
