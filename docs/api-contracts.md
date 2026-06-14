# Paytm Craft — API contracts

**Status:** reference (Tracks 2–24, **Track 30** contract tests)

REST-style **JSON** under a versioned prefix (`/v1`). Mock and production handlers return a stable envelope:

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

Implemented routes: `GET /api/v1/me`, `GET /api/v1/workspaces`, `GET|POST /api/v1/files`, `GET|PUT /api/v1/files/[fileId]`, `GET|POST /api/v1/comments`, `PATCH|DELETE /api/v1/comments/[commentId]`.

`GET /api/v1/files/[fileId]` returns a `revision` string. `PUT` accepts optional `If-Match: <revision>`; mismatches return **409** with `{ "error": { "code": "CONFLICT", … } }`.

In **`api`** or **`remote`** mode, the editor uses **`ApiSyncProvider`** / **`RemoteSyncProvider`** for HTTP persistence: debounced saves go to `PUT /v1/files/:fileId` with `If-Match` when a file session is active, with `localStorage` as a local cache. See [api-persistence-track.md](./api-persistence-track.md).

Real auth routes are implemented on **`craft-api`** (`POST /v1/auth/register`, `login`, `logout`, `GET /v1/auth/me`) with HttpOnly session cookies. Set `CRAFT_API_ALLOW_ANON=0` and `CRAFT_API_ENV=production` for production (Track 14). The Next.js mock in **`api`** mode still uses a fixed in-memory user.

**Assets** on **`craft-api`** (remote mode): `POST /v1/workspaces/:wsId/assets/upload-url` (presigned PUT), `POST .../complete`, multipart `POST .../assets`, `GET .../assets`. Local dev uses MinIO (`npm run storage:setup`).

**Workspace RBAC** (Track 8): `GET|POST /v1/workspaces/:wsId/members`; file and asset routes check `workspace_members`. Disable with `CRAFT_API_RBAC=0`.

**Teams** (Track 12): `GET /v1/teams`, `GET /v1/teams/:teamId/members`; workspaces include `teamId`. Team membership inherits to workspaces unless `workspace_members` overrides.

**Email invites** (Track 11): `GET|POST /v1/workspaces/:wsId/invites`; pending invites accepted on register.

**API tokens** (Track 19): `GET|POST /v1/auth/tokens`, `DELETE /v1/auth/tokens/:id` (session cookie only). Use `Authorization: Bearer craft_pat_…` on `/v1/*` and as realtime `sessionToken`.

## Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/auth/register` | Create user; returns tokens or session cookie |
| `POST` | `/v1/auth/login` | Issue tokens / session |
| `POST` | `/v1/auth/logout` | Invalidate session / refresh |
| `GET` | `/v1/auth/me` | Current user profile |
| `GET` | `/v1/auth/tokens` | List personal access tokens (prefix only) |
| `POST` | `/v1/auth/tokens` | Create token (`{ name, scope?, expiresInDays? }`); returns secret once |
| `DELETE` | `/v1/auth/tokens/:tokenId` | Revoke token |

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

See [api-persistence-track.md](./api-persistence-track.md) for the API persistence roadmap.

## Verification (Track 30)

```bash
npm run verify:api-contracts
npm test -- src/lib/__tests__/apiContracts.test.ts
```

Envelope helpers: `src/lib/apiEnvelope.ts`. Route manifest: `src/lib/apiContractManifest.ts`.
