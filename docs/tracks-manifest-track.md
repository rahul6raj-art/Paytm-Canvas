# Track 31 — Tracks manifest & release gate sync

**Status:** complete

After Tracks 29–30, release scripts and docs still referenced stale ranges (**2–28**, **2–29**). This track centralizes the integration track ceiling and enforces it in regression tests.

## Goals

- **`src/lib/tracksManifest.ts`** — `LATEST_INTEGRATION_TRACK` + range label helpers.
- Sync **`verify:release`**, **`verify:ci`**, **`verify:stack`**, **`deployment.md`**, and **`ciReleaseGate`** tests to **Tracks 2–36**.
- **`npm run verify:tracks-sync`** — offline regression wired into `verify:stack`.

## Verification

```bash
npm run verify:tracks-sync
npm run verify:stack
npm run verify:release
```

## See also

- [integration-release-track.md](./integration-release-track.md) — Track 22 release bundle
- [tracks.md](./tracks.md) — master index
