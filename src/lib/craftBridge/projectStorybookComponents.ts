import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import {
  catalogHashForStories,
  fetchStorybookIndex,
  flattenComponentStoryGroups,
  groupComponentStoriesFromIndex,
  resolveStorybookBaseUrl,
} from "@/lib/craftBridge/storybookCatalog";
import {
  importedStorybookStoryIds,
  listStorybookComponentMasters,
} from "@/lib/craftBridge/storybookComponentLibrary";
import { importStorybookComponentsIntoSlice } from "@/lib/craftBridge/importStorybookComponents";

export async function shouldRefreshStorybookComponents(
  slice: Pick<
    EditorPersistSlice,
    "storybookUrl" | "storybookCatalogHash" | "nodes" | "codeRoundTripLink"
  >,
  link?: CodeRoundTripLink | null,
): Promise<boolean> {
  if (!link?.repoRoot && !slice.storybookUrl) return false;
  const storybookUrl = slice.storybookUrl ?? resolveStorybookBaseUrl(link?.previewUrl);
  try {
    const index = await fetchStorybookIndex(storybookUrl);
    const stories = flattenComponentStoryGroups(
      groupComponentStoriesFromIndex(index, storybookUrl),
    );
    const hash = catalogHashForStories(stories);
    const imported = importedStorybookStoryIds(slice.nodes);
    const missing = stories.filter((s) => !imported.has(s.id));
    if (
      missing.length === 0 &&
      slice.storybookCatalogHash === hash &&
      listStorybookComponentMasters(slice.nodes).length > 0
    ) {
      return false;
    }
    return stories.length > 0;
  } catch {
    return false;
  }
}

export async function enrichSliceWithStorybookComponents(
  slice: EditorPersistSlice,
  input: {
    link?: CodeRoundTripLink | null;
    storybookUrl?: string;
    cssSources?: string[];
    force?: boolean;
  } = {},
): Promise<EditorPersistSlice> {
  const link = input.link ?? slice.codeRoundTripLink ?? null;
  if (!link?.repoRoot && !input.storybookUrl && !slice.storybookUrl) return slice;

  const needsRefresh = input.force
    ? true
    : await shouldRefreshStorybookComponents(slice, link);
  if (!needsRefresh) return slice;

  const result = await importStorybookComponentsIntoSlice({
    slice,
    link,
    storybookUrl: input.storybookUrl ?? slice.storybookUrl,
    cssSources: input.cssSources ?? slice.projectCssSources,
  });

  return result.slice;
}

export async function rehydrateProjectStorybookComponents(
  slice: Pick<
    EditorPersistSlice,
    | "nodes"
    | "childOrder"
    | "assets"
    | "designTokens"
    | "projectCssSources"
    | "codeRoundTripLink"
    | "canvasColorMode"
    | "storybookUrl"
    | "storybookCatalogHash"
  >,
): Promise<Pick<
  EditorPersistSlice,
  "nodes" | "childOrder" | "assets" | "storybookUrl" | "storybookCatalogHash"
> | null> {
  const link = slice.codeRoundTripLink;
  if (!link?.repoRoot && !slice.storybookUrl) return null;

  const enriched = await enrichSliceWithStorybookComponents(
    {
      nodes: slice.nodes,
      childOrder: slice.childOrder,
      assets: slice.assets,
      designTokens: slice.designTokens,
      projectCssSources: slice.projectCssSources ?? [],
      canvasColorMode: slice.canvasColorMode,
      codeRoundTripLink: link ?? null,
      storybookUrl: slice.storybookUrl,
      storybookCatalogHash: slice.storybookCatalogHash,
      fileName: "",
      selectedIds: [],
      zoom: 1,
      pan: { x: 0, y: 0 },
      showGrid: false,
      showRulers: false,
      canvasBackgroundColor: "#e5e5e5",
      comments: [],
      pages: {},
      pageOrder: [],
      activePageId: "",
      activeSubPageId: "",
    },
    { link, force: false },
  );

  if (
    enriched.nodes === slice.nodes &&
    enriched.storybookCatalogHash === slice.storybookCatalogHash
  ) {
    return null;
  }

  return {
    nodes: enriched.nodes,
    childOrder: enriched.childOrder,
    assets: enriched.assets,
    storybookUrl: enriched.storybookUrl,
    storybookCatalogHash: enriched.storybookCatalogHash,
  };
}
