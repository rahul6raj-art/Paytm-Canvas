# Track 5 — Remote client integration

**Status:** complete (phases 5.1–5.3)

Tracks 1–4 are complete. This track wires the **Next.js editor** to **`craft-api`** features built in Track 4 without breaking `local` or `api` mock modes.

## Goals

- **Auth client** — `apiClient.login` / `logout` with session cookies (`credentials: 'include'`).
- **Remote asset uploads** — image import uploads to MinIO via presigned PUT when `remote` mode + `apiWorkspaceId` is set.
- **Document validation** — allow `http(s):` asset URLs in saved documents (not only `data:`).
- **`verify:remote`** — offline client regression bundle.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **5.1** | Auth + `credentials` on `apiClient` | **Done** |
| **5.2** | Remote image upload in editor import paths | **Done** |
| **5.3** | `verify:remote` + docs | **Done** |

## Dev usage

```bash
npm run dev:remote
# open http://localhost:3000/editor?fileId=api-file-paytm-1
# import an image — stored in MinIO, referenced by URL in the document
```

## Verification

```bash
npm run verify:remote
```

## Related docs

- [backend-track.md](./backend-track.md)
- [api-persistence-track.md](./api-persistence-track.md)
- [api-contracts.md](./api-contracts.md)
