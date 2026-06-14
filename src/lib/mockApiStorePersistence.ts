import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  MockApiCommentRow,
  MockApiFileRow,
  MockApiInviteRow,
  MockApiMemberRow,
  MockApiTeamMemberRow,
  MockApiTeamRow,
  MockApiUserRow,
  MockApiVersionRow,
  MockApiWorkspaceRow,
} from "@/lib/mockApiStore";
import type { MockApiTokenRow } from "@/lib/mockApiToken";

export type PersistedMockApiStore = {
  users: MockApiUserRow[];
  teams?: MockApiTeamRow[];
  teamMembers?: MockApiTeamMemberRow[];
  workspaces: MockApiWorkspaceRow[];
  members?: MockApiMemberRow[];
  invites?: MockApiInviteRow[];
  apiTokens?: MockApiTokenRow[];
  files: MockApiFileRow[];
  comments: MockApiCommentRow[];
  versions: MockApiVersionRow[];
  nextSeq: number;
};

export function isMockApiStorePersistenceEnabled(): boolean {
  const raw = process.env.PAYTM_CRAFT_MOCK_API_PERSIST?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function mockApiStoreFilePath(): string {
  return process.env.PAYTM_CRAFT_MOCK_API_FILE?.trim() || ".craft-mock-api/store.json";
}

export function serializeMockApiStore(state: {
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
}): PersistedMockApiStore {
  return {
    users: state.users,
    teams: state.teams,
    teamMembers: state.teamMembers,
    workspaces: state.workspaces,
    members: state.members,
    invites: state.invites,
    apiTokens: state.apiTokens,
    files: [...state.files.values()],
    comments: [...state.comments.values()],
    versions: [...state.versions.values()],
    nextSeq: state.nextSeq,
  };
}

export function deserializeMockApiStore(snapshot: PersistedMockApiStore): {
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
} {
  const files = new Map<string, MockApiFileRow>();
  for (const row of snapshot.files) {
    files.set(row.id, {
      ...row,
      revision: row.revision ?? "1",
    });
  }
  const comments = new Map<string, MockApiCommentRow>();
  for (const row of snapshot.comments) comments.set(row.id, row);
  const versions = new Map<string, MockApiVersionRow>();
  for (const row of snapshot.versions) versions.set(row.id, row);
  return {
    users: snapshot.users,
    teams: Array.isArray(snapshot.teams) ? snapshot.teams : [],
    teamMembers: Array.isArray(snapshot.teamMembers) ? snapshot.teamMembers : [],
    workspaces: snapshot.workspaces,
    members: Array.isArray(snapshot.members) ? snapshot.members : [],
    invites: Array.isArray(snapshot.invites) ? snapshot.invites : [],
    apiTokens: Array.isArray(snapshot.apiTokens) ? snapshot.apiTokens : [],
    files,
    comments,
    versions,
    nextSeq: typeof snapshot.nextSeq === "number" ? snapshot.nextSeq : 100,
  };
}

export function loadMockApiStoreFromDisk(): PersistedMockApiStore | null {
  if (!isMockApiStorePersistenceEnabled()) return null;
  try {
    const raw = readFileSync(mockApiStoreFilePath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Partial<PersistedMockApiStore>;
    if (!Array.isArray(o.users) || !Array.isArray(o.workspaces) || !Array.isArray(o.files)) {
      return null;
    }
    return {
      users: o.users,
      teams: Array.isArray(o.teams) ? o.teams : [],
      teamMembers: Array.isArray(o.teamMembers) ? o.teamMembers : [],
      workspaces: o.workspaces,
      members: Array.isArray(o.members) ? o.members : [],
      invites: Array.isArray(o.invites) ? o.invites : [],
      apiTokens: Array.isArray(o.apiTokens) ? o.apiTokens : [],
      files: o.files,
      comments: Array.isArray(o.comments) ? o.comments : [],
      versions: Array.isArray(o.versions) ? o.versions : [],
      nextSeq: typeof o.nextSeq === "number" ? o.nextSeq : 100,
    };
  } catch {
    return null;
  }
}

export function saveMockApiStoreToDisk(snapshot: PersistedMockApiStore): void {
  if (!isMockApiStorePersistenceEnabled()) return;
  const path = mockApiStoreFilePath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}
