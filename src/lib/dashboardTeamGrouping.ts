import type { CraftTeam, CraftWorkspace } from "@/lib/apiClient";
import type { MockWorkspace } from "@/lib/mockAuth";

export type DashboardTeamGroup = {
  id: string;
  name: string;
  slug: string;
  workspaces: MockWorkspace[];
};

export function buildDashboardTeamGroups(
  teams: CraftTeam[],
  apiWorkspaces: CraftWorkspace[],
  sidebarWorkspaces: MockWorkspace[],
): DashboardTeamGroup[] {
  const wsById = new Map(sidebarWorkspaces.map((w) => [w.id, w]));
  const teamIdsWithWorkspaces = new Set(apiWorkspaces.map((w) => w.teamId));

  return teams
    .filter((team) => teamIdsWithWorkspaces.has(team.id))
    .map((team) => ({
      id: team.id,
      name: team.name,
      slug: team.slug,
      workspaces: apiWorkspaces
        .filter((w) => w.teamId === team.id)
        .map((w) => wsById.get(w.id))
        .filter((w): w is MockWorkspace => w != null),
    }))
    .filter((group) => group.workspaces.length > 0);
}
