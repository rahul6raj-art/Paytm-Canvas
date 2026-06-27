export type StorybookIndexEntry = {
  id: string;
  title: string;
  name: string;
  type?: string;
  importPath?: string;
};

export type StorybookComponentStory = {
  id: string;
  title: string;
  name: string;
  componentLabel: string;
  iframeUrl: string;
  /** Parsed variant axes from CSF story name (e.g. "Type / Filled"). */
  variantProperties: Record<string, string>;
};

export type StorybookComponentGroup = {
  title: string;
  componentLabel: string;
  stories: StorybookComponentStory[];
};

const STORYBOOK_CAPTURE_GLOBALS = "theme:light,platform:mobile";

const STORYBOOK_INDEX_PATHS = ["/index.json", "/stories.json"] as const;

export function resolveStorybookBaseUrl(previewUrl?: string): string {
  const fromEnv =
    typeof process !== "undefined" ? process.env.CRAFT_BRIDGE_STORYBOOK_URL?.trim() : "";
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (previewUrl?.trim()) {
    try {
      const parsed = new URL(previewUrl.includes("://") ? previewUrl : `http://${previewUrl}`);
      if (parsed.port === "5173" || parsed.port === "4173") {
        parsed.port = "6006";
      }
      parsed.pathname = "/";
      parsed.search = "";
      parsed.hash = "";
      return parsed.origin;
    } catch {
      /* fall through */
    }
  }

  return "http://localhost:6006";
}

export function storybookIframeUrl(storybookBase: string, storyId: string): string {
  const base = storybookBase.replace(/\/$/, "");
  const params = new URLSearchParams({
    id: storyId,
    viewMode: "story",
    globals: STORYBOOK_CAPTURE_GLOBALS,
  });
  return `${base}/iframe.html?${params.toString()}`;
}

/** Turn CSF story names like "Type / Filled" into variant property axes. */
export function parseStorybookVariantProperties(storyName: string): Record<string, string> {
  const trimmed = storyName.trim();
  if (!trimmed) return { Variant: "Default" };
  if (trimmed.includes(" / ")) {
    const [axis, ...rest] = trimmed.split(" / ").map((s) => s.trim()).filter(Boolean);
    if (axis && rest.length > 0) {
      return { [axis]: rest.join(" / ") };
    }
  }
  return { Variant: trimmed };
}

/** Master name inside a variant set — uses slash segments for axis inference. */
export function storybookVariantMasterName(title: string, storyName: string): string {
  const props = parseStorybookVariantProperties(storyName);
  const entries = Object.entries(props);
  if (entries.length === 1 && entries[0]![0] === "Variant") {
    return `${title}/${entries[0]![1]}`;
  }
  return entries.reduce((name, [axis, value]) => `${name}/${axis}/${value}`, title);
}

export function parseStorybookIndex(raw: unknown): StorybookIndexEntry[] {
  if (!raw || typeof raw !== "object") return [];
  const entries = (raw as { entries?: Record<string, unknown> }).entries;
  if (!entries || typeof entries !== "object") return [];

  const out: StorybookIndexEntry[] = [];
  for (const [id, value] of Object.entries(entries)) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const title = typeof row.title === "string" ? row.title.trim() : "";
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const type = typeof row.type === "string" ? row.type : undefined;
    if (!title || type === "docs") continue;
    out.push({
      id,
      title,
      name: name || "Default",
      type,
      importPath: typeof row.importPath === "string" ? row.importPath : undefined,
    });
  }
  return out;
}

function storyNameScore(name: string): number {
  const lower = name.toLowerCase();
  if (lower === "default") return 0;
  if (lower === "primary") return 1;
  if (lower === "standard") return 2;
  if (lower === "playground") return 3;
  return 10 + name.length;
}

function toComponentStory(
  entry: StorybookIndexEntry,
  storybookBase: string,
  componentLabel: string,
): StorybookComponentStory {
  return {
    id: entry.id,
    title: entry.title,
    name: entry.name,
    componentLabel,
    iframeUrl: storybookIframeUrl(storybookBase, entry.id),
    variantProperties: parseStorybookVariantProperties(entry.name),
  };
}

/** All stories per component title (e.g. Components/Button → every variant story). */
export function groupComponentStoriesFromIndex(
  entries: StorybookIndexEntry[],
  storybookBase: string,
  options: { titlePrefix?: string } = {},
): StorybookComponentGroup[] {
  const prefix = options.titlePrefix ?? "Components/";
  const grouped = new Map<string, StorybookIndexEntry[]>();

  for (const entry of entries) {
    if (entry.type && entry.type !== "story") continue;
    if (!entry.title.startsWith(prefix)) continue;
    const list = grouped.get(entry.title) ?? [];
    list.push(entry);
    grouped.set(entry.title, list);
  }

  const groups: StorybookComponentGroup[] = [];
  for (const [title, variants] of grouped) {
    const sorted = [...variants].sort(
      (a, b) => storyNameScore(a.name) - storyNameScore(b.name) || a.id.localeCompare(b.id),
    );
    const componentLabel = title.slice(prefix.length).trim() || sorted[0]?.name || title;
    groups.push({
      title,
      componentLabel,
      stories: sorted.map((entry) => toComponentStory(entry, storybookBase, componentLabel)),
    });
  }

  groups.sort((a, b) => a.title.localeCompare(b.title));
  return groups;
}

export function flattenComponentStoryGroups(groups: StorybookComponentGroup[]): StorybookComponentStory[] {
  return groups.flatMap((g) => g.stories);
}

export function groupComponentStoriesByTitle(
  stories: StorybookComponentStory[],
): StorybookComponentGroup[] {
  const grouped = new Map<string, StorybookComponentGroup>();
  for (const story of stories) {
    const existing = grouped.get(story.title);
    if (existing) {
      existing.stories.push(story);
      continue;
    }
    grouped.set(story.title, {
      title: story.title,
      componentLabel: story.componentLabel,
      stories: [story],
    });
  }
  return [...grouped.values()].sort((a, b) => a.title.localeCompare(b.title));
}

/** @deprecated Prefer groupComponentStoriesFromIndex — kept for tests. */
export function pickComponentStoriesFromIndex(
  entries: StorybookIndexEntry[],
  storybookBase: string,
  options: { titlePrefix?: string } = {},
): StorybookComponentStory[] {
  return flattenComponentStoryGroups(groupComponentStoriesFromIndex(entries, storybookBase, options));
}

export async function fetchStorybookIndex(storybookBase: string): Promise<StorybookIndexEntry[]> {
  const base = storybookBase.replace(/\/$/, "");
  let lastError: Error | undefined;

  for (const path of STORYBOOK_INDEX_PATHS) {
    try {
      const res = await fetch(`${base}${path}`, { cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as unknown;
      const parsed = parseStorybookIndex(json);
      if (parsed.length > 0) return parsed;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
    }
  }

  throw lastError ?? new Error(`Storybook index not found at ${base}`);
}

export function catalogHashForStories(stories: Pick<StorybookComponentStory, "id">[]): string {
  return stories
    .map((s) => s.id)
    .sort()
    .join("|");
}

export type StorybookCatalogProbe =
  | { ok: true; storybookUrl: string; stories: StorybookComponentStory[] }
  | { ok: false; storybookUrl: string; error: string };

/** Check Storybook is up and has Components/* stories before import. */
export async function probeStorybookComponentCatalog(
  storybookBase: string,
  options: { titlePrefix?: string } = {},
): Promise<StorybookCatalogProbe> {
  const storybookUrl = storybookBase.replace(/\/$/, "");
  try {
    const index = await fetchStorybookIndex(storybookUrl);
    const groups = groupComponentStoriesFromIndex(index, storybookUrl, options);
    const stories = flattenComponentStoryGroups(groups);
    if (stories.length === 0) {
      const prefix = options.titlePrefix ?? "Components/";
      return {
        ok: false,
        storybookUrl,
        error: `Storybook is running but no stories matched "${prefix}*". Check story titles in your repo.`,
      };
    }
    return { ok: true, storybookUrl, stories };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      storybookUrl,
      error: `Storybook is not reachable at ${storybookUrl}. In your linked repo run \`npm run storybook\` (port 6006), then click Sync Storybook components. (${msg})`,
    };
  }
}
