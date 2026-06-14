import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDashboardTeamGroups } from "@/lib/dashboardTeamGrouping";
import type { CraftTeam, CraftWorkspace } from "@/lib/apiClient";
import type { MockWorkspace } from "@/lib/mockAuth";

const team: CraftTeam = { id: "team-paytm", name: "Paytm", slug: "paytm" };

const apiWorkspaces: CraftWorkspace[] = [
  { id: "ws-personal", teamId: "team-paytm", name: "Personal", slug: "personal" },
  { id: "ws-product", teamId: "team-paytm", name: "Product Team", slug: "product-team" },
];

const sidebarWorkspaces: MockWorkspace[] = [
  {
    id: "ws-personal",
    name: "Personal",
    slug: "personal",
    section: "personal",
    members: [],
    teamId: "team-paytm",
    teamName: "Paytm",
  },
  {
    id: "ws-product",
    name: "Product Team",
    slug: "product-team",
    section: "product-team",
    members: [],
    teamId: "team-paytm",
    teamName: "Paytm",
  },
];

describe("dashboardTeamGrouping", () => {
  it("groups sidebar workspaces under API teams", () => {
    const groups = buildDashboardTeamGroups([team], apiWorkspaces, sidebarWorkspaces);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.name, "Paytm");
    assert.equal(groups[0]!.workspaces.length, 2);
    assert.equal(groups[0]!.workspaces[0]!.id, "ws-personal");
  });

  it("omits teams with no visible workspaces", () => {
    const groups = buildDashboardTeamGroups(
      [{ id: "team-other", name: "Other", slug: "other" }],
      apiWorkspaces,
      sidebarWorkspaces,
    );
    assert.equal(groups.length, 0);
  });
});
