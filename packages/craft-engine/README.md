# craft-engine

Rust/WASM GPU scene renderer for Paytm Craft (Figma-style path).

**Migration status:** scaffold complete — see [`docs/native-renderer-migration.md`](../../docs/native-renderer-migration.md).

## Stack

- **Rust** → **WASM** via `wasm-pack`
- **wgpu** — WebGPU primary, WebGL fallback
- **Scene graph** — JSON document slice from the editor store
- **Paint** — solids, gradients (linear/radial), strokes, rounded rects, ellipses, polygons
- **Culling** — viewport + `clipChildren`
- **Tile cache** — 512px world tiles, rebuild on doc change, merge visible on pan/zoom

## Build

```bash
npm run build:engine
npm run build:engine:check   # Rust unit tests only
```

Output: `public/craft-engine/`

## Run

```bash
NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=native npm run dev
```

## Modules

| File | Role |
|------|------|
| `document.rs` | Parse editor JSON |
| `gradient.rs` | Gradient stop sampling |
| `scene.rs` | Hierarchy walk + cull |
| `tessellate.rs` | Path → triangles |
| `viewport.rs` | Pan/zoom world rect |
| `gpu.rs` | wgpu pipeline |

## Roadmap (post-migration)

1. ~~Tile cache in WASM~~ (v0.4) — incremental per-node dirty next
2. GPU gradient shaders (angular/diamond)
3. Text shaping + images
4. WASM document ops + hit testing
5. Native server renderer
