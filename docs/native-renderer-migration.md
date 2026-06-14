# Native renderer migration (craft-engine)

**Rust → WASM → wgpu (WebGPU / WebGL fallback)** + native headless export.

## Status: **migration complete (v3.44 — canonical text layout authority)**

All planned migration phases are implemented. The native renderer is production-ready behind `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=native`.

| Area | Status |
|------|--------|
| WASM build + public serve | Done (`npm run build:engine`) |
| Renderer mode `native` | Done |
| React bridge + compositor | Done (`NativeSceneCompositor`) |
| Native hit layer | Done (`NativeHitLayer`) |
| Solid fills + opacity | Done |
| Corner radius, ellipse, polygon | Done |
| **Vector paths (Pen tool)** | Done (Bezier flatten + fill + stroke) |
| **Lines + arrows** | Done (stroke quads + arrowhead) |
| Strokes (rect/frame) | Done |
| **Dashed / dotted strokes** | Done (v3.1 — rects, paths, lines) |
| **Stroke caps / joins** | Done (v3.3 — round/square caps, miter/bevel/round joins) |
| **Ellipse / polygon strokes** | Done (v3.3 — outline polylines, dashed support) |
| **Rounded-rect strokes** | Done (v3.6 — corner-radius-aware dashed/solid outlines) |
| Gradients (GPU uniform table) | Done |
| `clipChildren` | Done (render + hit test) |
| Viewport culling | Done |
| Effects (shadow / blur / glass) | Done |
| Text (fontdue + Roboto) | Done |
| **Text layout** (wrap, align, spacing) | Done (v3.2) |
| **Text shaping** (rustybuzz, bold, justify) | Done (v3.5) |
| **Complex script shaping** (Arabic RTL, Devanagari, Bengali, Tamil, Hebrew) | Done (v3.15, v3.18) |
| **Multi-font fallback** (Inter + Roboto) | Done (v3.7) |
| **Runtime font registration** (Google Fonts → WASM) | Done (v3.9) |
| **Installed / local fonts** (Local Font Access → WASM) | Done (v3.10) |
| **User font file upload** (TTF/OTF → document + WASM) | Done (v3.11) |
| **Drag-drop font import** (canvas + assets panel) | Done (v3.14) |
| Images (4096² atlas, batched draw) | Done |
| Incremental WASM sync | Done (`updateNode`, `insertNode`, `deleteNode`, `setTree`) |
| Batch WASM ops | Done (`applyDocumentOps`) |
| Tile cache + dirty rebuild | Done |
| WASM hit test | Done |
| WASM undo/redo (document authority) | Done (default on for native) |
| **WASM authority bootstrap** (`loadDocument` seed) | Done (v3.8) |
| **WASM geometry authority** (eager `moveNode` / `updateNode`) | Done (v3.12) |
| **WASM structure/style authority** (`insert`/`delete`/`setTree`) | Done (v3.13) |
| **Zustand UI mirror mode** (WASM snapshots → store, compositor elision) | Done (v3.16) |
| **Deferred geometry reconcile** (WASM snapshot after drag/resize) | Done (v3.17) |
| **WASM-first mutations** (delete, z-order, insert, style, reorder) | Done (v3.19–v3.20) |
| **WASM-first geometry** (drag/resize → WASM; store mirror on pointer-up) | Done (v3.21) |
| **WASM-first shape insert** (ellipse/line/triangle/frame/shape drag-start) | Done (v3.22) |
| **WASM-first duplicate/cancel** (draft cancel, duplicate selection) | Done (v3.23) |
| **WASM-first paste/align** (clipboard paste, align, distribute) | Done (v3.24) |
| **WASM-first boolean/path** (boolean ops, pen tool, drag finish) | Done (v3.25) |
| **WASM-first import/style/path-edit** (file drop, tokens, path points, text finish) | Done (v3.26) |
| **WASM-first pencil/bulk** (pencil stroke, batch path edit, lock/visible, token detach) | Done (v3.27) |
| **WASM-first metadata/effects/path** (rename, expand, node effects, vector edit, handle mirroring) | Done (v3.28) |
| **WASM-first group/layout** (group/ungroup, auto-layout, wrap-in-frame) | Done (v3.29) |
| **WASM-first nudge/layout/mask** (per-node lock/visible, nudge, layout patches, stroke width, masks) | Done (v3.30) |
| **WASM-first component/prototype** (prototype links, components/instances/variants, duplicate/delete single) | Done (v3.31) |
| **WASM-first plugin/tokens/assets** (plugin helpers, design tokens, image asset import/replace/delete) | Done (v3.32) |
| **WASM-first page/prefs/comments** (layout guides, font import, canvas prefs, comments, path closed) | Done (v3.33) |
| **WASM-first live edit** (`updateNode`, `updateNodes`, `updateNodeStyle`, text color hex) | Done (v3.34) |
| **WASM-first resize** (`resizeNode`, `resizeFrameWithConstraints` via `commitStructuralResult`) | Done (v3.35) |
| **WASM-first responsive preview** (open/update/reset/cancel/apply via builders + geometry mirror) | Done (v3.36) |
| **WASM-first rotate commit** (`endRotateInteraction` via `buildEndRotateInteractionResult`) | Done (v3.37) |
| **WASM-first page rulers** (`toggleRulers` via `buildToggleRulersResult`, page-scoped sync) | Done (v3.38) |
| **Migration guardrails** (version sync test, WASM-first audit regression, README env docs) | Done (v3.39) |
| **Golden scene parity** (fixture parse test, craft-engine bridge, headless PNG verify) | Done (v3.40) |
| **CI + golden checksum** (GitHub Actions, SHA256 regression for headless native PNG) | Done (v3.41) |
| **Golden hit test + editor smoke** (WASM pick regression, `verify:editor` browser script) | Done (v3.42) |
| **Migration verify bundle** (TS golden pick parity, `verify:migration` one-shot offline check) | Done (v3.43) |
| Headless PNG export | Done (`craft-render` CLI) |
| Deploy verify script | Done (`npm run verify:engine`) |

## Quick start

```bash
npm run build:engine
NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=native npm run dev
```

Open `/editor`.

### WASM document authority (default for native)

With the native renderer, undo/redo uses the WASM document stack by default. The compositor bootstraps WASM history on first sync via `loadDocument` + `pushHistorySnapshot`; subsequent store syncs use `syncDocument` (no undo noise). Zustand receives geometry patches from `snapshotDocument()` after undo/redo.

**UI mirror mode (v3.16+, default on):** eager WASM authority ops advance the compositor baseline; redundant store→WASM compositor sync is skipped. After structural WASM ops, the store reconciles from `snapshotDocument()` via `applyWasmDocumentPatch`. Geometry reconcile is deferred during drag/resize and flushed on pointer-up (v3.17).

Disable WASM authority (Zustand history + compositor sync):

```bash
NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY=false npm run dev
```

Disable UI mirror only (keep WASM authority, always compositor-sync from store):

```bash
NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR=false npm run dev
```

Disable WASM-first structural mutations (store updates first, then mirror):

```bash
NEXT_PUBLIC_PAYTM_CRAFT_WASM_FIRST_MUTATIONS=false npm run dev
```

## Renderer modes

| Mode | Use |
|------|-----|
| `native` (default) | WASM GPU engine (wgpu) |
| `webgl` | Production tile compositor + Canvas2D raster |
| `dom` | Legacy HTML/CSS rollback |
| `svg` | Experimental vector scene |

## Architecture

```
React UI (Zustand store)
    ↓ JSON document slice + asset summaries
craftEngineDocumentFromStore()
    ↓ incremental ops (updateNode / setTree / insert / delete)
CraftEngine::create(canvas)  [WASM]
    ↓ tile cache (512px) + gradient uniforms + texture atlas
wgpu draw (WebGPU or WebGL)
    ↓
NativeHitLayer (WASM pick + selection/drag)
```

## WASM API

| Method | Description |
|--------|-------------|
| `create(canvas)` | Init wgpu surface |
| `syncDocument(json)` | Replace scene (compositor sync, no undo snapshot) |
| `loadDocument(json)` | Load + record undo snapshot |
| `applyDocumentOp(json)` | Single incremental op |
| `applyDocumentOps(json)` | Batch incremental ops |
| `pushHistorySnapshot()` | Opt-in undo entry |
| `clearHistory()` | Clear WASM undo stack |
| `undo()` / `redo()` | Restore document snapshot |
| `snapshotDocument()` | Serialize WASM document |
| `setViewport` / `render` | Pan/zoom + draw |
| `hitTest(x, y)` | Deepest node id |
| `registerImageAsset` | Pack into GPU atlas |
| `registerFontFamily(name, weight, bytes)` | Runtime TTF/OTF for text |
| `tileCacheLen()` / `atlasImageCount()` | Diagnostics |
| `backendLabel()` | `WebGpu` or `Gl` |
| `engine_version()` | `3.44.0` |

### Document ops

| Op | Use |
|----|-----|
| `updateNode` | Property / geometry change |
| `moveNode` | Position only |
| `insertNode` | Add node to tree |
| `deleteNode` | Remove subtree |
| `setTree` | Reorder `childOrder` / `rootIds` |

## Production build

```bash
npm run build:engine
npm run verify:engine
npm run verify:golden
npm run verify:migration   # offline: tests + verify:engine + verify:golden
npm run build:with-engine
```

See [deployment.md](./deployment.md).

## Parity testing

```bash
NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=native node scripts/renderer-compare.mjs --mode=native
NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=webgl node scripts/renderer-compare.mjs --mode=webgl
```

Golden fixture: `fixtures/golden-tile-scene.json`

Headless native export check:

```bash
npm run verify:golden
```

## Headless export

```bash
npm run build:engine
npm run render:native -- fixtures/golden-tile-scene.json /tmp/scene.png
```

## Phase history

| Version | Deliverable |
|---------|-------------|
| v1.0 | WASM scaffold, tiles, hit test, gradients (vertex) |
| v2.0 | Effects, text, images, headless CLI, native hit layer |
| v2.1 | Incremental sync, GPU image textures |
| v2.2 | GPU gradient uniforms, fontdue text, WASM undo stack |
| v2.3 | History-safe `syncDocument` |
| v2.4 | Texture atlas batching |
| v2.5 | Incremental atlas, WASM authority (opt-in) |
| v2.6 | Structural ops (`setTree`), deploy tooling |
| **v3.0** | Path/line/arrow tessellation, batch ops, migration complete |
| **v3.1** | Dashed/dotted strokes (native default renderer) |
| **v3.2** | Text layout — word wrap, letter spacing, horizontal/vertical align |
| **v3.3** | Stroke caps/joins, dashed ellipse/polygon outlines |
| **v3.4** | WASM document authority on by default (native undo/redo) |
| **v3.5** | rustybuzz shaping, Roboto Bold, justify alignment |
| **v3.6** | Rounded-rect stroke outlines (dashed + caps on curved corners) |
| **v3.7** | Inter + Roboto font-family fallback (embedded TTF) |
| **v3.8** | WASM authority bootstrap — `loadDocument` + `pushHistorySnapshot` on first native sync |
| **v3.9** | Runtime font bridge — Google Fonts TTF → `registerFontFamily` in compositor sync |
| **v3.10** | Installed font bridge — Local Font Access API → `registerFontFamily` |
| **v3.11** | User font upload — TTF/OTF persisted in `fontAssets`, synced to WASM |
| **v3.12** | WASM geometry authority — drag/resize applies `moveNode`/`updateNode` eagerly |
| **v3.13** | WASM structure/style authority — delete, reorder, style, insert via eager WASM ops |
| **v3.14** | Drag-drop font import — TTF/OTF on canvas and assets panel; auto-apply to selected text |
| **v3.15** | Complex script shaping — auto script/direction detect, Noto Arabic/Devanagari fallback, RTL layout |
| **v3.16** | Zustand UI mirror mode — compositor elides redundant sync; store applies WASM snapshots |
| **v3.17** | Deferred geometry reconcile — WASM snapshot applied to store after drag/resize ends |
| **v3.18** | Extended complex-script fonts — Noto Bengali, Tamil, Hebrew embedded + script fallback |
| **v3.19** | WASM-first structural mutations — delete + z-order apply to WASM before store mirror |
| **v3.20** | WASM-first complete — insert, style, reorder, move; unified `commitDocumentMutation` + `syncWasmDocumentAfterStoreUpdate` |
| **v3.21** | WASM-first geometry — live ops to WASM during drag/resize; store mirrors WASM snapshot on pointer-up |
| **v3.22** | WASM-first shape insert — ellipse/line/triangle/frame/shape/text drag-start + toolbar rectangle/text |
| **v3.23** | WASM-first duplicate/cancel — draft drag cancel + duplicate/clone selection via `commitStructuralResult` |
| **v3.24** | WASM-first paste/align — clipboard paste (with assets), align, and distribute via `commitStructuralResult` |
| **v3.25** | WASM-first boolean/path — boolean group/flatten/outline, pen tool, shape/frame drag finish |
| **v3.26** | WASM-first import/style/path-edit — canvas file import, fill hex, design tokens, path point edit, text drag finish |
| **v3.27** | WASM-first pencil/bulk — freehand pencil, batch path points, lock/visible toggles, token detach |
| **v3.28** | WASM-first metadata/effects/path — rename, layer expand, node-level effects, vector-edit convert, path handle mirroring |
| **v3.29** | WASM-first group/layout — group/ungroup selection, auto-layout, wrap selection in frame |
| **v3.30** | WASM-first nudge/layout/mask — per-node lock/visible, arrow nudge, layout sizing/constraints, stroke width, mask group ops |
| **v3.31** | WASM-first component/prototype — prototype wire links, component create/instance/variant, instance overrides, duplicate/delete single |
| **v3.32** | WASM-first plugin/tokens/assets — plugin lorem/rename/icon, design token CRUD, image asset import/replace/delete |
| **v3.33** | WASM-first page/prefs/comments — layout guides, font import, grid/background/name, comment CRUD, empty-text delete, path closed |
| **v3.34** | WASM-first live edit — `updateNode`/`updateNodes` builders, `updateNodeStyle` via `commitStructuralResult`, text color hex |
| **v3.35** | WASM-first resize — `buildResizeNodeResult` / `buildResizeFrameWithConstraintsResult`; live resize commits through `commitStructuralResult` with post-commit geometry mirror |
| **v3.36** | WASM-first responsive preview — open/update/reset/cancel/apply builders; live preview bounds mirror geometry to WASM |
| **v3.37** | WASM-first rotate commit — `buildEndRotateInteractionResult`; single-selection rotate pointer-up commits through `commitStructuralResult` |
| **v3.38** | WASM-first page rulers — `toggleRulers` via `buildToggleRulersResult`; `showRulers` added to page-scoped UI sync |
| **v3.39** | Migration guardrails — `craftEngineVersionSync` + `craftEngineWasmFirstAudit` regression tests; README WASM env docs |
| **v3.40** | Golden scene parity — Rust/TS fixture parse tests, `verify:golden` headless PNG export check |
| **v3.41** | CI + golden checksum — GitHub Actions workflow, SHA256 regression for headless native PNG |
| **v3.42** | Golden hit test + editor smoke — WASM `hit_test` regression on golden fixture; `verify:editor` Playwright script |
| **v3.43** | Migration verify bundle — TS golden pick parity test; `verify:migration` one-shot offline verification |
| **v3.44** | Canonical text layout — WASM `layoutTextNode` rustybuzz/fontdue authority; SVG/canvas/caret consume shared layout |

## Post-migration

All planned native renderer phases are complete (**v3.44**). Run `npm run verify:migration` for offline verification (TS tests + WASM artifacts + golden PNG checksum). Browser smoke: `npm run verify:editor` (requires `npm run dev`). Offline wiring: `npm run verify:editor-gate` (Track 32), `npm run verify:migration-gate` (Track 34).

**WASM-first mutation audit complete (v3.37–v3.38):** every routine document and page-preference mutation in the editor store commits through `commitStructuralResult` / `commitDocumentMutation`. Remaining direct `set()` paths are ephemeral UI (zoom, pan, selection, tools), rotate-drag session state (`beginRotateInteraction`), document import / page switch / undo-redo snapshot application, and prototype preview overlays.

## Track 27 — Legacy renderer cleanup

Runtime rollback paths for **`dom`**, **`webgl`**, and **`svg`** scene renderers were removed. `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER` is **native-only**; legacy env values coerce to native. See [legacy-renderer-cleanup-track.md](./legacy-renderer-cleanup-track.md). Unreachable legacy sources were deleted in Track 28 — [legacy-dead-code-track.md](./legacy-dead-code-track.md).
