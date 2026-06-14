# Track 32 — Native editor smoke gate (offline)

**Status:** complete

Track 1 ships `npm run verify:editor` (Playwright browser smoke), but it requires a running dev server and was not guarded offline. This track adds an offline regression gate for editor smoke wiring.

## Goals

- **`src/lib/editorSmokeManifest.ts`** — selectors, golden fixture path, script markers.
- **`npm run verify:editor-gate`** — asserts native compositor data attributes, canvas chrome mounts, and `verify-native-editor.mjs` checks.
- Remove orphaned **`scripts/check-editor.mjs`** (superseded by `verify:editor`).
- Wire into **`verify:stack`**.

## Browser smoke (unchanged)

```bash
npm run dev
npm run verify:editor
```

Skips gracefully when the dev server is unreachable.

## Offline gate

```bash
npm run verify:editor-gate
npm run verify:stack
```

## See also

- [native-renderer-migration.md](./native-renderer-migration.md) — Track 1 `verify:editor` (v3.42)
- [canvas-chrome-track.md](./canvas-chrome-track.md) — Track 26 chrome markers
