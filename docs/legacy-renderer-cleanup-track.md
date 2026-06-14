# Track 27 — Legacy renderer cleanup

**Status:** complete

Track 1 shipped the **native** WASM GPU renderer as default (v3.43). This track removes runtime rollback paths for **`dom`**, **`webgl`**, and **`svg`** scene renderers.

## Goals

- **`RendererMode`** is **`native`** only — legacy `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER` values coerce to native.
- **`SceneRenderer`** — native hit layer + SVG interaction preview only; no DOM/WebGL/SVG hit rollback.
- **`Canvas`** — mounts **`NativeSceneCompositor`** only; **`WebGLTileCompositor`** removed from the mount tree.
- **`TextEditOverlay`** — active in native mode (was gated on webgl).
- Docs/README no longer advertise dom/svg/webgl rollback commands.

## Legacy env coercion

| `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER` | Effective mode |
|-----------------------------------|----------------|
| unset / `native` | `native` |
| `dom`, `svg`, `webgl` | `native` (coerced) |

`NEXT_PUBLIC_PAYTM_CRAFT_TILE_WORKER` was removed in Track 28 (WebGL tile raster deleted).

## Source layout (Track 28)

Unreachable legacy sources were **deleted** in Track 28 — see [legacy-dead-code-track.md](./legacy-dead-code-track.md).

## Verification

```bash
npm run verify:legacy-cleanup
npm test -- src/lib/__tests__/legacyRendererCleanup.test.ts
npm run verify:stack
npm run verify:migration
```

## See also

- [native-renderer-migration.md](./native-renderer-migration.md) — Track 1 terminal release (v3.43)
- [tracks.md](./tracks.md) — integration index
