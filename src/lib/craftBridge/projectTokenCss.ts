import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import {
  mergeDesignTokenRecords,
  projectDesignTokensWithColorModesFromCssSources,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import type { CssThemeScope } from "@/lib/codeRoundTrip/parseCssCustomProperties";
import { applyPageCssToSlice } from "@/lib/codeRoundTrip/applyPageCssToSlice";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { CaptureColorTheme } from "@/lib/webImport/captureTheme";
import { resolveBridgeImportColorTheme } from "@/lib/webImport/captureTheme";
import { expandImportedFrameHeights } from "@/lib/webImport/finalizeWebImportGraph";
import {
  normalizeImportedLabelTextNodes,
  normalizeWebImportTextNodes,
} from "@/lib/webImport/normalizeWebImportLayers";
import { tokenizeImportedNodes } from "@/lib/craftBridge/tokenizeImportedNodes";
import { applyImportedTokenColorsToNodes } from "@/lib/designTokens";

export function isProjectTokenCssPath(cssPath: string): boolean {
  const norm = cssPath.replace(/\\/g, "/").toLowerCase();
  return norm.includes("/tokens/") && norm.endsWith(".css");
}

/** @deprecated Use resolveBridgeImportColorTheme */
export function themeFromPreviewUrl(previewUrl?: string): CaptureColorTheme {
  return resolveBridgeImportColorTheme(previewUrl);
}

export async function fetchLinkedCssTexts(link: CodeRoundTripLink): Promise<string[]> {
  const paths = (link.cssPaths ?? []).filter((p) => p?.trim());
  const texts: string[] = [];
  for (const cssPath of paths) {
    const params = new URLSearchParams({
      repoRoot: link.repoRoot,
      sourcePath: cssPath,
    });
    const res = await bridgeFetch(`/api/craft-bridge/read-source?${params}`);
    if (!res.ok) continue;
    const body = (await res.json()) as { content?: string };
    if (body.content?.trim()) texts.push(body.content);
  }
  return texts;
}

export async function fetchLinkedTokenCssTexts(link: CodeRoundTripLink): Promise<string[]> {
  const paths = (link.cssPaths ?? []).filter((p) => p?.trim() && isProjectTokenCssPath(p));
  const texts: string[] = [];
  for (const cssPath of paths) {
    const params = new URLSearchParams({
      repoRoot: link.repoRoot,
      sourcePath: cssPath,
    });
    const res = await bridgeFetch(`/api/craft-bridge/read-source?${params}`);
    if (!res.ok) continue;
    const body = (await res.json()) as { content?: string };
    if (body.content?.trim()) texts.push(body.content);
  }
  return texts;
}

export function projectTokensFromCssSources(
  cssSources: string[],
  _theme: CssThemeScope = "light",
): Record<string, import("@/lib/designTokens").DesignToken> {
  const filtered = cssSources.filter((c) => c?.trim());
  if (filtered.length === 0) return {};
  return projectDesignTokensWithColorModesFromCssSources(filtered);
}

export async function enrichSliceWithProjectColorTokens(
  slice: EditorPersistSlice,
  input: {
    cssSources?: string[];
    link?: CodeRoundTripLink | null;
    theme?: CssThemeScope;
    /** When false, keep baked fills — runtime mode switching resolves linked tokens. */
    rebakeColors?: boolean;
    /** When true, do not overwrite the slice canvas color mode (editor rehydrate). */
    preserveCanvasColorMode?: boolean;
  } = {},
): Promise<EditorPersistSlice> {
  let cssSources = (input.cssSources ?? slice.projectCssSources ?? []).filter((c) => c?.trim());
  const theme = resolveBridgeImportColorTheme(input.link?.previewUrl, input.theme ?? slice.canvasColorMode);

  if (cssSources.length === 0 && input.link?.repoRoot && input.link.cssPaths?.length) {
    cssSources = await fetchLinkedCssTexts(input.link);
  }

  const incoming = projectTokensFromCssSources(cssSources, theme);
  const designTokens =
    Object.keys(incoming).length > 0
      ? mergeDesignTokenRecords(slice.designTokens, incoming)
      : slice.designTokens;
  let nodes = slice.nodes;
  const hasColorLibrary = Object.values(designTokens).some((t) => t.type === "color");
  if (Object.keys(incoming).length > 0 || hasColorLibrary) {
    nodes = tokenizeImportedNodes(nodes, designTokens, {
      importMode: theme,
      cssSources,
    });
    if (input.rebakeColors !== false) {
      nodes = applyImportedTokenColorsToNodes(nodes, designTokens, theme);
    }
  }

  if (cssSources.length > 0 && input.rebakeColors !== false) {
    const layoutSlice = applyPageCssToSlice(
      { ...slice, nodes, designTokens, projectCssSources: cssSources } as EditorPersistSlice,
      cssSources,
      theme,
    );
    nodes = layoutSlice.nodes;
    expandImportedFrameHeights(nodes, slice.childOrder);
  }

  normalizeWebImportTextNodes(nodes);
  normalizeImportedLabelTextNodes(nodes);

  return {
    ...slice,
    designTokens,
    nodes,
    ...(input.preserveCanvasColorMode ? {} : { canvasColorMode: theme }),
    projectCssSources: cssSources,
  };
}

/** Reload dual-mode tokens + fill links when CSS was missing from a saved document. */
export async function rehydrateProjectColorContext(
  slice: Pick<
    EditorPersistSlice,
    "nodes" | "designTokens" | "projectCssSources" | "codeRoundTripLink" | "canvasColorMode"
  >,
): Promise<Pick<EditorPersistSlice, "nodes" | "designTokens" | "projectCssSources"> | null> {
  const link = slice.codeRoundTripLink;
  if (!link?.repoRoot && (slice.projectCssSources?.length ?? 0) === 0) return null;

  const enriched = await enrichSliceWithProjectColorTokens(
    {
      nodes: slice.nodes,
      designTokens: slice.designTokens,
      projectCssSources: slice.projectCssSources ?? [],
      canvasColorMode: slice.canvasColorMode ?? "light",
      codeRoundTripLink: link ?? null,
    } as EditorPersistSlice,
    {
      link,
      cssSources: slice.projectCssSources,
      theme: slice.canvasColorMode,
      rebakeColors: false,
      preserveCanvasColorMode: true,
    },
  );

  const cssSources = enriched.projectCssSources ?? [];
  if (
    cssSources.length === 0 &&
    enriched.nodes === slice.nodes &&
    enriched.designTokens === slice.designTokens
  ) {
    return null;
  }

  return {
    nodes: enriched.nodes,
    designTokens: enriched.designTokens,
    projectCssSources: cssSources,
  };
}
