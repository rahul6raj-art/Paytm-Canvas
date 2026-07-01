import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  PML_PHONE_COLUMN_WIDTH,
  PML_PHONE_VIEWPORT,
  PML_PHONE_VIEWPORT_HEIGHT,
} from "@/lib/craftBridge/pmlScreenMetrics";
import type { ImportWebRequest } from "@/lib/webImport/types";
import { isPhoneShellClassName } from "@/lib/webImport/phoneShellViewport";

/** Build a Playwright request that captures exactly what the dev preview shows. */
export function buildBridgeImportWebRequest(
  url: string,
  viewport: { width: number; height: number } = PML_PHONE_VIEWPORT,
): ImportWebRequest {
  return {
    url,
    mode: "editable",
    viewport,
    urlPolicy: "react-preview",
    bridgeViewportCapture: true,
  };
}

/**
 * Lock every bridge artboard to the phone preview viewport — WYSIWYG with the live
 * browser window, regardless of page (home, more, stocks, onboarding step, etc.).
 */
export function enforceBridgeViewportArtboard(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [id, node] of Object.entries(nodes)) {
    if (!isPhoneShellClassName(node.codeClassName)) continue;
    nodes[id] = {
      ...node,
      width: PML_PHONE_COLUMN_WIDTH,
      height: PML_PHONE_VIEWPORT_HEIGHT,
      clipChildren: true,
      manualScreenLayout: true,
      layoutMode: "none",
    };
  }

  for (const rootId of childOrder[EDITOR_ROOT_KEY] ?? []) {
    const root = nodes[rootId];
    if (!root || root.type === "text") continue;
    const phoneArtboard =
      isPhoneShellClassName(root.codeClassName) ||
      (root.width > 280 && root.width <= 420);
    if (!phoneArtboard) continue;
    nodes[rootId] = {
      ...root,
      width: PML_PHONE_COLUMN_WIDTH,
      height: PML_PHONE_VIEWPORT_HEIGHT,
      clipChildren: true,
      manualScreenLayout: true,
      layoutMode: "none",
    };
  }
}

export { PML_PHONE_COLUMN_WIDTH, PML_PHONE_VIEWPORT_HEIGHT };
