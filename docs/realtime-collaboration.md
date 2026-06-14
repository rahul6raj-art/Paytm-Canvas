# Paytm Craft — Realtime collaboration

**Status:** reference — **Postgres-backed Yjs sync implemented** in `packages/craft-realtime` (Track 4). Redis presence is optional when `REDIS_URL` is set.

End state: multiple users edit the same **file** with **sub-second** sync, **offline-tolerant** merges via **Yjs**, and **ephemeral presence** (cursors, selection, avatars) via **Redis** + WebSocket fan-out.

## Components

### 1. Yjs document

- One **`Y.Doc`** (or subdomain: `Y.Map` for metadata + `Y.XmlFragment` / custom structure) per `fileId`.
- The web client’s scene graph maps to shared types; alternatively, store a single **`Y.Text`** or **`Y.Map`** holding serialized Paytm Craft JSON and diff at a coarser grain for v1 (simpler, worse merge semantics for simultaneous edits).
- **Target**: fine-grained Yjs structures aligned with `nodes` / `childOrder` for minimal conflicts.

### 2. craft-realtime (WebSocket)

Implemented in **`packages/craft-realtime`** (custom Yjs relay, not Hocuspocus):

- Authenticate during WebSocket upgrade: session cookie or API token (`sessionToken` in join payload).
- **Persistence**: debounced writes to Postgres `file_yjs_states` (`onStoreDocument`).
- **Load**: `onLoadDocument` hydrates from stored Yjs snapshot.

### 3. WebSocket sync protocol (conceptual)

| Message | Direction | Purpose |
|---------|-----------|---------|
| `sync:step1` | C↔S | Yjs sync protocol (awareness + updates) |
| `awareness` | C↔S | User info, cursor, selection |
| `presence:ping` | C→S | keep-alive |
| `error` | S→C | auth, permission, version forced reset |

Use **binary** frames for Yjs updates where possible to reduce bandwidth.

### 4. Redis presence

- Key pattern: `presence:file:{fileId}` → **HASH** or **JSON** per `socketId` / `userId` with TTL (e.g. 60s), refreshed on activity.
- Fields: `userId`, `color`, `cursor` `{x,y}`, `selection` `[nodeIds]`, `lastSeen`.
- Optional: **Redis Pub/Sub** channel `file:{fileId}` to broadcast presence to all API/WS nodes in a multi-instance deployment.

### 5. Conflict and recovery

- **Yjs** handles concurrent edits to shared structures.
- **Schema migrations**: bump `docVersion` in API; clients incompatible with server schema receive read-only mode or forced refresh.
- **Repair**: if Yjs state corrupt, fall back to last known good **snapshot** from Postgres and notify clients to resync.

### 6. Local-only mode (today)

- The Next.js app persists via **browser `localStorage`** and optional **HTTP** (`api` / `remote` modes).
- When **`NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL`** is set, `EditorRealtimeSync` opens a **Yjs** WebSocket session per API-backed file (`src/lib/realtimeSyncClient.ts`).
- **Dev mock relay** (in-memory): `npm run dev:sync` → `ws://localhost:3001/yjs`
- **Postgres-backed relay** (Track 4.3): `npm run sync:dev` → `ws://localhost:4001/yjs` via `packages/craft-realtime` (`onLoadDocument` / `onStoreDocument` → `file_yjs_states`). Optional Redis TTL for awareness when `REDIS_URL` is set.

## Related docs

- [backend-architecture.md](./backend-architecture.md)
- [api-contracts.md](./api-contracts.md)
