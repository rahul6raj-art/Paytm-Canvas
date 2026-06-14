import { getPaytmCraftPublicEnv } from "@/lib/env";

/** Thrown when remote API is not configured or a capability is still a stub. */
export class ApiNotConnectedError extends Error {
  constructor(message = "API not connected yet") {
    super(message);
    this.name = "ApiNotConnectedError";
  }
}

/** Thrown when the server returns a non-2xx JSON error envelope from `/api/v1` (or remote). */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export interface CraftUser {
  id: string;
  email: string;
  displayName: string;
}

export type CraftApiTokenScope = "read" | "write";

export type CraftApiTokenResourceScope =
  | "files:read"
  | "files:write"
  | "assets:read"
  | "assets:write"
  | "comments:read"
  | "comments:write"
  | "teams:read"
  | "teams:write"
  | "workspaces:read"
  | "realtime:write";

export interface CraftApiTokenSummary {
  id: string;
  name: string;
  tokenPrefix: string;
  scope: CraftApiTokenScope;
  resourceScopes?: CraftApiTokenResourceScope[];
  createdAt: string;
  expiresAt?: string | null;
  lastUsedAt?: string | null;
}

export interface CraftApiTokenCreated extends CraftApiTokenSummary {
  /** Returned once on create — store securely; not retrievable later. */
  token: string;
}

export interface CraftTeam {
  id: string;
  name: string;
  slug: string;
}

export interface CraftWorkspace {
  id: string;
  teamId: string;
  name: string;
  slug: string;
}

export type CraftWorkspaceRole = "owner" | "admin" | "member" | "guest";

export interface CraftWorkspaceMember {
  userId: string;
  email: string;
  displayName: string;
  initials: string;
  role: CraftWorkspaceRole;
}

export interface CraftWorkspaceInvite {
  id: string;
  workspaceId: string;
  email: string;
  role: CraftWorkspaceRole;
  invitedByUserId: string;
  createdAt: string;
}

export type CraftWorkspaceInviteOutcome =
  | { kind: "member"; member: CraftWorkspaceMember }
  | { kind: "invite"; invite: CraftWorkspaceInvite; emailSent?: boolean };

export interface CraftFileSummary {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: string;
  revision?: string;
}

export interface CraftFileDetail extends CraftFileSummary {
  createdAt: string;
  documentJson?: unknown | null;
}

export interface CraftComment {
  id: string;
  fileId: string;
  body: string;
  createdAt: string;
  resolved?: boolean;
  x?: number | null;
  y?: number | null;
  parentNodeId?: string | null;
  frameId?: string | null;
}

export type CreateCommentParams = {
  fileId: string;
  body?: string;
  x?: number;
  y?: number;
  parentNodeId?: string;
  frameId?: string;
};

export type CreateFileParams = {
  workspaceId: string;
  name: string;
  documentJson?: unknown | null;
};

export interface CraftFileVersionSummary {
  id: string;
  fileId: string;
  name: string;
  createdAt: string;
  createdByUserId: string;
  createdByDisplayName: string;
}

export interface CraftAsset {
  id: string;
  workspaceId: string;
  fileName: string;
  mime: string;
  byteSize: number;
  url: string;
  width?: number | null;
  height?: number | null;
  createdAt: string;
  createdByUserId: string;
}

export interface CraftAssetUploadUrl {
  assetId: string;
  storageKey: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  publicUrl: string;
  fields: Record<string, string>;
}

function isLocalMode(): boolean {
  return getPaytmCraftPublicEnv().mode === "local";
}

/** Path segment after `/v1`, e.g. `/me` or `/files?x=1`. */
function buildV1Url(path: string): string {
  const env = getPaytmCraftPublicEnv();
  const p = path.startsWith("/") ? path : `/${path}`;
  if (env.mode === "api") {
    return `/api/v1${p}`;
  }
  if (env.mode === "remote") {
    if (!env.apiUrl) {
      throw new ApiNotConnectedError();
    }
    return `${env.apiUrl.replace(/\/$/, "")}${p}`;
  }
  throw new ApiNotConnectedError();
}

async function readEnvelope<T>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as {
    data?: T;
    error?: { code?: string; message?: string };
  };
  if (!res.ok) {
    const err = json.error;
    if (err && typeof err.message === "string") {
      throw new ApiRequestError(err.message, res.status, typeof err.code === "string" ? err.code : "UNKNOWN");
    }
    throw new ApiRequestError(res.statusText || "Request failed", res.status, "UNKNOWN");
  }
  if (json.data === undefined) {
    throw new ApiRequestError("Response missing data", res.status, "INVALID_RESPONSE");
  }
  return json.data as T;
}

function shouldSendCredentials(): boolean {
  const mode = getPaytmCraftPublicEnv().mode;
  return mode === "api" || mode === "remote";
}

async function v1Fetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = buildV1Url(path);
  const headers = new Headers(init?.headers);
  if (init?.body != null && !headers.has("Content-Type")) {
    if (!(typeof FormData !== "undefined" && init.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
  }
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: shouldSendCredentials() ? "include" : "same-origin",
  });
  return readEnvelope<T>(res);
}

/**
 * HTTP client for Paytm Craft backends.
 *
 * - **local**: read helpers return empty / null; mutating calls throw {@link ApiNotConnectedError}.
 * - **api**: calls this Next.js app’s `/api/v1/*` Route Handlers (in-memory mock store).
 *   Document persistence uses {@link ApiSyncProvider} / {@link RemoteSyncProvider} when mode is `api` or `remote`.
 * - **remote**: calls `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` when set; otherwise throws {@link ApiNotConnectedError}.
 */
export const apiClient = {
  async login(email: string, password: string): Promise<CraftUser> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    return v1Fetch<CraftUser>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  async logout(): Promise<void> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    await v1Fetch<{ ok: true }>("/auth/logout", {
      method: "POST",
      body: "{}",
    });
  },

  async listApiTokens(): Promise<CraftApiTokenSummary[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftApiTokenSummary[]>("/auth/tokens");
  },

  async createApiToken(
    name: string,
    options?: {
      expiresInDays?: number | null;
      scope?: CraftApiTokenScope;
      resourceScopes?: CraftApiTokenResourceScope[];
    },
  ): Promise<CraftApiTokenCreated> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    const body: {
      name: string;
      expiresInDays?: number;
      scope?: CraftApiTokenScope;
      resourceScopes?: CraftApiTokenResourceScope[];
    } = { name };
    if (options?.expiresInDays != null) body.expiresInDays = options.expiresInDays;
    if (options?.scope) body.scope = options.scope;
    if (options?.resourceScopes?.length) body.resourceScopes = options.resourceScopes;
    return v1Fetch<CraftApiTokenCreated>("/auth/tokens", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async revokeApiToken(tokenId: string): Promise<void> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    await v1Fetch<{ ok: true }>(`/auth/tokens/${encodeURIComponent(tokenId)}`, {
      method: "DELETE",
    });
  },

  async getCurrentUser(): Promise<CraftUser | null> {
    if (isLocalMode()) return null;
    return v1Fetch<CraftUser>("/me");
  },

  async listWorkspaces(): Promise<CraftWorkspace[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftWorkspace[]>("/workspaces");
  },

  async listTeams(): Promise<CraftTeam[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftTeam[]>("/teams");
  },

  async listTeamMembers(teamId: string): Promise<CraftWorkspaceMember[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftWorkspaceMember[]>(`/teams/${encodeURIComponent(teamId)}/members`);
  },

  async listFiles(workspaceId: string | { workspaceId: string }): Promise<CraftFileSummary[]> {
    if (isLocalMode()) return [];
    const id = typeof workspaceId === "string" ? workspaceId : workspaceId.workspaceId;
    const q = encodeURIComponent(id);
    return v1Fetch<CraftFileSummary[]>(`/files?workspaceId=${q}`);
  },

  async createFile(
    workspaceIdOrParams: string | CreateFileParams,
    name?: string,
    documentJson?: unknown | null,
  ): Promise<CraftFileSummary> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    let body: Record<string, unknown>;
    if (typeof workspaceIdOrParams === "object") {
      const p = workspaceIdOrParams;
      body = { workspaceId: p.workspaceId, name: p.name };
      if (Object.prototype.hasOwnProperty.call(p, "documentJson")) {
        body.documentJson = p.documentJson;
      }
    } else {
      body = { workspaceId: workspaceIdOrParams, name: name?.trim() || "Untitled" };
      if (arguments.length >= 3) {
        body.documentJson = documentJson;
      }
    }
    return v1Fetch<CraftFileSummary>("/files", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async getFile(fileId: string): Promise<CraftFileDetail | null> {
    if (isLocalMode()) return null;
    try {
      return await v1Fetch<CraftFileDetail>(`/files/${encodeURIComponent(fileId)}`);
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) return null;
      throw e;
    }
  },

  async saveFile(
    fileId: string,
    payload: { documentJson: unknown },
    opts?: { revision?: string },
  ): Promise<{ revision: string }> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    const headers: Record<string, string> = {};
    if (opts?.revision) {
      headers["If-Match"] = opts.revision;
    }
    const detail = await v1Fetch<CraftFileDetail>(`/files/${encodeURIComponent(fileId)}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ documentJson: payload.documentJson }),
    });
    return { revision: detail.revision ?? opts?.revision ?? "1" };
  },

  async listFileVersions(fileId: string): Promise<CraftFileVersionSummary[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftFileVersionSummary[]>(`/files/${encodeURIComponent(fileId)}/versions`);
  },

  async createFileVersion(
    fileId: string,
    params: { name?: string; documentJson: unknown },
  ): Promise<CraftFileVersionSummary> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    return v1Fetch<CraftFileVersionSummary>(`/files/${encodeURIComponent(fileId)}/versions`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },

  async getFileVersion(fileId: string, versionId: string): Promise<CraftFileVersionDetail | null> {
    if (isLocalMode()) return null;
    try {
      return await v1Fetch<CraftFileVersionDetail>(
        `/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}`,
      );
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 404) return null;
      throw e;
    }
  },

  async restoreFileVersion(fileId: string, versionId: string): Promise<CraftFileDetail> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    return v1Fetch<CraftFileDetail>(
      `/files/${encodeURIComponent(fileId)}/versions/${encodeURIComponent(versionId)}/restore`,
      { method: "POST", body: "{}" },
    );
  },

  async uploadAsset(
    workspaceId: string,
    file: Blob,
    opts?: { name?: string; contentType?: string },
  ): Promise<{ assetId: string; url: string }> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    const form = new FormData();
    const filename = opts?.name ?? (file instanceof File ? file.name : "upload");
    form.append("file", file, filename);
    return v1Fetch<{ assetId: string; url: string }>(
      `/workspaces/${encodeURIComponent(workspaceId)}/assets`,
      {
        method: "POST",
        body: form,
      },
    );
  },

  async requestAssetUploadUrl(
    workspaceId: string,
    params: { fileName: string; contentType?: string },
  ): Promise<CraftAssetUploadUrl> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    return v1Fetch<CraftAssetUploadUrl>(
      `/workspaces/${encodeURIComponent(workspaceId)}/assets/upload-url`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  },

  async completeAssetUpload(
    workspaceId: string,
    params: {
      assetId: string;
      storageKey: string;
      fileName: string;
      mime?: string;
      byteSize?: number;
      width?: number;
      height?: number;
    },
  ): Promise<CraftAsset> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    return v1Fetch<CraftAsset>(
      `/workspaces/${encodeURIComponent(workspaceId)}/assets/complete`,
      {
        method: "POST",
        body: JSON.stringify(params),
      },
    );
  },

  async listAssets(workspaceId: string): Promise<CraftAsset[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftAsset[]>(`/workspaces/${encodeURIComponent(workspaceId)}/assets`);
  },

  async listWorkspaceMembers(workspaceId: string): Promise<CraftWorkspaceMember[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftWorkspaceMember[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/members`,
    );
  },

  async inviteWorkspaceMember(
    workspaceId: string,
    params: { email: string; role?: CraftWorkspaceRole },
  ): Promise<CraftWorkspaceMember> {
    const outcome = await this.inviteToWorkspace(workspaceId, params);
    if (outcome.kind === "invite") {
      throw new ApiRequestError(
        "User not found — pending invite created; use inviteToWorkspace instead",
        404,
        "NOT_FOUND",
      );
    }
    return outcome.member;
  },

  async listWorkspaceInvites(workspaceId: string): Promise<CraftWorkspaceInvite[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftWorkspaceInvite[]>(
      `/workspaces/${encodeURIComponent(workspaceId)}/invites`,
    );
  },

  async inviteToWorkspace(
    workspaceId: string,
    params: { email: string; role?: CraftWorkspaceRole },
  ): Promise<CraftWorkspaceInviteOutcome> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    const body: Record<string, unknown> = { email: params.email.trim() };
    if (params.role) body.role = params.role;
    return v1Fetch<CraftWorkspaceInviteOutcome>(
      `/workspaces/${encodeURIComponent(workspaceId)}/invites`,
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  },

  async listComments(fileId: string): Promise<CraftComment[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftComment[]>(`/comments?fileId=${encodeURIComponent(fileId)}`);
  },

  async createComment(params: CreateCommentParams): Promise<CraftComment> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    const body: Record<string, unknown> = {
      fileId: params.fileId,
      body: params.body ?? "",
    };
    if (typeof params.x === "number") body.x = params.x;
    if (typeof params.y === "number") body.y = params.y;
    if (params.parentNodeId) body.parentNodeId = params.parentNodeId;
    if (params.frameId) body.frameId = params.frameId;
    return v1Fetch<CraftComment>("/comments", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  async updateComment(commentId: string, patch: { body?: string; resolved?: boolean }): Promise<CraftComment> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    return v1Fetch<CraftComment>(`/comments/${encodeURIComponent(commentId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  },

  async deleteComment(commentId: string): Promise<void> {
    if (isLocalMode()) throw new ApiNotConnectedError();
    await v1Fetch<{ deleted: true }>(`/comments/${encodeURIComponent(commentId)}`, {
      method: "DELETE",
    });
  },
};
