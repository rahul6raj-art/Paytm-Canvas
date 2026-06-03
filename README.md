# Paytm Craft

Browser-based design editor: dashboard, infinite canvas (Konva), layers, comments, mock AI layout, mock plugins, and **local-first** persistence. The codebase is a **single Next.js 15** application (`src/`), ready to grow toward a full **API + Postgres + Redis + S3/R2 + Yjs** backend without breaking today’s offline-capable flow.

## Current features (web app)

- **Editor**: pan/zoom, frames, shapes, text, paths, selection, undo/redo, properties panel, command palette, keyboard shortcuts.
- **Persistence**: automatic debounced save to **`localStorage`** (`.paytmcraft.json`-compatible document shape).
- **Dashboard**: templates, import/export, recovered-file banner.
- **Mock AI**: prompt → deterministic layout (no external APIs).
- **Mock plugins**: marketplace UI, local install list, plugin runner (client-only).
- **Scaffolding**:
  - `src/lib/env.ts` — public env + `NEXT_PUBLIC_PAYTM_CRAFT_MODE` (`local` | `api` | `remote`).
  - `src/lib/apiClient.ts` — REST client: **local** = safe stubs; **api** = calls this app’s `/api/v1/*` mock Route Handlers; **remote** = calls `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` when set.
  - `src/lib/mockApiStore.ts` — server in-memory seed data for mock API routes.
  - `src/lib/syncProvider.ts` — `LocalSyncProvider` for **`local`** and **`api`** (editor stays local-first); `RemoteSyncProvider` stub only when mode is **`remote`**.

## Planned backend architecture

High-level plan (Postgres, Redis presence, WebSocket Yjs sync, object storage) lives in:

| Doc | Topic |
|-----|--------|
| [docs/backend-architecture.md](./docs/backend-architecture.md) | Services, auth, tenancy, security |
| [docs/database-schema.md](./docs/database-schema.md) | Users, teams, workspaces, files, versions, comments, assets |
| [docs/realtime-collaboration.md](./docs/realtime-collaboration.md) | Yjs, Hocuspocus, Redis presence |
| [docs/api-contracts.md](./docs/api-contracts.md) | REST shapes under `/v1` |
| [docs/deployment.md](./docs/deployment.md) | Docker, env vars, production notes |

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
- Collaboration and presence are **UI mocks** only.
- Plugin installs persist in a **separate** `localStorage` key from the design file; design documents do not embed installed plugin IDs in exported `.paytmcraft.json` by default.
- **`remote`** mode: `RemoteSyncProvider` and several `apiClient` methods remain stubs until a real backend is linked. **`api`** mode implements read/write for files/comments/me/workspaces on the **in-memory** store only (data resets when the dev server restarts unless you add persistence).

## Environment variables (optional)

| Variable | Purpose | Default |
|----------|---------|---------|
| `NEXT_PUBLIC_PAYTM_CRAFT_MODE` | `local` — no HTTP API client; **`api`** — `apiClient` → `/api/v1/*` on this app; **`remote`** — `apiClient` → `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` | `local` |
| `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` | REST API base for **remote** mode only (e.g. `https://api.example.com/v1`) | empty |
| `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` | WebSocket / Yjs endpoint | empty |
| `NEXT_PUBLIC_PAYTM_CRAFT_STORAGE_URL` | Public asset CDN or bucket origin | empty |
| `NEXT_PUBLIC_PAYTM_CRAFT_RENDERER` | Canvas scene renderer: **`dom`** (default) or experimental **`svg`** | `dom` |
| `NEXT_PUBLIC_PAYTM_CRAFT_SVG_DOM_HIT_FALLBACK` | SVG mode: full invisible DOM hit layer (debug only) | off |
| `NEXT_PUBLIC_PAYTM_CRAFT_DEBUG_CANVAS` | Footer canvas debug readout (zoom, pan, cursor, selection) | off |

### Canvas renderers

- **`dom`** (default): HTML/CSS scene graph via `CanvasObject` — full editing and interactions.
- **`svg`** (experimental): read-only SVG scene layer using shared export markup (`nodeToSvgGroupMarkup`), with an invisible DOM overlay for hit-testing. This is the migration path toward Penpot/Figma-style vector rendering without replacing the DOM renderer yet.

```bash
NEXT_PUBLIC_PAYTM_CRAFT_RENDERER=svg npm run dev
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
