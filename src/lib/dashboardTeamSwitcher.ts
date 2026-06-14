import type { CraftWorkspace } from "@/lib/apiClient";
import type { DashboardTeamGroup } from "@/lib/dashboardTeamGrouping";

export const DASHBOARD_ACTIVE_TEAM_KEY = "paytm-craft-dashboard-active-team-v1";
const TEAM_CHANGE_EVENT = "paytm-craft-dashboard-active-team-change";

export function readDashboardActiveTeamId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DASHBOARD_ACTIVE_TEAM_KEY)?.trim();
    return raw || null;
  } catch {
    return null;
  }
}

export function writeDashboardActiveTeamId(teamId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DASHBOARD_ACTIVE_TEAM_KEY, teamId);
    window.dispatchEvent(new CustomEvent(TEAM_CHANGE_EVENT));
  } catch {
    /* ignore quota / private mode */
  }
}

export function subscribeDashboardActiveTeam(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => onChange();
  window.addEventListener(TEAM_CHANGE_EVENT, handler);
  return () => window.removeEventListener(TEAM_CHANGE_EVENT, handler);
}

export function isMultiTeamDashboard(groups: DashboardTeamGroup[] | undefined): boolean {
  return (groups?.length ?? 0) > 1;
}

export function resolveDashboardActiveTeamId(params: {
  teamGroups: DashboardTeamGroup[];
  activeWorkspaceTeamId?: string;
  storedTeamId: string | null;
}): string | undefined {
  const { teamGroups, activeWorkspaceTeamId, storedTeamId } = params;
  if (teamGroups.length === 0) return undefined;
  if (teamGroups.length === 1) return teamGroups[0]!.id;

  const validIds = new Set(teamGroups.map((g) => g.id));
  if (storedTeamId && validIds.has(storedTeamId)) return storedTeamId;
  if (activeWorkspaceTeamId && validIds.has(activeWorkspaceTeamId)) return activeWorkspaceTeamId;
  return teamGroups[0]!.id;
}

export function filterTeamGroupsForActiveTeam(
  groups: DashboardTeamGroup[],
  activeTeamId: string | undefined,
): DashboardTeamGroup[] {
  if (!activeTeamId || groups.length <= 1) return groups;
  return groups.filter((g) => g.id === activeTeamId);
}

export function firstWorkspaceIdInTeam(apiWorkspaces: CraftWorkspace[], teamId: string): string | undefined {
  return apiWorkspaces.find((w) => w.teamId === teamId)?.id;
}
