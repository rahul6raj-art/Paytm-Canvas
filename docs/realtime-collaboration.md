# Paytm Craft — Realtime collaboration (planned)

End state: multiple users edit the same **file** with **sub-second** sync, **offline-tolerant** merges via **Yjs**, and **ephemeral presence** (cursors, selection, avatars) via **Redis** + WebSocket fan-out.

## Components

### 1. Yjs document

- One **`Y.Doc`** (or subdomain: `Y.Map` for metadata + `Y.XmlFragment` / custom structure) per `fileId`.
- The web client’s scene graph maps to shared types; alternatively, store a single **`Y.Text`** or **`Y.Map`** holding serialized Paytm Craft JSON and diff at a coarser grain for v1 (simpler, worse merge semantics for simultaneous edits).
- **Target**: fine-grained Yjs structures aligned with `nodes` / `childOrder` for minimal conflicts.

### 2. Hocuspocus (WebSocket)

- Authenticate during WebSocket upgrade: JWT query param or short-lived ticket from API.
- **Persistence**: `onStoreDocument` debounced (e.g. 2–5s) writes Yjs state to Postgres (`file_versions` or dedicated `yjs_updates` append table).
- **Load**: `onLoadDocument` hydrates from latest snapshot + incremental updates.

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

- The Next.js app persists via **browser `localStorage`** and does not open a WebSocket for sync.
- `src/lib/syncProvider.ts` exposes **`LocalSyncProvider`** for future wiring; **`RemoteSyncProvider`** remains a stub until the realtime service is connected.

## Related docs

- [backend-architecture.md](./backend-architecture.md)
- [api-contracts.md](./api-contracts.md)
