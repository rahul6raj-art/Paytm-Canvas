# Paytm Craft — integration tracks index

Master checklist for backend, auth, dashboard, deploy, and API token work (Tracks 2–36). **Track 1** (native renderer) is separate — see [native-renderer-migration.md](./native-renderer-migration.md) (terminal **v3.43**).

## Verification commands

| Command | What it checks |
|---------|----------------|
| `npm run verify:stack` | Tracks 2–36 offline (persistence, API, deploy, production kit, canvas chrome, legacy cleanup, CI gate, API contracts, tracks sync, editor/live/migration/docker/release-stack gates) |
| `npm run verify:production` | Track 25 production env template + runbook checks |
| `npm run verify:canvas-chrome` | Track 26 canvas tool rail + shape preview + floating toolbar |
| `npm run verify:legacy-cleanup` | Tracks 27–28 native-only renderer (no rollback paths or dead legacy sources) |
| `npm run verify:ci-gate` | Track 29 CI workflow references `verify:release` (offline, no Rust) |
| `npm run verify:ci` | Track 29 full CI gate — Rust tests + `verify:release` (requires Rust toolchain) |
| `npm run verify:api-contracts` | Track 30 v1 envelope + mock/craft-api route contract tests |
| `npm run verify:tracks-sync` | Track 31 tracks manifest + release gate range alignment |
| `npm run verify:editor-gate` | Track 32 native editor smoke wiring (offline, no browser) |
| `npm run verify:stack-live-gate` | Track 33 live stack smoke wiring (offline, no Docker) |
| `npm run verify:migration-gate` | Track 34 native migration bundle wiring (offline, no Rust) |
| `npm run verify:docker-stack-gate` | Track 35 Docker compose stack wiring (offline, no Docker) |
| `npm run verify:release-stack-gate` | Track 36 release stack runner wiring (offline meta-gate) |
| `npm run verify:editor` | Track 1 browser smoke — native compositor ready (requires `npm run dev`) |
| `npm run verify:stack:live` | Track 18 live Docker stack smoke (requires `stack:up` + `stack:setup`) |
| `npm run verify:migration` | Track 1 native renderer (TS tests + WASM artifacts + golden PNG) |
| `npm run verify:release` | **Full release gate:** `verify:stack` + `verify:migration` |

## Tracks

| # | Topic | Doc | Status |
|---|--------|-----|--------|
| **1** | Native renderer (WASM GPU) | [native-renderer-migration.md](./native-renderer-migration.md) | Complete (v3.43) |
| **2** | API-backed persistence | [api-persistence-track.md](./api-persistence-track.md) | Complete |
| **3** | Dev integration & verify | [integration-track.md](./integration-track.md) | Complete |
| **4** | Postgres backend scaffold | [backend-track.md](./backend-track.md) | Complete |
| **5** | Remote client integration | [client-remote-track.md](./client-remote-track.md) | Complete |
| **6** | Auth UI (remote mode) | [auth-ui-track.md](./auth-ui-track.md) | Complete |
| **7** | Release & Docker stack | [release-track.md](./release-track.md) | Complete |
| **8** | Workspace RBAC | [rbac-track.md](./rbac-track.md) | Complete |
| **9** | Dashboard team API | [team-dashboard-track.md](./team-dashboard-track.md) | Complete |
| **10** | Editor team modals | [editor-team-track.md](./editor-team-track.md) | Complete |
| **11** | Pending email invites | [email-invites-track.md](./email-invites-track.md) | Complete |
| **12** | Teams model | [teams-track.md](./teams-track.md) | Complete |
| **13** | Dashboard grouped by team | [dashboard-teams-track.md](./dashboard-teams-track.md) | Complete |
| **14** | Production auth hardening | [production-track.md](./production-track.md) | Complete |
| **15** | SMTP invite notifications | [smtp-invites-track.md](./smtp-invites-track.md) | Complete |
| **16** | Deploy manifests (K8s / Fly) | [deploy-track.md](./deploy-track.md) | Complete |
| **17** | Team switcher | [team-switcher-track.md](./team-switcher-track.md) | Complete |
| **18** | Live stack smoke test | [live-stack-track.md](./live-stack-track.md) | Complete |
| **19** | API tokens (Bearer auth) | [api-tokens-track.md](./api-tokens-track.md) | Complete |
| **20** | API token management UI | [api-token-ui-track.md](./api-token-ui-track.md) | Complete |
| **21** | Scoped API tokens | [api-token-scopes-track.md](./api-token-scopes-track.md) | Complete |
| **22** | Release bundle + tracks index | [integration-release-track.md](./integration-release-track.md) | Complete |
| **23** | Per-resource API token scopes | [api-token-resource-scopes-track.md](./api-token-resource-scopes-track.md) | Complete |
| **24** | Mock API bearer tokens (`api` mode) | [mock-api-tokens-track.md](./mock-api-tokens-track.md) | Complete |
| **25** | Production deploy (hosted Postgres, R2, SMTP) | [production-deploy-track.md](./production-deploy-track.md) | Complete |
| **26** | Figma canvas chrome | [canvas-chrome-track.md](./canvas-chrome-track.md) | Complete |
| **27** | Legacy renderer cleanup | [legacy-renderer-cleanup-track.md](./legacy-renderer-cleanup-track.md) | Complete |
| **28** | Legacy renderer dead code removal | [legacy-dead-code-track.md](./legacy-dead-code-track.md) | Complete |
| **29** | CI release gate alignment | [ci-release-gate-track.md](./ci-release-gate-track.md) | Complete |
| **30** | API contracts + architecture docs | [api-contracts-track.md](./api-contracts-track.md) | Complete |
| **31** | Tracks manifest & release gate sync | [tracks-manifest-track.md](./tracks-manifest-track.md) | Complete |
| **32** | Native editor smoke gate (offline) | [editor-smoke-gate-track.md](./editor-smoke-gate-track.md) | Complete |
| **33** | Live stack smoke gate (offline) | [live-stack-gate-track.md](./live-stack-gate-track.md) | Complete |
| **34** | Native migration verify gate (offline) | [migration-verify-gate-track.md](./migration-verify-gate-track.md) | Complete |
| **35** | Docker stack gate (offline) | [docker-stack-gate-track.md](./docker-stack-gate-track.md) | Complete |
| **36** | Release stack gate (offline) | [release-stack-gate-track.md](./release-stack-gate-track.md) | Complete |

**Track 1** (native renderer) stays **terminal at v3.43** — maintenance only unless new GPU features are required.

## Quick start (full remote stack)

```bash
npm run stack:up && npm run stack:setup
npm run dev:remote
# Sign in: rahul.verma@paytm.com / craft-dev
```

## See also

- [deployment.md](./deployment.md) — topology, env vars, production profile
- [api-contracts.md](./api-contracts.md) — REST shapes under `/v1`
