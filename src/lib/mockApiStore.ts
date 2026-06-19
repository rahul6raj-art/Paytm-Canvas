import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import {
  computeMockApiTokenExpiresAt,
  hashMockApiToken,
  mockApiTokenDisplayPrefix,
  mockApiTokenToDto,
  newMockApiTokenSecret,
  parseMockApiTokenExpiresInDays,
  type MockApiTokenRow,
} from "@/lib/mockApiToken";
import type { MockApiTokenResourceScope, MockApiTokenScope } from "@/lib/mockApiTokenScope";
import {
  deserializeMockApiStore,
  isMockApiStorePersistenceEnabled,
  loadMockApiStoreFromDisk,
  saveMockApiStoreToDisk,
  serializeMockApiStore,
} from "@/lib/mockApiStorePersistence";

const STORE_KEY = "__paytmCraftMockApiStore_v1__" as const;

export interface MockApiUserRow {
  id: string;
  email: string;
  displayName: string;
}

export interface MockApiWorkspaceRow {
  id: string;
  teamId: string;
  name: string;
  slug: string;
}

export interface MockApiTeamRow {
  id: string;
  name: string;
  slug: string;
}

export type MockApiTeamRole = MockApiWorkspaceRole;

export interface MockApiTeamMemberRow {
  teamId: string;
  userId: string;
  role: MockApiTeamRole;
}

export type MockApiWorkspaceRole = "owner" | "admin" | "member" | "guest";

export interface MockApiMemberRow {
  workspaceId: string;
  userId: string;
  role: MockApiWorkspaceRole;
}

export interface MockApiInviteRow {
  id: string;
  workspaceId: string;
  email: string;
  role: MockApiWorkspaceRole;
  invitedByUserId: string;
  createdAt: string;
  acceptedAt?: string | null;
}

export interface MockApiFileRow {
  id: string;
  workspaceId: string;
  name: string;
  documentJson: unknown | null;
  createdAt: string;
  updatedAt: string;
  /** Optimistic concurrency token; bumped on every successful PUT. */
  revision: string;
}

/** Snapshot row; `documentJson` matches {@link PaytmCraftDocument} once validated at HTTP boundaries. */
export interface MockApiVersionRow {
  id: string;
  fileId: string;
  name: string;
  createdAt: string;
  createdByUserId: string;
  documentJson: unknown;
}

export interface MockApiCommentRow {
  id: string;
  fileId: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  x?: number;
  y?: number;
  parentNodeId?: string;
  frameId?: string;
}

interface MockApiStoreState {
  users: MockApiUserRow[];
  teams: MockApiTeamRow[];
  teamMembers: MockApiTeamMemberRow[];
  workspaces: MockApiWorkspaceRow[];
  members: MockApiMemberRow[];
  invites: MockApiInviteRow[];
  apiTokens: MockApiTokenRow[];
  files: Map<string, MockApiFileRow>;
  comments: Map<string, MockApiCommentRow>;
  versions: Map<string, MockApiVersionRow>;
  nextSeq: number;
}

function emptyDocument(name: string): unknown {
  return {
    version: 1 as const,
    name,
    savedAt: new Date().toISOString(),
    nodes: {},
    childOrder: { [EDITOR_ROOT_KEY]: [] },
    selectedIds: [] as string[],
    comments: [] as unknown[],
  };
}

function seedStore(): MockApiStoreState {
  const users: MockApiUserRow[] = [
    { id: "user-you", email: "rahul6.raj@paytm.com", displayName: "Rahul Raj" },
    { id: "u2", email: "aisha.khan@paytm.com", displayName: "Aisha Khan" },
    { id: "u3", email: "dev.sharma@paytm.com", displayName: "Dev Sharma" },
    { id: "u4", email: "meera@paytm.com", displayName: "Meera N." },
  ];

  const workspaces: MockApiWorkspaceRow[] = [
    { id: "ws-personal", teamId: "team-paytm", name: "Personal", slug: "personal" },
    { id: "ws-paytm-design", teamId: "team-paytm", name: "Paytm Design", slug: "paytm-design" },
    { id: "ws-product", teamId: "team-paytm", name: "Product Team", slug: "product-team" },
    { id: "ws-experiments", teamId: "team-paytm", name: "Experiments", slug: "experiments" },
    { id: "ws-labs", teamId: "team-labs", name: "Labs", slug: "labs" },
  ];

  const teams: MockApiTeamRow[] = [
    { id: "team-paytm", name: "Paytm", slug: "paytm" },
    { id: "team-labs", name: "Craft Labs", slug: "craft-labs" },
  ];

  const teamMembers: MockApiTeamMemberRow[] = [
    { teamId: "team-paytm", userId: "user-you", role: "owner" },
    { teamId: "team-paytm", userId: "u2", role: "member" },
    { teamId: "team-paytm", userId: "u3", role: "member" },
    { teamId: "team-paytm", userId: "u4", role: "guest" },
    { teamId: "team-labs", userId: "user-you", role: "owner" },
  ];

  const members: MockApiMemberRow[] = [
    { workspaceId: "ws-personal", userId: "user-you", role: "owner" },
    { workspaceId: "ws-paytm-design", userId: "user-you", role: "owner" },
    { workspaceId: "ws-product", userId: "user-you", role: "owner" },
    { workspaceId: "ws-experiments", userId: "user-you", role: "owner" },
    { workspaceId: "ws-labs", userId: "user-you", role: "owner" },
    { workspaceId: "ws-paytm-design", userId: "u2", role: "member" },
    { workspaceId: "ws-paytm-design", userId: "u3", role: "member" },
    { workspaceId: "ws-paytm-design", userId: "u4", role: "guest" },
    { workspaceId: "ws-product", userId: "u2", role: "member" },
  ];

  const now = new Date().toISOString();
  const files = new Map<string, MockApiFileRow>();
  const seedFiles: MockApiFileRow[] = [
    {
      id: "api-file-paytm-1",
      workspaceId: "ws-paytm-design",
      name: "Mobile App Flow",
      documentJson: emptyDocument("Mobile App Flow"),
      createdAt: now,
      updatedAt: now,
      revision: "1",
    },
    {
      id: "api-file-paytm-2",
      workspaceId: "ws-paytm-design",
      name: "Marketing landing",
      documentJson: emptyDocument("Marketing landing"),
      createdAt: now,
      updatedAt: now,
      revision: "1",
    },
    {
      id: "api-file-product-1",
      workspaceId: "ws-product",
      name: "Checkout v2",
      documentJson: emptyDocument("Checkout v2"),
      createdAt: now,
      updatedAt: now,
      revision: "1",
    },
    {
      id: "api-file-personal-1",
      workspaceId: "ws-personal",
      name: "Scratch pad",
      documentJson: null,
      createdAt: now,
      updatedAt: now,
      revision: "1",
    },
    {
      id: "api-file-labs-1",
      workspaceId: "ws-labs",
      name: "Prototype sandbox",
      documentJson: emptyDocument("Prototype sandbox"),
      createdAt: now,
      updatedAt: now,
      revision: "1",
    },
  ];
  for (const f of seedFiles) {
    files.set(f.id, f);
  }

  const comments = new Map<string, MockApiCommentRow>();
  comments.set("api-comment-1", {
    id: "api-comment-1",
    fileId: "api-file-paytm-1",
    body: "Consider tightening header spacing on small screens.",
    createdAt: now,
    resolved: false,
  });
  comments.set("api-comment-2", {
    id: "api-comment-2",
    fileId: "api-file-paytm-1",
    body: "LGTM for the grid rhythm.",
    createdAt: now,
    resolved: true,
  });

  return { users, teams, teamMembers, workspaces, members, invites: [], apiTokens: [], files, comments, versions: new Map(), nextSeq: 100 };
}

function getState(): MockApiStoreState {
  const g = globalThis as unknown as Record<string, MockApiStoreState | undefined>;
  if (!g[STORE_KEY]) {
    const loaded = loadMockApiStoreFromDisk();
    if (loaded) {
      const state = deserializeMockApiStore(loaded);
      if (state.members.length === 0) {
        state.members = seedStore().members;
      }
      if (!state.invites) {
        state.invites = [];
      }
      if (!state.teams?.length) {
        state.teams = seedStore().teams;
      }
      if (!state.teamMembers?.length) {
        state.teamMembers = seedStore().teamMembers;
      }
      if (!state.apiTokens) {
        state.apiTokens = [];
      }
      for (const ws of state.workspaces) {
        if (!ws.teamId) ws.teamId = "team-paytm";
      }
      g[STORE_KEY] = state;
    } else {
      g[STORE_KEY] = seedStore();
    }
  }
  return g[STORE_KEY]!;
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleMockApiStorePersist(): void {
  if (!isMockApiStorePersistenceEnabled()) return;
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    saveMockApiStoreToDisk(serializeMockApiStore(getState()));
  }, 40);
}

/** Clear in-memory mock API state (unit tests only). */
export function resetMockApiStoreForTests(): void {
  const g = globalThis as unknown as Record<string, MockApiStoreState | undefined>;
  delete g[STORE_KEY];
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

export function memberToDto(row: MockApiMemberRow): {
  userId: string;
  email: string;
  displayName: string;
  initials: string;
  role: MockApiWorkspaceRole;
} {
  const s = getState();
  const user = s.users.find((u) => u.id === row.userId);
  const displayName = user?.displayName ?? row.userId;
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? "??");
  return {
    userId: row.userId,
    email: user?.email ?? "",
    displayName,
    initials,
    role: row.role,
  };
}

export function teamMemberToDto(row: MockApiTeamMemberRow): {
  userId: string;
  email: string;
  displayName: string;
  initials: string;
  role: MockApiTeamRole;
} {
  const s = getState();
  const user = s.users.find((u) => u.id === row.userId);
  const displayName = user?.displayName ?? row.userId;
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0]![0]!}${parts[parts.length - 1]![0]!}`.toUpperCase()
      : (parts[0]?.slice(0, 2).toUpperCase() ?? "??");
  return {
    userId: row.userId,
    email: user?.email ?? "",
    displayName,
    initials,
    role: row.role,
  };
}

export function inviteToDto(row: MockApiInviteRow): {
  id: string;
  workspaceId: string;
  email: string;
  role: MockApiWorkspaceRole;
  invitedByUserId: string;
  createdAt: string;
} {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    invitedByUserId: row.invitedByUserId,
    createdAt: row.createdAt,
  };
}

export function fileToSummary(row: MockApiFileRow): {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: string;
  revision: string;
} {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    updatedAt: row.updatedAt,
    revision: row.revision,
  };
}

export function commentToDto(row: MockApiCommentRow): {
  id: string;
  fileId: string;
  body: string;
  createdAt: string;
  resolved: boolean;
  x?: number;
  y?: number;
  parentNodeId?: string;
  frameId?: string;
} {
  return {
    id: row.id,
    fileId: row.fileId,
    body: row.body,
    createdAt: row.createdAt,
    resolved: row.resolved,
    ...(typeof row.x === "number" ? { x: row.x } : {}),
    ...(typeof row.y === "number" ? { y: row.y } : {}),
    ...(row.parentNodeId ? { parentNodeId: row.parentNodeId } : {}),
    ...(row.frameId ? { frameId: row.frameId } : {}),
  };
}

export function fileVersionToListDto(row: MockApiVersionRow): {
  id: string;
  fileId: string;
  name: string;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
} {
  const s = getState();
  const u = s.users.find((x) => x.id === row.createdByUserId);
  return {
    id: row.id,
    fileId: row.fileId,
    name: row.name,
    createdAt: row.createdAt,
    createdByUserId: row.createdByUserId,
    createdByDisplayName: u?.displayName ?? row.createdByUserId,
  };
}

export function fileVersionToDetailDto(row: MockApiVersionRow): {
  id: string;
  fileId: string;
  name: string;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
  documentJson: unknown;
} {
  return { ...fileVersionToListDto(row), documentJson: row.documentJson };
}

export const mockApiStore = {
  getCurrentUser(): MockApiUserRow {
    return getState().users[0]!;
  },

  getUserById(userId: string): MockApiUserRow | undefined {
    return getState().users.find((u) => u.id === userId);
  },

  listApiTokens(userId?: string): ReturnType<typeof mockApiTokenToDto>[] {
    const uid = userId ?? getState().users[0]!.id;
    return getState()
      .apiTokens.filter((t) => t.userId === uid && !t.revokedAt)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .map(mockApiTokenToDto);
  },

  createApiToken(input: {
    userId?: string;
    name: string;
    scope?: MockApiTokenScope;
    resourceScopes?: MockApiTokenResourceScope[];
    expiresInDays?: number | null;
  }): { row: ReturnType<typeof mockApiTokenToDto>; token: string } {
    const s = getState();
    const userId = input.userId ?? s.users[0]!.id;
    const name = input.name.trim();
    if (!name) throw new Error("token name required");
    const scope = input.scope ?? "write";
    const resourceScopes = input.resourceScopes ?? [];
    const parsedDays =
      input.expiresInDays == null ? null : parseMockApiTokenExpiresInDays(input.expiresInDays);
    if (input.expiresInDays != null && parsedDays === undefined) {
      throw new Error("expiresInDays must be 1–365");
    }
    const token = newMockApiTokenSecret();
    const row: MockApiTokenRow = {
      id: `pat-mock-${++s.nextSeq}`,
      userId,
      name,
      tokenHash: hashMockApiToken(token),
      tokenPrefix: mockApiTokenDisplayPrefix(token),
      scope,
      resourceScopes,
      expiresAt: computeMockApiTokenExpiresAt(parsedDays ?? null),
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    s.apiTokens.push(row);
    scheduleMockApiStorePersist();
    return { row: mockApiTokenToDto(row), token };
  },

  revokeApiToken(userId: string, tokenId: string): boolean {
    const s = getState();
    const row = s.apiTokens.find((t) => t.id === tokenId && t.userId === userId && !t.revokedAt);
    if (!row) return false;
    row.revokedAt = new Date().toISOString();
    scheduleMockApiStorePersist();
    return true;
  },

  findApiTokenBySecret(token: string): MockApiTokenRow | null {
    const row = getState().apiTokens.find((t) => t.tokenHash === hashMockApiToken(token));
    if (!row || row.revokedAt) return null;
    if (row.expiresAt && Date.parse(row.expiresAt) <= Date.now()) return null;
    return row;
  },

  touchApiToken(tokenId: string): void {
    const s = getState();
    const row = s.apiTokens.find((t) => t.id === tokenId);
    if (!row) return;
    row.lastUsedAt = new Date().toISOString();
    scheduleMockApiStorePersist();
  },

  listWorkspaces(): MockApiWorkspaceRow[] {
    return [...getState().workspaces];
  },

  listTeams(): MockApiTeamRow[] {
    return [...getState().teams];
  },

  listTeamMembers(teamId: string): ReturnType<typeof teamMemberToDto>[] {
    const s = getState();
    return s.teamMembers.filter((m) => m.teamId === teamId).map(teamMemberToDto);
  },

  workspaceExists(workspaceId: string): boolean {
    return getState().workspaces.some((w) => w.id === workspaceId);
  },

  listWorkspaceMembers(workspaceId: string): ReturnType<typeof memberToDto>[] {
    const s = getState();
    return s.members
      .filter((m) => m.workspaceId === workspaceId)
      .map(memberToDto);
  },

  inviteWorkspaceMember(
    workspaceId: string,
    input: { email: string; role?: MockApiWorkspaceRole },
  ): ReturnType<typeof memberToDto> | { code: "NOT_FOUND" } | { code: "VALIDATION" } | { code: "CONFLICT" } {
    const outcome = mockApiStore.inviteToWorkspace(workspaceId, input);
    if ("code" in outcome) return outcome;
    if (outcome.kind === "invite") return { code: "NOT_FOUND" };
    return outcome.member;
  },

  listWorkspaceInvites(workspaceId: string): ReturnType<typeof inviteToDto>[] {
    const s = getState();
    return s.invites
      .filter((i) => i.workspaceId === workspaceId && !i.acceptedAt)
      .map(inviteToDto);
  },

  inviteToWorkspace(
    workspaceId: string,
    input: { email: string; role?: MockApiWorkspaceRole },
  ):
    | { kind: "member"; member: ReturnType<typeof memberToDto> }
    | { kind: "invite"; invite: ReturnType<typeof inviteToDto> }
    | { code: "VALIDATION" }
    | { code: "CONFLICT" } {
    const s = getState();
    if (!s.workspaces.some((w) => w.id === workspaceId)) return { code: "VALIDATION" };
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes("@")) return { code: "VALIDATION" };
    const role = input.role ?? "member";
    const user = s.users.find((u) => u.email.toLowerCase() === email);
    if (user) {
      const existing = s.members.find((m) => m.workspaceId === workspaceId && m.userId === user.id);
      if (existing) return { code: "CONFLICT" };
      const row: MockApiMemberRow = { workspaceId, userId: user.id, role };
      s.members.push(row);
      const pendingIdx = s.invites.findIndex((i) => i.workspaceId === workspaceId && i.email === email);
      if (pendingIdx >= 0) s.invites[pendingIdx] = { ...s.invites[pendingIdx]!, acceptedAt: new Date().toISOString() };
      scheduleMockApiStorePersist();
      return { kind: "member", member: memberToDto(row) };
    }
    const inviter = s.users[0];
    if (!inviter) return { code: "VALIDATION" };
    const now = new Date().toISOString();
    const idx = s.invites.findIndex((i) => i.workspaceId === workspaceId && i.email === email && !i.acceptedAt);
    const inviteRow: MockApiInviteRow = {
      id: idx >= 0 ? s.invites[idx]!.id : `api-inv-${Date.now()}-${s.nextSeq++}`,
      workspaceId,
      email,
      role,
      invitedByUserId: inviter.id,
      createdAt: idx >= 0 ? s.invites[idx]!.createdAt : now,
      acceptedAt: null,
    };
    if (idx >= 0) s.invites[idx] = inviteRow;
    else s.invites.push(inviteRow);
    scheduleMockApiStorePersist();
    return { kind: "invite", invite: inviteToDto(inviteRow) };
  },

  listFiles(workspaceId?: string): MockApiFileRow[] {
    const rows = [...getState().files.values()];
    const filtered = workspaceId ? rows.filter((f) => f.workspaceId === workspaceId) : rows;
    return filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  getFile(fileId: string): MockApiFileRow | undefined {
    return getState().files.get(fileId);
  },

  createFile(input: { workspaceId: string; name: string; documentJson?: unknown | null }): MockApiFileRow {
    const s = getState();
    const id = `api-file-${Date.now()}-${s.nextSeq++}`;
    const now = new Date().toISOString();
    let doc: unknown | null;
    if (input.documentJson === undefined) {
      doc = emptyDocument(input.name.trim());
    } else {
      doc = input.documentJson;
    }
    const row: MockApiFileRow = {
      id,
      workspaceId: input.workspaceId,
      name: input.name.trim(),
      documentJson: doc,
      createdAt: now,
      updatedAt: now,
      revision: "1",
    };
    s.files.set(id, row);
    scheduleMockApiStorePersist();
    return row;
  },

  updateFile(
    fileId: string,
    patch: { name?: string; documentJson?: unknown | null },
    opts?: { ifMatch?: string },
  ):
    | { ok: true; row: MockApiFileRow }
    | { ok: false; code: "NOT_FOUND" }
    | { ok: false; code: "CONFLICT"; currentRevision: string } {
    const s = getState();
    const cur = s.files.get(fileId);
    if (!cur) return { ok: false, code: "NOT_FOUND" };
    if (opts?.ifMatch !== undefined && opts.ifMatch !== cur.revision) {
      return { ok: false, code: "CONFLICT", currentRevision: cur.revision };
    }
    const now = new Date().toISOString();
    const nextRevision = String(Number(cur.revision) + 1);
    const next: MockApiFileRow = {
      ...cur,
      name: patch.name !== undefined ? patch.name.trim() : cur.name,
      documentJson: patch.documentJson !== undefined ? patch.documentJson : cur.documentJson,
      updatedAt: now,
      revision: nextRevision,
    };
    s.files.set(fileId, next);
    scheduleMockApiStorePersist();
    return { ok: true, row: next };
  },

  listFileVersions(fileId: string): MockApiVersionRow[] {
    const s = getState();
    if (!s.files.has(fileId)) return [];
    return [...s.versions.values()]
      .filter((v) => v.fileId === fileId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  getFileVersion(fileId: string, versionId: string): MockApiVersionRow | undefined {
    const v = getState().versions.get(versionId);
    if (!v || v.fileId !== fileId) return undefined;
    return v;
  },

  createFileVersion(input: {
    fileId: string;
    name?: string;
    documentJson: unknown;
  }): MockApiVersionRow | undefined {
    const s = getState();
    if (!s.files.has(input.fileId)) return undefined;
    const user = s.users[0];
    if (!user) return undefined;
    const id = `api-ver-${Date.now()}-${s.nextSeq++}`;
    const now = new Date().toISOString();
    const name =
      typeof input.name === "string" && input.name.trim()
        ? input.name.trim()
        : `Version ${new Date(now).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`;
    const row: MockApiVersionRow = {
      id,
      fileId: input.fileId,
      name,
      createdAt: now,
      createdByUserId: user.id,
      documentJson: input.documentJson,
    };
    s.versions.set(id, row);
    scheduleMockApiStorePersist();
    return row;
  },

  restoreFileFromVersion(fileId: string, versionId: string): MockApiFileRow | undefined {
    const s = getState();
    const v = s.versions.get(versionId);
    if (!v || v.fileId !== fileId) return undefined;
    const cur = s.files.get(fileId);
    if (!cur) return undefined;
    const now = new Date().toISOString();
    const next: MockApiFileRow = {
      ...cur,
      documentJson: v.documentJson,
      updatedAt: now,
      revision: String(Number(cur.revision) + 1),
    };
    s.files.set(fileId, next);
    scheduleMockApiStorePersist();
    return next;
  },

  listComments(fileId: string): MockApiCommentRow[] {
    return [...getState().comments.values()]
      .filter((c) => c.fileId === fileId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  createComment(input: {
    fileId: string;
    body: string;
    x?: number;
    y?: number;
    parentNodeId?: string;
    frameId?: string;
  }): MockApiCommentRow | undefined {
    const s = getState();
    if (!s.files.has(input.fileId)) return undefined;
    const id = `api-comment-${Date.now()}-${s.nextSeq++}`;
    const now = new Date().toISOString();
    const row: MockApiCommentRow = {
      id,
      fileId: input.fileId,
      body: typeof input.body === "string" ? input.body.trim() : "",
      createdAt: now,
      resolved: false,
      ...(typeof input.x === "number" && !Number.isNaN(input.x) ? { x: input.x } : {}),
      ...(typeof input.y === "number" && !Number.isNaN(input.y) ? { y: input.y } : {}),
      ...(input.parentNodeId ? { parentNodeId: input.parentNodeId } : {}),
      ...(input.frameId ? { frameId: input.frameId } : {}),
    };
    s.comments.set(id, row);
    scheduleMockApiStorePersist();
    return row;
  },

  updateComment(
    commentId: string,
    patch: { body?: string; resolved?: boolean },
  ): MockApiCommentRow | undefined {
    const s = getState();
    const cur = s.comments.get(commentId);
    if (!cur) return undefined;
    const next: MockApiCommentRow = {
      ...cur,
      body: patch.body !== undefined ? patch.body.trim() : cur.body,
      resolved: patch.resolved !== undefined ? patch.resolved : cur.resolved,
    };
    s.comments.set(commentId, next);
    scheduleMockApiStorePersist();
    return next;
  },

  deleteComment(commentId: string): boolean {
    const deleted = getState().comments.delete(commentId);
    if (deleted) scheduleMockApiStorePersist();
    return deleted;
  },
};
