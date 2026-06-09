import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";

const STORE_KEY = "__paytmCraftMockApiStore_v1__" as const;

export interface MockApiUserRow {
  id: string;
  email: string;
  displayName: string;
}

export interface MockApiWorkspaceRow {
  id: string;
  name: string;
  slug: string;
}

export interface MockApiFileRow {
  id: string;
  workspaceId: string;
  name: string;
  documentJson: unknown | null;
  createdAt: string;
  updatedAt: string;
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
  workspaces: MockApiWorkspaceRow[];
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
    { id: "user-you", email: "rahul.verma@paytm.com", displayName: "Rahul Verma" },
    { id: "u2", email: "aisha.khan@paytm.com", displayName: "Aisha Khan" },
    { id: "u3", email: "dev.sharma@paytm.com", displayName: "Dev Sharma" },
  ];

  const workspaces: MockApiWorkspaceRow[] = [
    { id: "ws-personal", name: "Personal", slug: "personal" },
    { id: "ws-paytm-design", name: "Paytm Design", slug: "paytm-design" },
    { id: "ws-product", name: "Product Team", slug: "product-team" },
    { id: "ws-experiments", name: "Experiments", slug: "experiments" },
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
    },
    {
      id: "api-file-paytm-2",
      workspaceId: "ws-paytm-design",
      name: "Marketing landing",
      documentJson: emptyDocument("Marketing landing"),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "api-file-product-1",
      workspaceId: "ws-product",
      name: "Checkout v2",
      documentJson: emptyDocument("Checkout v2"),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "api-file-personal-1",
      workspaceId: "ws-personal",
      name: "Scratch pad",
      documentJson: null,
      createdAt: now,
      updatedAt: now,
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

  return { users, workspaces, files, comments, versions: new Map(), nextSeq: 100 };
}

function getState(): MockApiStoreState {
  const g = globalThis as unknown as Record<string, MockApiStoreState | undefined>;
  if (!g[STORE_KEY]) {
    g[STORE_KEY] = seedStore();
  }
  return g[STORE_KEY]!;
}

export function fileToSummary(row: MockApiFileRow): {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: string;
} {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    updatedAt: row.updatedAt,
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

  listWorkspaces(): MockApiWorkspaceRow[] {
    return [...getState().workspaces];
  },

  workspaceExists(workspaceId: string): boolean {
    return getState().workspaces.some((w) => w.id === workspaceId);
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
    };
    s.files.set(id, row);
    return row;
  },

  updateFile(
    fileId: string,
    patch: { name?: string; documentJson?: unknown | null },
  ): MockApiFileRow | undefined {
    const s = getState();
    const cur = s.files.get(fileId);
    if (!cur) return undefined;
    const now = new Date().toISOString();
    const next: MockApiFileRow = {
      ...cur,
      name: patch.name !== undefined ? patch.name.trim() : cur.name,
      documentJson: patch.documentJson !== undefined ? patch.documentJson : cur.documentJson,
      updatedAt: now,
    };
    s.files.set(fileId, next);
    return next;
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
    };
    s.files.set(fileId, next);
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
    return next;
  },

  deleteComment(commentId: string): boolean {
    return getState().comments.delete(commentId);
  },
};
