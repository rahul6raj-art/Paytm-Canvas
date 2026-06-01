export interface EditorCommentAuthor {
  name: string;
  avatar?: string;
  color: string;
}

export interface EditorCommentReply {
  id: string;
  author: EditorCommentAuthor;
  body: string;
  createdAt: string;
}

export interface EditorComment {
  id: string;
  x: number;
  y: number;
  parentNodeId?: string;
  frameId?: string;
  author: EditorCommentAuthor;
  body: string;
  createdAt: string;
  resolved: boolean;
  replies: EditorCommentReply[];
}

const COMMENT_COLORS = ["#0d99ff", "#a855f7", "#22c55e", "#f97316", "#ec4899", "#eab308"];

export function defaultCommentAuthor(seed = ""): EditorCommentAuthor {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const color = COMMENT_COLORS[Math.abs(h) % COMMENT_COLORS.length]!;
  return {
    name: "You",
    color,
  };
}

export function newCommentId(): string {
  return `comment-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newReplyId(): string {
  return `reply-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isNonEmptyCommentBody(body: string): boolean {
  return body.trim().length > 0;
}

/** Map a `/api/v1/comments` DTO into an editor comment (replies are local-only until API supports them). */
export function editorCommentFromCraftApi(c: {
  id: string;
  body: string;
  createdAt: string;
  resolved?: boolean;
  x?: number | null;
  y?: number | null;
  parentNodeId?: string | null;
  frameId?: string | null;
}): EditorComment {
  const x = typeof c.x === "number" && !Number.isNaN(c.x) ? c.x : 0;
  const y = typeof c.y === "number" && !Number.isNaN(c.y) ? c.y : 0;
  return {
    id: c.id,
    x,
    y,
    ...(typeof c.parentNodeId === "string" && c.parentNodeId ? { parentNodeId: c.parentNodeId } : {}),
    ...(typeof c.frameId === "string" && c.frameId ? { frameId: c.frameId } : {}),
    author: defaultCommentAuthor(c.id),
    body: typeof c.body === "string" ? c.body : "",
    createdAt: c.createdAt,
    resolved: Boolean(c.resolved),
    replies: [],
  };
}

/** Shallow validation for import / persistence. */
export function parseCommentsArray(raw: unknown): EditorComment[] {
  if (!Array.isArray(raw)) return [];
  const out: EditorComment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (typeof o.id !== "string" || typeof o.x !== "number" || typeof o.y !== "number") continue;
    if (typeof o.body !== "string" || typeof o.resolved !== "boolean") continue;
    if (typeof o.createdAt !== "string") continue;
    const author = o.author;
    if (!author || typeof author !== "object") continue;
    const a = author as Record<string, unknown>;
    if (typeof a.name !== "string" || typeof a.color !== "string") continue;
    const repliesRaw = o.replies;
    const replies: EditorCommentReply[] = [];
    if (Array.isArray(repliesRaw)) {
      for (const r of repliesRaw) {
        if (!r || typeof r !== "object") continue;
        const rr = r as Record<string, unknown>;
        const ra = rr.author;
        if (
          typeof rr.id !== "string" ||
          typeof rr.body !== "string" ||
          typeof rr.createdAt !== "string" ||
          !ra ||
          typeof ra !== "object"
        )
          continue;
        const rab = ra as Record<string, unknown>;
        if (typeof rab.name !== "string" || typeof rab.color !== "string") continue;
        replies.push({
          id: rr.id as string,
          author: {
            name: rab.name as string,
            color: rab.color as string,
            ...(typeof rab.avatar === "string" ? { avatar: rab.avatar } : {}),
          },
          body: rr.body as string,
          createdAt: rr.createdAt as string,
        });
      }
    }
    out.push({
      id: o.id as string,
      x: o.x as number,
      y: o.y as number,
      ...(typeof o.parentNodeId === "string" ? { parentNodeId: o.parentNodeId } : {}),
      ...(typeof o.frameId === "string" ? { frameId: o.frameId } : {}),
      author: {
        name: a.name as string,
        color: a.color as string,
        ...(typeof a.avatar === "string" ? { avatar: a.avatar } : {}),
      },
      body: o.body as string,
      createdAt: o.createdAt as string,
      resolved: o.resolved as boolean,
      replies,
    });
  }
  return out;
}
