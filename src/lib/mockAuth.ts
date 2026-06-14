export const MOCK_ACTIVE_WORKSPACE_KEY = "paytm-craft-mock-active-workspace-v1";
export const MOCK_PENDING_INVITES_KEY = "paytm-craft-mock-pending-invites-v1";

const AUTH_CHANGE_EVENT = "paytm-craft-mock-auth-change";

export type MockMemberRole = "owner" | "editor" | "viewer";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  initials: string;
  /** CSS hue for avatar ring */
  avatarHue: number;
}

export interface MockTeamMember {
  userId: string;
  name: string;
  email: string;
  initials: string;
  role: MockMemberRole;
}

export type MockWorkspaceSection = "personal" | "paytm-design" | "product-team" | "experiments";

export interface MockWorkspace {
  id: string;
  name: string;
  slug: string;
  section: MockWorkspaceSection;
  members: MockTeamMember[];
  /** Set when loaded from API (Track 12+). */
  teamId?: string;
  teamName?: string;
}

export interface MockPendingInvite {
  id: string;
  workspaceId: string;
  email: string;
  createdAt: string;
}

const MOCK_USER: MockUser = {
  id: "user-you",
  name: "Rahul Verma",
  email: "rahul.verma@paytm.com",
  initials: "RV",
  avatarHue: 210,
};

export const DEFAULT_MOCK_WORKSPACE: MockWorkspace = {
  id: "ws-personal",
  name: "Personal",
  slug: "personal",
  section: "personal",
  members: [
    { userId: "user-you", name: "Rahul Verma", email: "rahul.verma@paytm.com", initials: "RV", role: "owner" },
  ],
};

const MOCK_WORKSPACES: MockWorkspace[] = [
  {
    id: "ws-personal",
    name: "Personal",
    slug: "personal",
    section: "personal",
    members: [
      { userId: "user-you", name: "Rahul Verma", email: "rahul.verma@paytm.com", initials: "RV", role: "owner" },
    ],
  },
  {
    id: "ws-paytm-design",
    name: "Paytm Design",
    slug: "paytm-design",
    section: "paytm-design",
    members: [
      { userId: "user-you", name: "Rahul Verma", email: "rahul.verma@paytm.com", initials: "RV", role: "owner" },
      { userId: "u2", name: "Aisha Khan", email: "aisha.khan@paytm.com", initials: "AK", role: "editor" },
      { userId: "u3", name: "Dev Sharma", email: "dev.sharma@paytm.com", initials: "DS", role: "editor" },
      { userId: "u4", name: "Meera N.", email: "meera@paytm.com", initials: "MN", role: "viewer" },
    ],
  },
  {
    id: "ws-product",
    name: "Product Team",
    slug: "product-team",
    section: "product-team",
    members: [
      { userId: "user-you", name: "Rahul Verma", email: "rahul.verma@paytm.com", initials: "RV", role: "editor" },
      { userId: "u5", name: "Priya Rao", email: "priya.rao@paytm.com", initials: "PR", role: "owner" },
      { userId: "u6", name: "Karan Mehta", email: "karan@paytm.com", initials: "KM", role: "viewer" },
    ],
  },
  {
    id: "ws-experiments",
    name: "Experiments",
    slug: "experiments",
    section: "experiments",
    members: [
      { userId: "user-you", name: "Rahul Verma", email: "rahul.verma@paytm.com", initials: "RV", role: "owner" },
      { userId: "u7", name: "Sana Ali", email: "sana@paytm.com", initials: "SA", role: "editor" },
    ],
  },
];

function emitAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
}

export function subscribeMockAuth(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(AUTH_CHANGE_EVENT, handler);
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, handler);
}

function readActiveWorkspaceId(): string {
  if (typeof window === "undefined") return DEFAULT_MOCK_WORKSPACE.id;
  try {
    const raw = window.localStorage.getItem(MOCK_ACTIVE_WORKSPACE_KEY);
    if (raw && MOCK_WORKSPACES.some((w) => w.id === raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_MOCK_WORKSPACE.id;
}

export function getMockCurrentUser(): MockUser {
  return MOCK_USER;
}

export function getMockWorkspaces(): MockWorkspace[] {
  return MOCK_WORKSPACES;
}

export function getActiveMockWorkspace(): MockWorkspace {
  const id = readActiveWorkspaceId();
  return MOCK_WORKSPACES.find((w) => w.id === id) ?? DEFAULT_MOCK_WORKSPACE;
}

export function switchMockWorkspace(workspaceId: string): void {
  if (!MOCK_WORKSPACES.some((w) => w.id === workspaceId)) return;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOCK_ACTIVE_WORKSPACE_KEY, workspaceId);
  } catch {
    /* ignore */
  }
  emitAuthChange();
}

export function readPendingInvites(): MockPendingInvite[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MOCK_PENDING_INVITES_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is MockPendingInvite =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as MockPendingInvite).id === "string" &&
        typeof (x as MockPendingInvite).workspaceId === "string" &&
        typeof (x as MockPendingInvite).email === "string" &&
        typeof (x as MockPendingInvite).createdAt === "string",
    );
  } catch {
    return [];
  }
}

function writePendingInvites(invites: MockPendingInvite[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MOCK_PENDING_INVITES_KEY, JSON.stringify(invites));
  } catch {
    /* ignore */
  }
}

export function inviteMockMember(email: string): MockPendingInvite | null {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) return null;
  const ws = getActiveMockWorkspace();
  const invites = readPendingInvites();
  if (invites.some((i) => i.workspaceId === ws.id && i.email === trimmed)) {
    return invites.find((i) => i.workspaceId === ws.id && i.email === trimmed) ?? null;
  }
  const row: MockPendingInvite = {
    id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    workspaceId: ws.id,
    email: trimmed,
    createdAt: new Date().toISOString(),
  };
  writePendingInvites([row, ...invites]);
  emitAuthChange();
  return row;
}

/** For Share modal — mock people with access (subset + labels). */
export function getMockSharePeopleForActiveWorkspace(): { name: string; email: string; initials: string; access: string }[] {
  const ws = getActiveMockWorkspace();
  return ws.members.map((m) => ({
    name: m.name,
    email: m.email,
    initials: m.initials,
    access: m.role === "viewer" ? "Can view" : "Can edit",
  }));
}
