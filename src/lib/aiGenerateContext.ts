export type AIContextKind =
  | "project"
  | "image"
  | "doc"
  | "video"
  | "skills"
  | "design-md"
  | "folder";

export type AIContextAttachment = {
  id: string;
  kind: AIContextKind;
  name: string;
  size: number;
  status: "loading" | "ready" | "error";
  error?: string;
  /** Text excerpt sent with the prompt. */
  summary?: string;
  /** Object URL for image previews (revoke on remove). */
  previewUrl?: string;
};

export type AIContextKindMeta = {
  kind: AIContextKind;
  label: string;
  hint: string;
  accept: string;
  directory?: boolean;
};

export const AI_CONTEXT_KINDS: AIContextKindMeta[] = [
  {
    kind: "project",
    label: "Project",
    hint: ".paytmcraft.json or craft export",
    accept: ".paytmcraft.json,.json,application/json",
  },
  {
    kind: "image",
    label: "Image",
    hint: "PNG, JPG, WebP, SVG",
    accept: "image/*,.svg",
  },
  {
    kind: "doc",
    label: "Doc",
    hint: "TXT, MD, PDF, Word",
    accept: ".txt,.md,.mdx,.pdf,.doc,.docx,.rtf",
  },
  {
    kind: "video",
    label: "Video",
    hint: "MP4, WebM, MOV",
    accept: "video/*,.mp4,.webm,.mov",
  },
  {
    kind: "skills",
    label: "Skills",
    hint: "SKILL.md or agent skills",
    accept: ".md,.mdx,.txt",
  },
  {
    kind: "design-md",
    label: "Design .md",
    hint: "Design specs & notes",
    accept: ".md,.mdx",
  },
  {
    kind: "folder",
    label: "Folder",
    hint: "Project folder tree",
    accept: "",
    directory: true,
  },
];

export const MAX_CONTEXT_ATTACHMENTS = 12;
export const MAX_CONTEXT_CHARS = 14_000;
const MAX_TEXT_PER_FILE = 4_000;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

function newId(): string {
  return `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function truncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function summarizeProjectJson(text: string): string {
  try {
    const doc = JSON.parse(text) as {
      pages?: { name?: string }[];
      nodes?: Record<string, { name?: string; type?: string }>;
      name?: string;
    };
    const pageCount = doc.pages?.length ?? 1;
    const nodeEntries = Object.values(doc.nodes ?? {});
    const layerNames = nodeEntries
      .map((n) => n.name?.trim())
      .filter((n): n is string => Boolean(n))
      .slice(0, 24);
    const types = [...new Set(nodeEntries.map((n) => n.type).filter(Boolean))].slice(0, 8);
    const parts = [
      `Craft project "${doc.name ?? "Untitled"}" with ${pageCount} page(s) and ${nodeEntries.length} layer(s).`,
    ];
    if (types.length) parts.push(`Layer types: ${types.join(", ")}.`);
    if (layerNames.length) parts.push(`Sample layers: ${layerNames.join(", ")}.`);
    return parts.join(" ");
  } catch {
    return "Craft project file (JSON could not be parsed).";
  }
}

function summarizeMarkdown(text: string, kind: AIContextKind, fileName: string): string {
  const heading = kind === "skills" ? "Agent skill" : "Design spec";
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? fileName;
  return `${heading} "${title}":\n${truncate(text, MAX_TEXT_PER_FILE)}`;
}

function summarizeDocText(text: string, fileName: string): string {
  return `Document "${fileName}":\n${truncate(text, MAX_TEXT_PER_FILE)}`;
}

function folderRootName(files: File[]): string {
  const first = files[0];
  if (!first) return "Folder";
  const rel = first.webkitRelativePath || first.name;
  return rel.split("/")[0] || "Folder";
}

async function summarizeFolderFiles(files: File[]): Promise<string> {
  const paths = files.map((f) => f.webkitRelativePath || f.name).sort();
  const treePreview = paths.slice(0, 40).join("\n");
  const more = paths.length > 40 ? `\n… and ${paths.length - 40} more files` : "";

  const textCandidates = files.filter((f) => /\.(md|mdx|txt|json)$/i.test(f.name)).slice(0, 6);
  const excerpts: string[] = [];
  for (const file of textCandidates) {
    try {
      const text = await readFileAsText(file);
      if (text.trim()) {
        excerpts.push(
          `--- ${file.webkitRelativePath || file.name} ---\n${truncate(text, 1200)}`,
        );
      }
    } catch {
      /* skip unreadable */
    }
  }

  const parts = [
    `Folder "${folderRootName(files)}" (${files.length} files).`,
    `Tree:\n${treePreview}${more}`,
  ];
  if (excerpts.length) parts.push(`Text excerpts:\n${excerpts.join("\n\n")}`);
  return truncate(parts.join("\n\n"), MAX_TEXT_PER_FILE * 2);
}

export function revokeAttachmentPreview(attachment: AIContextAttachment): void {
  if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
}

export function revokeAllAttachmentPreviews(attachments: AIContextAttachment[]): void {
  for (const a of attachments) revokeAttachmentPreview(a);
}

export async function attachmentFromFile(
  file: File,
  kind: AIContextKind,
): Promise<AIContextAttachment> {
  const base: AIContextAttachment = {
    id: newId(),
    kind,
    name: file.name,
    size: file.size,
    status: "loading",
  };

  if (file.size > MAX_FILE_BYTES) {
    return {
      ...base,
      status: "error",
      error: `File exceeds ${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB limit`,
    };
  }

  try {
    if (kind === "image") {
      if (file.size > MAX_IMAGE_BYTES) {
        return {
          ...base,
          status: "error",
          error: `Image exceeds ${Math.round(MAX_IMAGE_BYTES / (1024 * 1024))}MB limit`,
        };
      }
      const previewUrl = URL.createObjectURL(file);
      const isSvg = file.name.toLowerCase().endsWith(".svg") || file.type === "image/svg+xml";
      let summary = `Image "${file.name}" (${file.type || "image"}, ${Math.round(file.size / 1024)}KB).`;
      if (isSvg) {
        const svgText = truncate(await readFileAsText(file), 1500);
        summary += `\nSVG excerpt:\n${svgText}`;
      }
      return { ...base, status: "ready", previewUrl, summary };
    }

    if (kind === "video") {
      return {
        ...base,
        status: "ready",
        summary: `Video "${file.name}" (${file.type || "video"}, ${Math.round(file.size / 1024)}KB). Use motion and pacing as visual reference.`,
      };
    }

    if (kind === "project") {
      const text = await readFileAsText(file);
      return { ...base, status: "ready", summary: summarizeProjectJson(text) };
    }

    if (kind === "skills" || kind === "design-md") {
      const text = await readFileAsText(file);
      return {
        ...base,
        status: "ready",
        summary: summarizeMarkdown(text, kind, file.name),
      };
    }

    if (kind === "doc") {
      const isBinary =
        /\.pdf$/i.test(file.name) ||
        /\.docx?$/i.test(file.name) ||
        file.type.includes("pdf") ||
        file.type.includes("word");
      if (isBinary) {
        return {
          ...base,
          status: "ready",
          summary: `Document "${file.name}" (${file.type || "document"}, ${Math.round(file.size / 1024)}KB). Binary document attached as reference metadata.`,
        };
      }
      const text = await readFileAsText(file);
      return { ...base, status: "ready", summary: summarizeDocText(text, file.name) };
    }

    const text = await readFileAsText(file);
    return { ...base, status: "ready", summary: summarizeDocText(text, file.name) };
  } catch (err) {
    return {
      ...base,
      status: "error",
      error: err instanceof Error ? err.message : "Could not read file",
    };
  }
}

export async function attachmentFromFolder(files: FileList | File[]): Promise<AIContextAttachment> {
  const list = Array.from(files);
  const base: AIContextAttachment = {
    id: newId(),
    kind: "folder",
    name: folderRootName(list),
    size: list.reduce((sum, f) => sum + f.size, 0),
    status: "loading",
  };
  if (list.length === 0) {
    return { ...base, status: "error", error: "Folder is empty" };
  }
  try {
    const summary = await summarizeFolderFiles(list);
    return { ...base, status: "ready", summary };
  } catch (err) {
    return {
      ...base,
      status: "error",
      error: err instanceof Error ? err.message : "Could not read folder",
    };
  }
}

export function buildContextPrompt(attachments: AIContextAttachment[]): string {
  const ready = attachments.filter((a) => a.status === "ready" && a.summary?.trim());
  if (ready.length === 0) return "";

  const blocks = ready.map((a) => {
    const label = AI_CONTEXT_KINDS.find((k) => k.kind === a.kind)?.label ?? a.kind;
    return `[${label}: ${a.name}]\n${a.summary!.trim()}`;
  });

  let out = blocks.join("\n\n");
  if (out.length > MAX_CONTEXT_CHARS) {
    out = `${out.slice(0, MAX_CONTEXT_CHARS - 1)}…`;
  }
  return out;
}

export function mergePromptWithContext(prompt: string, attachments: AIContextAttachment[]): string {
  const context = buildContextPrompt(attachments);
  const trimmed = prompt.trim();
  if (!context) return trimmed;
  if (!trimmed) return `Use the attached context to generate the design.\n\n${context}`;
  return `${trimmed}\n\n--- Attached context ---\n${context}`;
}

export function readyAttachmentCount(attachments: AIContextAttachment[]): number {
  return attachments.filter((a) => a.status === "ready").length;
}
