import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  filterTeamGroupsForActiveTeam,
  firstWorkspaceIdInTeam,
  isMultiTeamDashboard,
  resolveDashboardActiveTeamId,
} from "@/lib/dashboardTeamSwitcher";
import type { DashboardTeamGroup } from "@/lib/dashboardTeamGrouping";
import type { CraftWorkspace } from "@/lib/apiClient";

const paytm: DashboardTeamGroup = {
  id: "team-paytm",
  name: "Paytm",
  slug: "paytm",
  workspaces: [{ id: "ws-personal", name: "Personal", slug: "personal", section: "personal", members: [] }],
};

const labs: DashboardTeamGroup = {
  id: "team-labs",
  name: "Craft Labs",
  slug: "craft-labs",
  workspaces: [{ id: "ws-labs", name: "Labs", slug: "labs", section: "experiments", members: [] }],
};

const apiWorkspaces: CraftWorkspace[] = [
  { id: "ws-personal", teamId: "team-paytm", name: "Personal", slug: "personal" },
  { id: "ws-labs", teamId: "team-labs", name: "Labs", slug: "labs" },
];

describe("dashboardTeamSwitcher", () => {
  it("detects multi-team dashboards", () => {
    assert.equal(isMultiTeamDashboard([paytm]), false);
    assert.equal(isMultiTeamDashboard([paytm, labs]), true);
  });

  it("resolves stored team when valid", () => {
    const id = resolveDashboardActiveTeamId({
      teamGroups: [paytm, labs],
      activeWorkspaceTeamId: "team-paytm",
      storedTeamId: "team-labs",
    });
    assert.equal(id, "team-labs");
  });

  it("falls back to active workspace team then first group", () => {
    assert.equal(
      resolveDashboardActiveTeamId({
        teamGroups: [paytm, labs],
        activeWorkspaceTeamId: "team-paytm",
        storedTeamId: "team-missing",
      }),
      "team-paytm",
    );
    assert.equal(
      resolveDashboardActiveTeamId({
        teamGroups: [paytm, labs],
        storedTeamId: null,
      }),
      "team-paytm",
    );
  });

  it("returns sole team without switcher semantics", () => {
    assert.equal(
      resolveDashboardActiveTeamId({
        teamGroups: [paytm],
        storedTeamId: "team-labs",
      }),
      "team-paytm",
    );
  });

  it("filters groups to the active team", () => {
    const filtered = filterTeamGroupsForActiveTeam([paytm, labs], "team-labs");
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0]!.id, "team-labs");
    assert.equal(filterTeamGroupsForActiveTeam([paytm], "team-paytm").length, 1);
  });

  it("picks first workspace in a team", () => {
    assert.equal(firstWorkspaceIdInTeam(apiWorkspaces, "team-labs"), "ws-labs");
    assert.equal(firstWorkspaceIdInTeam(apiWorkspaces, "team-other"), undefined);
  });
});
