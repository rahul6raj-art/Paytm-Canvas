# Track 34 — Native migration verify gate (offline)

**Status:** complete

Track 1 ships `npm run verify:migration` (TS tests + WASM artifacts + golden PNG checksum), but that step requires Rust/WASM builds and full test runs. This track adds an explicit offline gate for migration bundle wiring — same pattern as Tracks 32–33.

## Goals

- **`src/lib/migrationVerifyManifest.ts`** — script paths, golden fixture/checksum, WASM artifacts, regression test paths.
- **`npm run verify:migration-gate`** — asserts `verify:migration` chains tests, `verify:engine`, and `verify:golden`; golden fixture and WASM artifacts exist.
- Wire into **`verify:stack`** alongside **`verify:editor-gate`** (Track 32).

## Full migration verify (unchanged)

```bash
npm run verify:migration
```

Requires Rust toolchain and committed WASM artifacts. Runs full TS test suite plus engine and golden checks.

## Offline gate

```bash
npm run verify:migration-gate
npm run verify:stack
```

## See also

- [native-renderer-migration.md](./native-renderer-migration.md) — Track 1 `verify:migration` (v3.43)
- [editor-smoke-gate-track.md](./editor-smoke-gate-track.md) — Track 32 editor smoke wiring gate
