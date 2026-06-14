# Track 2 — API-backed document persistence

**Status:** complete (phase 2.5)

Native renderer migration is complete (v3.43). This track wires the editor to durable HTTP persistence and optional Yjs realtime sync.

## Goals

- **Single sync path:** `getSyncProvider().saveDocument()` / `loadDocument()` is the only document persistence API in the editor.
- **`api` mode:** mock Route Handlers persist documents per `fileId`; `localStorage` remains a local cache and cross-tab fallback.
- **`remote` mode:** same HTTP path against `NEXT_PUBLIC_PAYTM_CRAFT_API_URL`.
- **Realtime:** optional Yjs/WebSocket when `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` is set.
- **No regression in `local` mode:** unchanged `LocalSyncProvider` behavior.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **2.1** | `ApiSyncProvider` — API save/load + local cache; unify `saveToLocal` | **Done** |
| **2.2** | Direct editor open `/editor?fileId=` + hydrate from API | **Done** |
| **2.3** | Revision headers (`If-Match`) + conflict status in UI | **Done** |
| **2.4** | `remote` mode provider (real API URL) | **Done** |
| **2.5** | Realtime sync (Yjs / WebSocket) | **Done** |

## Architecture

```
Editor (Zustand)
    ↓ debounced saveToLocal()
getSyncProvider()
    ├─ local  → LocalSyncProvider
    ├─ api    → ApiSyncProvider
    └─ remote → RemoteSyncProvider → ApiSyncProvider (HTTP)

EditorRealtimeSync (when SYNC_URL set)
    ↓ Yjs Y.Doc (serialized document JSON)
ws://…/yjs mock relay (dev) or Hocuspocus (prod)
```

HTTP saves still use `If-Match` revision headers. Yjs provides live multi-client document sync; awareness messages feed the presence layer when enabled.

## Dev usage

**Mock API + mock Yjs relay:**

```bash
# terminal 1
npm run dev:sync

# terminal 2
NEXT_PUBLIC_PAYTM_CRAFT_MODE=api \
NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=ws://localhost:3001/yjs \
npm run dev
```

Open the same API file in two browser tabs — edits should converge within ~600ms.

**Remote API:**

```bash
NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote \
NEXT_PUBLIC_PAYTM_CRAFT_API_URL=https://api.example.com/v1 \
NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL=wss://sync.example.com/yjs \
npm run dev
```

## Verification

```bash
npm test -- --test-name-pattern="yjsDocumentChannel|realtimeSyncProtocol|apiSyncProvider|paytmCraftEnv"
```

## Related docs

- [api-contracts.md](./api-contracts.md)
- [realtime-collaboration.md](./realtime-collaboration.md)
- [backend-architecture.md](./backend-architecture.md)
- [deployment.md](./deployment.md)
