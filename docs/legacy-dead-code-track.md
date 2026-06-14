# Track 28 — Legacy renderer dead code removal

**Status:** complete

Track 27 removed runtime rollback paths but left unreachable legacy sources in the tree. This track **deletes** them.

## Removed

| Path | What it was |
|------|-------------|
| `src/editor-core/renderer/WebGLTileCompositor.tsx` | WebGL tile compositor mount |
| `src/editor-core/renderer/DomSceneRenderer.tsx` | DOM `CanvasObject` scene graph |
| `src/editor-core/renderer/SvgHitLayer.tsx` | SVG hit targets for legacy modes |
| `src/lib/canvasTiles/` | Canvas2D tile raster + WebGL engine (17 modules) |
| `scripts/renderer-compare.mjs` | dom/webgl visual compare harness |
| `scripts/webgl-*.mjs` | WebGL regression scripts |

## Config cleanup

- Removed `tileWorker` from `CraftPublicConfig` and `NEXT_PUBLIC_PAYTM_CRAFT_TILE_WORKER` handling.
- `canvasEphemeralTransform` no longer calls the WebGL compositor draw bridge.

## Kept

- **`SvgSceneRenderer`** — native drag/resize interaction preview overlay.
- **`CanvasObject`** — prototype preview modal still uses DOM objects.
- **`fixtures/golden-tile-scene.json`** — native WASM golden render + hit tests (Track 1).

## Verification

```bash
npm run verify:legacy-cleanup
npm run verify:stack
npm run verify:migration
```

## See also

- [legacy-renderer-cleanup-track.md](./legacy-renderer-cleanup-track.md) — Track 27 rollback removal
- [tracks.md](./tracks.md) — integration index
