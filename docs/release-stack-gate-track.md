# Track 36 — Release stack gate (offline)

**Status:** complete

Tracks 22–35 added `verify:release`, `verify:stack`, and many per-track offline gates, but nothing asserted the stack runner still invokes every script. This track adds a meta-gate that guards the full release ladder wiring.

## Goals

- **`src/lib/releaseStackManifest.ts`** — `STACK_VERIFY_SCRIPTS` manifest synced with `scripts/verify-stack.mjs`.
- **`npm run verify:release-stack-gate`** — asserts `verify:stack` calls every integration verify script and `verify:release` chains stack + migration.
- Wire into **`verify:stack`** as the final step (self-check).

## Full release gate (unchanged)

```bash
npm run verify:stack      # offline integration tracks
npm run verify:migration  # Track 1 native renderer (requires Rust)
npm run verify:release    # stack + migration
```

## Offline gate

```bash
npm run verify:release-stack-gate
npm run verify:stack
```

## See also

- [integration-release-track.md](./integration-release-track.md) — Track 22 `verify:release` bundle
- [tracks-manifest-track.md](./tracks-manifest-track.md) — Track 31 range sync
