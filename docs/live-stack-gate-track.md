# Track 33 — Live stack smoke gate (offline)

**Status:** complete

Track 18 ships `npm run verify:stack:live` (Docker stack smoke), but script wiring was only partially guarded offline via `verify:stack:live:contract` unit tests. This track adds an explicit offline gate for the live smoke script structure.

## Goals

- **`src/lib/stackLiveManifest.ts`** — env keys, script path, endpoint markers.
- **`npm run verify:stack-live-gate`** — asserts `verify-stack-live.ts` covers health, auth, REST, and WebSocket join.
- Wire into **`verify:stack`** alongside existing **`verify:stack:live:contract`**.

## Live smoke (unchanged)

```bash
npm run stack:up && npm run stack:setup
npm run verify:stack:live
```

Skip when stack is down:

```bash
CRAFT_VERIFY_SKIP_LIVE=1 npm run verify:stack:live
```

## Offline gate

```bash
npm run verify:stack-live-gate
npm run verify:stack
```

## See also

- [live-stack-track.md](./live-stack-track.md) — Track 18 live integration smoke
- [api-tokens-track.md](./api-tokens-track.md) — `CRAFT_API_TOKEN` bearer path
