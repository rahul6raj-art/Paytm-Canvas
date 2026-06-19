import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import {
  mergeDesignTokenRecords,
  projectDesignTokensFromCssSources,
} from "@/lib/codeRoundTrip/designTokensFromProjectCss";
import type { CssThemeScope } from "@/lib/codeRoundTrip/parseCssCustomProperties";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import type { CaptureColorTheme } from "@/lib/webImport/captureTheme";
import { tokenizeImportedNodes } from "@/lib/craftBridge/tokenizeImportedNodes";

export function isProjectTokenCssPath(cssPath: string): boolean {
  const norm = cssPath.replace(/\\/g, "/").toLowerCase();
  return norm.includes("/tokens/") && norm.endsWith(".css");
}

export function themeFromPreviewUrl(previewUrl?: string): CaptureColorTheme {
  if (!previewUrl?.trim()) return "light";
  try {
    const parsed = new URL(
      previewUrl.includes("://") ? previewUrl : `http://${previewUrl}`,
    );
    const theme = parsed.searchParams.get("theme")?.trim().toLowerCase();
    return theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
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
  theme: CssThemeScope = "light",
): Record<string, import("@/lib/designTokens").DesignToken> {
  const filtered = cssSources.filter((c) => c?.trim());
  if (filtered.length === 0) return {};
  return projectDesignTokensFromCssSources(filtered, theme);
}

export async function enrichSliceWithProjectColorTokens(
  slice: EditorPersistSlice,
  input: {
    cssSources?: string[];
    link?: CodeRoundTripLink | null;
    theme?: CssThemeScope;
  },
): Promise<EditorPersistSlice> {
  let cssSources = (input.cssSources ?? []).filter((c) => c?.trim());
  const theme = input.theme ?? themeFromPreviewUrl(input.link?.previewUrl);

  if (cssSources.length === 0 && input.link?.repoRoot && input.link.cssPaths?.length) {
    cssSources = await fetchLinkedCssTexts(input.link);
  }

  const incoming = projectTokensFromCssSources(cssSources, theme);
  if (Object.keys(incoming).length === 0) return slice;

  const designTokens = mergeDesignTokenRecords(slice.designTokens, incoming);
  const nodes = tokenizeImportedNodes(slice.nodes, designTokens);

  return {
    ...slice,
    designTokens,
    nodes,
  };
}
