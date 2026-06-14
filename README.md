# Paytm Craft

Browser-based design editor: dashboard, infinite canvas (native WASM GPU renderer), layers, comments, mock AI layout, mock plugins, and **local-first** persistence. The codebase is a **single Next.js 15** application (`src/`), ready to grow toward a full **API + Postgres + Redis + S3/R2 + Yjs** backend without breaking today’s offline-capable flow.

## Current features (web app)

- **Editor**: pan/zoom, frames, shapes, text, paths, selection, undo/redo, properties panel, command palette, keyboard shortcuts. Default canvas renderer is **native WASM GPU** (`craft-engine`).
- **Persistence**: debounced save to **`localStorage`**; in **`api`** or **`remote`** mode, also syncs to HTTP via `ApiSyncProvider` / `RemoteSyncProvider`.
- **Dashboard**: templates, import/export, recovered-file banner.
- **Mock AI**: prompt → deterministic layout (no external APIs).
- **Mock plugins**: marketplace UI, local install list, plugin runner (client-only).
- **Scaffolding**:
  - `src/lib/env.ts` — public env + `NEXT_PUBLIC_PAYTM_CRAFT_MODE` (`local` | `api` | `remote`).
  - `src/lib/apiClient.ts` — REST client: **local** = safe stubs; **api** = calls this app’s `/api/v1/*` mock Route Handlers; **remote** = calls `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` when set.
  - `src/lib/mockApiStore.ts` — server in-memory seed data for mock API routes.
  - `src/lib/syncProvider.ts` — `LocalSyncProvider` (**`local`**), `ApiSyncProvider` (**`api`**), `RemoteSyncProvider` (**`remote`**).

## Planned backend architecture

High-level plan (Postgres, Redis presence, WebSocket Yjs sync, object storage) lives in:

| Doc | Topic |
|-----|--------|
| [docs/backend-architecture.md](./docs/backend-architecture.md) | Services, auth, tenancy, security |
| [docs/database-schema.md](./docs/database-schema.md) | Users, teams, workspaces, files, versions, comments, assets |
| [docs/realtime-collaboration.md](./docs/realtime-collaboration.md) | Yjs, Hocuspocus, Redis presence |
| [docs/api-persistence-track.md](./docs/api-persistence-track.md) | **Track 2:** API-backed editor persistence (complete) |
| [docs/integration-track.md](./docs/integration-track.md) | **Track 3:** Dev stack + `verify:persistence` |
| [docs/backend-track.md](./docs/backend-track.md) | **Track 4:** Postgres `craft-api` service |
| [docs/client-remote-track.md](./docs/client-remote-track.md) | **Track 5:** Remote client wiring (auth, asset upload) |
| [docs/auth-ui-track.md](./docs/auth-ui-track.md) | **Track 6:** Login / sign-out UI for remote mode |
| [docs/release-track.md](./docs/release-track.md) | **Track 7:** Docker stack + `verify:stack` |
| [docs/rbac-track.md](./docs/rbac-track.md) | **Track 8:** Workspace RBAC on `craft-api` |
| [docs/api-contracts.md](./docs/api-contracts.md) | REST shapes under `/v1` |
| [docs/deployment.md](./docs/deployment.md) | Docker, env vars, production notes |
| [docs/tracks.md](./docs/tracks.md) | **Master index** — Tracks 1–36 + `verify:release` |

**Future path:** use **`api`** mode to exercise HTTP + DTOs against in-process Route Handlers, then switch to **`remote`** with a real API URL. You can progressively replace `localStorage` writes with `createSyncProvider()` + `apiClient` behind a small sync layer—**without** removing `LocalSyncProvider` for demos and tests.

## Local development

**Requirements:** Node.js 20+

```bash
npm install
npm run dev
```

### Mock REST API (`api` mode)

Run the dev server with **`NEXT_PUBLIC_PAYTM_CRAFT_MODE=api`** so `apiClient` issues `fetch` calls to **`/api/v1/*`** (Next.js Route Handlers + in-memory `mockApiStore`). The **dashboard** loads workspaces and file cards from that API; the canvas/editor **still** auto-saves to **`localStorage`** via `LocalSyncProvider` — only the typed API client (and dashboard lists) use HTTP.

```bash
NEXT_PUBLIC_PAYTM_CRAFT_MODE=api npm run dev
```

**Full dev stack** (persisted mock API + Yjs relay):

```bash
npm run dev:api
```

### Postgres backend (`remote` mode)

Point the app at **`packages/craft-api`** (Express + Prisma on port 4000):

```bash
npm run db:up && npm run db:setup
npm run api:dev
npm run sync:dev   # ws://localhost:4001/yjs (Postgres-backed Yjs)
NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote \
NEXT_PUBLIC_PAYTM_CRAFT_API_URL=http://localhost:4000/v1 \
NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=ws://localhost:4001/yjs \
npm run dev
```

Or one command (requires Docker):

```bash
npm run dev:remote
```

**Containerized backend** (API + realtime in Docker):

```bash
npm run stack:up && npm run stack:setup
```

```bash
npm run verify:stack
npm run verify:release   # stack + native renderer (full release gate)
npm run verify:ci        # same gate + Rust checks (what CI runs)
```

See [docs/tracks.md](./docs/tracks.md) and [docs/backend-track.md](./docs/backend-track.md).

From application code (with mode `api`): `import { apiClient } from "@/lib/apiClient"` then e.g. `await apiClient.getCurrentUser()`.

```bash
curl -s http://localhost:3000/api/v1/me | jq .
curl -s "http://localhost:3000/api/v1/files?workspaceId=ws-paytm-design" | jq .
```

- App: [http://localhost:3000](http://localhost:3000)  
- Editor: [http://localhost:3000/editor](http://localhost:3000/editor)

```bash
npm run build   # production build + typecheck
npm run lint
```

## Local-only limitations

- No server-side auth; no shared workspaces or multi-device sync for the editor document.
- Collaboration and presence use **mock simulators** unless `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` is set (Yjs live sync).
- Plugin installs persist in a **separate** `localStorage` key from the design file; design documents do not embed installed plugin IDs in exported `.paytmcraft.json` by default.
- **`api`** mode uses the in-memory mock store by default; set `PAYTM_CRAFT_MOCK_API_PERSIST=1` (or use `npm run dev:api`) to persist to `.craft-mock-api/store.json`.

## Environment variables (optional)

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_PAYTM_CRAFT_MODE` | `local` — no HTTP API client; **`api`** — `apiClient` → `/api/v1/*` on this app; **`remote`** — `apiClient` → `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` | `local` |
| `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` | REST API base for **remote** mode only (e.g. `https://api.example.com/v1`) | empty |
| `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` | WebSocket / Yjs endpoint | empty |
| `PAYTM_CRAFT_MOCK_API_PERSIST` | Persist mock `/api/v1` store to `.craft-mock-api/store.json` (server) | off |
| `NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL` | Public asset CDN or bucket origin | empty |
| `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER` | Canvas scene renderer — **`native`** only (legacy `dom` / `webgl` / `svg` env values coerce to native) | `native` |
| `NEXT_PUBLIC_PAYTM_CRAFT_WASM_AUTHORITY` | Native mode: WASM owns undo/redo stack (set `false` to use Zustand history) | on (native) |
| `NEXT_PUBLIC_PAYTM_CRAFT_WASM_UI_MIRROR` | Native mode: Zustand mirrors WASM snapshots; compositor skips redundant sync | on (native + authority) |
| `NEXT_PUBLIC_PAYTM_CRAFT_WASM_FIRST_MUTATIONS` | Native mode: structural edits apply to WASM before store mirror | on (native + authority + UI mirror) |
| `NEXT_PUBLIC_PAYTM_CRAFT_DEBUG_CANVAS` | Footer canvas debug readout (zoom, pan, cursor, selection) | off |

### Canvas renderer

- **`native`** (default and only runtime mode): Rust/WASM craft-engine with WebGPU (WebGL fallback) — paths, gradients, images, WASM-first mutations. Build WASM first: `npm run build:engine`. See [docs/native-renderer-migration.md](./docs/native-renderer-migration.md).
- Legacy **`dom`**, **`webgl`**, and **`svg`** env values are **coerced to native** (Track 27). Rollback paths were removed from the editor mount tree.

```bash
# Native WASM GPU renderer (requires Rust + wasm-pack)
npm run build:engine
npm run dev
```

Native renderer migration guide: [`docs/native-renderer-migration.md`](docs/native-renderer-migration.md)

```bash
# Build WASM engine + native PNG export CLI
npm run build:engine

# Native GPU editor
NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=native npm run dev

# Headless PNG export (no browser)
npm run render:native -- fixtures/golden-tile-scene.json /tmp/scene.png
```

Visual regression harness (dev server must be running):

```bash
npm run verify:migration   # offline migration verification
npm run verify:editor        # browser smoke (requires npm run dev)
npm run verify:editor-gate   # offline editor smoke wiring (verify:stack)
```

SVG mode uses SVG hit targets for selection/drag; only **text editing** and **prototype wire handles** use small DOM overlays. Optional full invisible-DOM layer for debugging:

```bash
NEXT_PUBLIC_PAYTM_CRAFT_SVG_DOM_HIT_FALLBACK=true
```

## Engineering notes

- Scene graph uses flat `nodes` + `childOrder` (good fit for future CRDT patches).
- Do not ship third-party logos or cloned proprietary assets; UI is original.

## License

Proprietary — Paytm Craft internal use unless otherwise specified.
