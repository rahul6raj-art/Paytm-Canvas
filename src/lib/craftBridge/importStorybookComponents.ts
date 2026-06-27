import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { enrichSliceWithProjectColorTokens } from "@/lib/craftBridge/projectTokenCss";
import {
  catalogHashForStories,
  groupComponentStoriesByTitle,
  probeStorybookComponentCatalog,
  resolveStorybookBaseUrl,
  type StorybookComponentStory,
} from "@/lib/craftBridge/storybookCatalog";
import {
  ensureStorybookLibraryContainer,
  finalizeStorybookComponentGroup,
  importedStorybookStoryIds,
  mergeStorybookCaptureAsMaster,
  type StorybookCaptureSlice,
} from "@/lib/craftBridge/storybookComponentLibrary";
import { finalizeWebImportGraph } from "@/lib/webImport/finalizeWebImportGraph";
import { prepareImportedSliceForCanvas } from "@/lib/prepareImportedSliceForCanvas";
import { assertPreviewReachable } from "@/lib/webImport/server/assertPreviewReachable";
import { runImportWebCapture } from "@/lib/webImport/server/playwrightCaptureService";
import { importWebResponseToPersistSlice } from "@/lib/webImport/webImportToPersistSlice";
import type { ImportWebRequest } from "@/lib/webImport/types";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";

export type ImportStorybookComponentsInput = {
  slice: EditorPersistSlice;
  link?: CodeRoundTripLink | null;
  storybookUrl?: string;
  cssSources?: string[];
  /** Cap captures per run to keep API latency bounded. */
  maxStories?: number;
};

export type ImportStorybookComponentsResult = {
  slice: EditorPersistSlice;
  storybookUrl: string;
  catalogHash: string;
  imported: number;
  skipped: number;
  stories: StorybookComponentStory[];
  message: string;
  /** Stories in the catalog not yet imported as masters. */
  remaining: number;
  /** Total variant stories discovered in Storybook index. */
  storyCount: number;
  /** Masters present after this run (including previously imported). */
  totalImported: number;
};

function resolveMaxStoriesPerRun(requested?: number): number {
  if (requested != null && requested > 0) return requested;
  const fromEnv =
    typeof process !== "undefined" ? Number(process.env.CRAFT_STORYBOOK_MAX_STORIES) : NaN;
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 96;
}

function formatStorybookImportMessage(input: {
  importedNew: number;
  captureFailed: number;
  deferred: number;
  totalImported: number;
  storyCount: number;
  lastCaptureError?: string;
}): string {
  const { importedNew, captureFailed, deferred, totalImported, storyCount, lastCaptureError } =
    input;

  if (storyCount === 0) {
    return 'No Components/* stories found in Storybook.';
  }

  if (importedNew > 0) {
    let msg = `Imported ${importedNew} new Storybook component${importedNew === 1 ? "" : "s"} (${totalImported}/${storyCount} total).`;
    if (deferred > 0) {
      msg += ` ${deferred} remaining — click Sync again to continue.`;
    }
    if (captureFailed > 0) {
      msg += ` ${captureFailed} capture${captureFailed === 1 ? "" : "s"} failed.`;
    }
    return msg;
  }

  if (totalImported >= storyCount) {
    return `Storybook library is up to date (${totalImported} component${totalImported === 1 ? "" : "s"}).`;
  }

  if (deferred > 0) {
    return `${totalImported}/${storyCount} components imported. ${deferred} remaining — click Sync again (${resolveMaxStoriesPerRun()} captures per run).`;
  }

  if (captureFailed > 0) {
    return lastCaptureError
      ? `Storybook is reachable but capture failed: ${lastCaptureError}`
      : `Storybook is reachable but ${captureFailed} component capture${captureFailed === 1 ? "" : "s"} failed.`;
  }

  return "Storybook is reachable but no component stories were captured.";
}

async function captureStorybookStory(
  iframeUrl: string,
  viewport = { width: 480, height: 240 },
): Promise<{ capture: StorybookCaptureSlice | null; error?: string }> {
  const request: ImportWebRequest = {
    url: iframeUrl,
    mode: "editable",
    viewport,
    urlPolicy: "storybook-iframe",
  };

  try {
    const capture = await runImportWebCapture(request);
    let slice = importWebResponseToPersistSlice(capture);
    const nodes = finalizeWebImportGraph(
      slice.nodes,
      slice.childOrder,
      capture.page.width,
      capture.page.height,
      { composition: "component" },
    );
    slice = prepareImportedSliceForCanvas({ ...slice, nodes });
    return {
      capture: {
        nodes: slice.nodes,
        childOrder: slice.childOrder,
        assets: slice.assets ?? {},
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { capture: null, error: msg };
  }
}

export async function importStorybookComponentsIntoSlice(
  input: ImportStorybookComponentsInput,
): Promise<ImportStorybookComponentsResult> {
  const storybookUrl = (input.storybookUrl ?? resolveStorybookBaseUrl(input.link?.previewUrl)).replace(
    /\/$/,
    "",
  );
  await assertPreviewReachable(storybookUrl);

  const probe = await probeStorybookComponentCatalog(storybookUrl);
  if (!probe.ok) {
    throw new Error(probe.error);
  }
  const stories = probe.stories;
  const storyGroups = groupComponentStoriesByTitle(stories);
  const catalogHash = catalogHashForStories(stories);
  const maxStories = resolveMaxStoriesPerRun(input.maxStories);
  const alreadyImported = importedStorybookStoryIds(input.slice.nodes);

  let nodes = { ...input.slice.nodes };
  let childOrder = { ...input.slice.childOrder };
  let assets = { ...input.slice.assets };
  const containerId = ensureStorybookLibraryContainer(nodes, childOrder);

  let importedNew = 0;
  let captureFailed = 0;
  let deferred = 0;
  let capturesThisRun = 0;
  let lastCaptureError: string | undefined;

  for (const group of storyGroups) {
    const masterIds: string[] = [];

    for (const story of group.stories) {
      const existingId = importedStorybookStoryIds(nodes).has(story.id)
        ? Object.values(nodes).find((n) => n.isComponent && n.remoteComponentId === story.id)?.id
        : undefined;
      if (existingId) {
        masterIds.push(existingId);
        continue;
      }

      if (capturesThisRun >= maxStories) {
        deferred++;
        continue;
      }

      try {
        await assertPreviewReachable(story.iframeUrl);
      } catch {
        captureFailed++;
        continue;
      }

      const { capture, error: captureError } = await captureStorybookStory(story.iframeUrl);
      if (captureError) lastCaptureError = captureError;
      if (!capture) {
        captureFailed++;
        continue;
      }

      const rootIds = capture.childOrder[EDITOR_ROOT_KEY] ?? [];
      if (rootIds.length === 0) {
        lastCaptureError = lastCaptureError ?? "Capture produced no root nodes.";
        captureFailed++;
        continue;
      }

      const masterId = mergeStorybookCaptureAsMaster(
        nodes,
        childOrder,
        assets,
        containerId,
        capture,
        story,
      );
      if (masterId) {
        masterIds.push(masterId);
        capturesThisRun++;
        importedNew++;
        alreadyImported.add(story.id);
      } else {
        captureFailed++;
      }
    }

    if (masterIds.length >= 2) {
      finalizeStorybookComponentGroup(nodes, childOrder, masterIds);
    }
  }

  const totalImported = importedStorybookStoryIds(nodes).size;
  const remaining = stories.filter((s) => !importedStorybookStoryIds(nodes).has(s.id)).length;

  let nextSlice: EditorPersistSlice = {
    ...input.slice,
    nodes,
    childOrder,
    assets,
    storybookUrl,
    storybookCatalogHash: catalogHash,
  };

  nextSlice = await enrichSliceWithProjectColorTokens(nextSlice, {
    cssSources: input.cssSources ?? input.slice.projectCssSources,
    link: input.link ?? input.slice.codeRoundTripLink ?? null,
    rebakeColors: false,
    preserveCanvasColorMode: true,
  });

  const message = formatStorybookImportMessage({
    importedNew,
    captureFailed,
    deferred,
    totalImported,
    storyCount: stories.length,
    lastCaptureError,
  });

  return {
    slice: nextSlice,
    storybookUrl,
    catalogHash,
    imported: importedNew,
    skipped: captureFailed + deferred,
    stories,
    message,
    remaining,
    storyCount: stories.length,
    totalImported,
  };
}
