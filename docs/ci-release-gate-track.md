# Track 29 — CI release gate alignment

**Status:** complete

Tracks 2–28 added many offline verify scripts, but **GitHub Actions** still ran a hand-rolled subset with a stale “Tracks 2–6” label. This track aligns CI with the same **`verify:release`** gate developers use locally.

## Goals

- **`npm run verify:ci`** — Rust unit tests + `craft-render` build + `verify:release`.
- **`.github/workflows/ci.yml`** — single job calling `verify:ci` (requires Rust, same as before).
- **`npm run verify:ci-gate`** — offline regression that CI wiring stays correct (no Rust required).
- Update stale “Tracks 2–6 / 2–21” comments in release scripts and docs.

## Commands

| Command | When | What |
|---------|------|------|
| `npm run verify:ci-gate` | Offline / `verify:stack` | Asserts `ci.yml` + scripts reference `verify:release` |
| `npm run verify:ci` | CI / local with Rust | Full release gate + engine checks |
| `npm run verify:release` | Pre-ship | `verify:stack` + `verify:migration` |

## GitHub Actions

```yaml
# .github/workflows/ci.yml
npm ci
npm run verify:ci
```

`verify:ci` runs:

1. `npm run build:engine:check` — Rust unit tests
2. `cargo build --release --bin craft-render` — headless PNG export binary
3. `npm run verify:release` — integration stack (Tracks 2–36) + native migration (Track 1)

## Verification

```bash
npm run verify:ci-gate
npm run verify:stack
# With Rust installed:
npm run verify:ci
```

## See also

- [integration-release-track.md](./integration-release-track.md) — Track 22 `verify:release` bundle
- [tracks.md](./tracks.md) — master index
