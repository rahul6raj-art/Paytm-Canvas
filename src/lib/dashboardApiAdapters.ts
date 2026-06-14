import type {
  CraftTeam,
  CraftUser,
  CraftWorkspace,
  CraftWorkspaceMember,
  CraftWorkspaceRole,
} from "@/lib/apiClient";
import type { MockMemberRole, MockTeamMember, MockUser, MockWorkspace } from "@/lib/mockAuth";

export function workspaceIdToMockSection(id: string): MockWorkspace["section"] {
  const map: Record<string, MockWorkspace["section"]> = {
    "ws-personal": "personal",
    "ws-paytm-design": "paytm-design",
    "ws-product": "product-team",
    "ws-experiments": "experiments",
    "ws-labs": "experiments",
  };
  return map[id] ?? "personal";
}

export function craftUserToMockUser(u: CraftUser): MockUser {
  const parts = u.displayName.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? "ME");
  return { id: u.id, name: u.displayName, email: u.email, initials, avatarHue: 210 };
}

export function ownerMemberFromCraftUser(u: CraftUser): MockTeamMember {
  const mu = craftUserToMockUser(u);
  return { userId: mu.id, name: mu.name, email: mu.email, initials: mu.initials, role: "owner" };
}

export function craftWorkspaceRoleToMockRole(role: CraftWorkspaceRole): MockMemberRole {
  if (role === "owner") return "owner";
  if (role === "guest") return "viewer";
  return "editor";
}

export function craftWorkspaceRoleLabel(role: CraftWorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "member":
      return "Member";
    case "guest":
      return "Guest";
  }
}

export function craftWorkspaceMemberToMockTeamMember(m: CraftWorkspaceMember): MockTeamMember {
  return {
    userId: m.userId,
    name: m.displayName,
    email: m.email,
    initials: m.initials,
    role: craftWorkspaceRoleToMockRole(m.role),
  };
}

export function craftWorkspaceMembersToMockMembers(members: CraftWorkspaceMember[]): MockTeamMember[] {
  return members.map(craftWorkspaceMemberToMockTeamMember);
}

export function craftWorkspaceToMockWorkspace(
  ws: CraftWorkspace,
  members: MockTeamMember[],
  team?: Pick<CraftTeam, "id" | "name">,
): MockWorkspace {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    section: workspaceIdToMockSection(ws.id),
    members,
    teamId: ws.teamId,
    teamName: team?.name,
  };
}

export function formatApiFileUpdated(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function accentGradientForApiId(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg,hsl(${hue} 70% 45%),hsl(${hue2} 65% 38%))`;
}
