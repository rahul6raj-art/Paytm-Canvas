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

export interface CraftWorkspace {
  id: string;
  name: string;
  slug: string;
}

export interface CraftFileSummary {
  id: string;
  workspaceId: string;
  name: string;
  updatedAt: string;
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

export interface CraftFileVersionDetail extends CraftFileVersionSummary {
  documentJson: unknown;
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
  const res = await fetch(url, { ...init, headers });
  return readEnvelope<T>(res);
}

/**
 * HTTP client for Paytm Craft backends.
 *
 * - **local**: read helpers return empty / null; mutating calls throw {@link ApiNotConnectedError}.
 * - **api**: calls this Next.js app’s `/api/v1/*` Route Handlers (in-memory mock store). Editor persistence
 *   still uses {@link LocalSyncProvider} — this client is for preparing real API integration.
 * - **remote**: calls `NEXT_PUBLIC_PAYTM_CRAFT_API_URL` when set; otherwise throws {@link ApiNotConnectedError}.
 */
export const apiClient = {
  async login(_email: string, _password: string): Promise<CraftUser> {
    void _email;
    void _password;
    throw new ApiNotConnectedError("Login is not implemented yet");
  },

  async logout(): Promise<void> {
    throw new ApiNotConnectedError("Logout is not implemented yet");
  },

  async getCurrentUser(): Promise<CraftUser | null> {
    if (isLocalMode()) return null;
    return v1Fetch<CraftUser>("/me");
  },

  async listWorkspaces(): Promise<CraftWorkspace[]> {
    if (isLocalMode()) return [];
    return v1Fetch<CraftWorkspace[]>("/workspaces");
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
    void opts;
    if (isLocalMode()) throw new ApiNotConnectedError();
    await v1Fetch<CraftFileDetail>(`/files/${encodeURIComponent(fileId)}`, {
      method: "PUT",
      body: JSON.stringify({ documentJson: payload.documentJson }),
    });
    return { revision: `mock-${Date.now()}` };
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
