# Track 22 — Release bundle + tracks index

**Status:** complete (phases 22.1–22.2)

Tracks 2–21 completed the integration backend. This track adds a **master index**, a **full release verify** command, and regression tests that track docs stay present.

## Goals

- `docs/tracks.md` — single index for Tracks 1–23 with verify commands.
- `npm run verify:release` — `verify:stack` + `verify:migration` (integration + native renderer).
- `npm run verify:tracks` — offline doc/script presence tests.
- Wire `verify:tracks` into `verify:stack`.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **22.1** | `docs/tracks.md` + `verify:release` | **Done** |
| **22.2** | `tracksIndex` tests + README link | **Done** |

## Verification

```bash
npm run verify:tracks
npm run verify:stack      # includes tracks index
npm run verify:release    # full gate before shipping
npm run verify:release-stack-gate   # offline stack runner wiring (Track 36)
```

## Next

- Native renderer maintenance (Track 1 terminal at v3.43)
- See [tracks.md](./tracks.md) for integration track index (complete through **36**)
