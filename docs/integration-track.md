# Track 3 — Dev integration & verification

**Status:** complete (phase 3.4)

Tracks 1 (native renderer v3.43) and 2 (API persistence + Yjs realtime) are complete. This track hardens the **local dev stack** and adds **offline verification** for persistence work.

## Goals

- **`verify:persistence`** — one-shot regression bundle for Track 2 (no browser).
- **Disk-backed mock API** — survive `next dev` restarts during api-mode development.
- **`dev:api`** — single command for api mode + Yjs relay + persisted mock store.
- **CI** — run persistence verification on every PR.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **3.1** | `verify:persistence` + CI step | **Done** |
| **3.2** | File-backed `mockApiStore` (`PAYTM_CRAFT_MOCK_API_PERSIST`) | **Done** |
| **3.3** | `npm run dev:api` convenience stack | **Done** |
| **3.4** | Docs + README alignment | **Done** |

## Dev usage

**Full api stack (persisted mock API + live sync):**

```bash
npm run dev:api
```

Open [http://localhost:3000](http://localhost:3000), create/edit files — data survives dev server restarts in `.craft-mock-api/store.json`.

**Offline verification:**

```bash
npm run verify:persistence
```

## Related docs

- [api-persistence-track.md](./api-persistence-track.md)
- [backend-track.md](./backend-track.md)
- [deployment.md](./deployment.md)
