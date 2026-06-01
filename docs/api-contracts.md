# Paytm Craft — API contracts (planned)

REST-style **JSON** under a versioned prefix (e.g. `/v1`). Mock and production handlers should return a stable envelope:

```json
{ "data": … }
```

Errors:

```json
{ "error": { "code": "FORBIDDEN", "message": "…" } }
```

## Next.js mock API (dev / `api` mode)

When `NEXT_PUBLIC_PAYTM_CRAFT_MODE=api`, the web app exposes **Route Handlers** under **`/api/v1/*`** with an **in-memory** store (`src/lib/mockApiStore.ts`). Responses use:

```json
{ "data": … }
```

```json
{ "error": { "code": "NOT_FOUND", "message": "…" } }
```

Implemented routes: `GET /api/v1/me`, `GET /api/v1/workspaces`, `GET|POST /api/v1/files`, `GET|PUT /api/v1/files/[fileId]`, `GET|POST /api/v1/comments`, `PATCH|DELETE /api/v1/comments/[commentId]`. The editor still persists via **`LocalSyncProvider`**; this layer is for exercising HTTP shapes before a real backend exists.

Real auth and full production routes are **not** implemented for `remote` mode until services exist; `src/lib/apiClient.ts` calls the mock routes in **`api`** mode and your **`NEXT_PUBLIC_PAYTM_CRAFT_API_URL`** in **`remote`** mode when set.

## Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/auth/register` | Create user; returns tokens or session cookie |
| `POST` | `/v1/auth/login` | Issue tokens / session |
| `POST` | `/v1/auth/logout` | Invalidate session / refresh |
| `GET` | `/v1/auth/me` | Current user profile |

## Workspaces & files

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/workspaces` | List workspaces for current user |
| `POST` | `/v1/workspaces` | Create workspace (admin) |
| `GET` | `/v1/workspaces/:wsId/files` | List files |
| `POST` | `/v1/workspaces/:wsId/files` | Create empty file / from template |
| `GET` | `/v1/files/:fileId` | Metadata + latest version pointer |
| `GET` | `/v1/files/:fileId/document` | Latest snapshot JSON (or signed URL to R2) |
| `PUT` | `/v1/files/:fileId/document` | Save snapshot (optimistic concurrency: `If-Match: revision`) |

## Versions

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/files/:fileId/versions` | History list |
| `GET` | `/v1/files/:fileId/versions/:versionId` | Fetch specific version |

## Comments

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/files/:fileId/comments` | List threads |
| `POST` | `/v1/files/:fileId/comments` | Create |
| `PATCH` | `/v1/comments/:commentId` | Update body / resolve |
| `DELETE` | `/v1/comments/:commentId` | Soft-delete |

## Assets

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/workspaces/:wsId/assets/upload-url` | Returns `{ url, fields }` for direct `PUT` to R2 |
| `POST` | `/v1/workspaces/:wsId/assets/complete` | Register asset row after upload |

## Plugins

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/plugins/catalog` | Allowlisted plugins |
| `GET` | `/v1/me/plugins` | Installed plugin ids |
| `PUT` | `/v1/me/plugins` | Sync install set |

## WebSocket (separate server)

- **URL**: `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` → `wss://…/yjs`
- **Auth**: ticket query param or `Sec-WebSocket-Protocol` bearer.
- **Subprotocol**: Yjs/Hocuspocus compatible.

## Client

`src/lib/apiClient.ts` implements **local** stubs, **`api`** mode against `/api/v1/*`, and **remote** mode against `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` when configured.
