# Track 17 — Team switcher (multi-org dashboard)

**Status:** complete (phases 17.1–17.2)

Track 13 grouped workspaces under teams. This track adds an **active team** control when the signed-in user belongs to **more than one** org team.

## Goals

- Persist active team in `localStorage` (`paytm-craft-dashboard-active-team-v1`).
- Sidebar: team dropdown above workspace picker when 2+ teams exist.
- Dashboard scoped to active team — workspace list, home file grid, org avatars.
- Switching team moves to the first workspace in that team when needed.
- Second seeded team (`Craft Labs`) for local / Docker testing.

## Phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **17.1** | `dashboardTeamSwitcher.ts` + tests + seed second team | **Done** |
| **17.2** | `DashboardShell` / `DashboardSidebar` wiring | **Done** |

## Client

- `dashboardTeamSwitcher.ts` — resolve / filter / persist active team
- `DashboardSidebar` — optional team `<select>` when `teamSwitcher` prop set
- `DashboardShell` — filters `dashboardTeamGroups` to active team; `handleSwitchTeam`

## Seed data

| Team | Workspace |
|------|-----------|
| Paytm (`team-paytm`) | Personal, Paytm Design, Product Team, Experiments |
| Craft Labs (`team-labs`) | Labs (`ws-labs`) |

## Verification

```bash
npm run verify:stack
```

## Manual

```bash
npm run dev:api
# Sidebar → Team dropdown: Paytm | Craft Labs
# Switch team → workspace + files scope updates
```

## Next

- API tokens — see [api-tokens-track.md](./api-tokens-track.md)
- Native renderer (Track 1 terminal)
