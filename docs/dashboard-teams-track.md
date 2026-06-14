# Track 13 — Dashboard grouped by team

**Status:** complete (phases 13.1–13.2)

Track 12 added the teams API. This track updates the **dashboard UI** to group workspaces under their org team in `api` / `remote` mode.

## Goals

- Load teams + team members alongside workspaces.
- Sidebar: workspace picker uses `<optgroup>` per team; sections panel shows nested team → workspace list.
- Home: files grid grouped by team, then workspace.
- Sidebar avatars show org-level team members for the active workspace's team.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **13.1** | `buildDashboardTeamGroups` helper + tests | **Done** |
| **13.2** | `DashboardShell` / `DashboardSidebar` wiring | **Done** |

## Client

- `dashboardTeamGrouping.ts` — `buildDashboardTeamGroups(teams, apiWorkspaces, sidebarWorkspaces)`
- `apiClient.listTeams()` + `listTeamMembers()` consumed on dashboard load
- Local mode unchanged (mock section labels)

## Verification

```bash
npm run verify:stack
```

## Manual

```bash
npm run dev:api
# or npm run dev:remote
# Dashboard home → "Files by team" with Paytm heading + nested workspaces
# Sidebar workspace dropdown grouped under Paytm
```

## Next

- Production auth hardening (JWT, anon disabled)
- SMTP invite notifications
- Team switcher when multiple teams exist
