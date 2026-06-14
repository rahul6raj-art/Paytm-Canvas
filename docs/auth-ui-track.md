# Track 6 — Auth UI (remote mode)

**Status:** complete (phases 6.1–6.3)

Track 5 wired `apiClient.login` / `logout` with session cookies. This track adds **dashboard and editor UI** for real sign-in when `NEXT_PUBLIC_PAYTM_CRAFT_MODE=remote`.

## Goals

- **Login modal** on the dashboard for remote mode.
- **Sign out** in dashboard sidebar and editor account menu (calls `craft-api` `/v1/auth/logout`).
- **401 handling** — prompt login instead of a dead-end error screen.
- **`.env.example`** documents remote stack variables.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **6.1** | `RemoteAuthLoginModal` + `remoteAuthSession` helpers | **Done** |
| **6.2** | Dashboard + editor sign-in / sign-out | **Done** |
| **6.3** | Env example + `verify:remote` coverage | **Done** |

## Dev usage

```bash
npm run dev:remote
# Dashboard → Sign in → rahul.verma@paytm.com / craft-dev
```

## Related docs

- [client-remote-track.md](./client-remote-track.md)
- [backend-track.md](./backend-track.md)
