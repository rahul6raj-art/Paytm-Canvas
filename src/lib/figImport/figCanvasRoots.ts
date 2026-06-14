import { nodeId, type FigDocument, type FigNode } from "openfig-core";
import { placementFromFigNode, sortedFigChildren } from "@/lib/figImport/figNodeGeometry";

const COMPONENT_ROOT_TYPES = new Set(["COMPONENT", "SYMBOL", "COMPONENT_SET"]);
const PASS_THROUGH = new Set(["SECTION", "DOCUMENT"]);

/** Top-level Figma nodes we never place on the Paytm canvas. */
const ROOT_NAME_JUNK =
  /^(figma(\.com)?|cover(\s+page)?|thumbnail|pasteboard|internal(\s+only)?|—\s*figma)/i;

export function normalizeFigLayerName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function frameArea(node: FigNode): number {
  const p = placementFromFigNode(node);
  return Math.max(0, p.width) * Math.max(0, p.height);
}

function isPublishableComponentFrame(node: FigNode): boolean {
  return (
    node.type === "FRAME" &&
    Boolean((node as FigNode & { isPublishable?: boolean }).isPublishable)
  );
}

/** True for page-level screen frames (not symbols / component sets). */
export function isCanvasScreenCandidate(node: FigNode): boolean {
  if (node.phase === "REMOVED") return false;
  if (COMPONENT_ROOT_TYPES.has(node.type)) return false;
  if (isPublishableComponentFrame(node)) return false;
  return node.type === "FRAME" || node.type === "GROUP";
}

function collectDirectScreenCandidates(fig: FigDocument, canvasFigId: string): FigNode[] {
  return sortedFigChildren(fig, canvasFigId).filter(isCanvasScreenCandidate);
}

/** Screens often live inside a SECTION on the Figma page. */
function collectScreenCandidates(fig: FigDocument, canvasFigId: string): FigNode[] {
  const direct = collectDirectScreenCandidates(fig, canvasFigId);
  if (direct.length > 0) return direct;

  const fromSections: FigNode[] = [];
  for (const child of sortedFigChildren(fig, canvasFigId)) {
    if (!PASS_THROUGH.has(child.type)) continue;
    const sectionKey = nodeId(child);
    if (!sectionKey) continue;
    fromSections.push(...collectDirectScreenCandidates(fig, sectionKey));
  }
  return fromSections;
}

function pickLargest(nodes: FigNode[]): FigNode {
  let best = nodes[0]!;
  let bestArea = frameArea(best);
  for (let i = 1; i < nodes.length; i++) {
    const n = nodes[i]!;
    const area = frameArea(n);
    if (area > bestArea) {
      bestArea = area;
      best = n;
    }
  }
  return best;
}

function matchByNames(candidates: FigNode[], names: string[]): FigNode[] {
  const normalized = names.map(normalizeFigLayerName).filter(Boolean);
  if (!normalized.length) return [];

  for (const target of normalized) {
    const exact = candidates.filter((c) => normalizeFigLayerName(c.name ?? "") === target);
    if (exact.length === 1) return exact;
    if (exact.length > 1) return [pickLargest(exact)];
  }

  for (const target of normalized) {
    const partial = candidates.filter((c) => {
      const n = normalizeFigLayerName(c.name ?? "");
      return n.includes(target) || target.includes(n);
    });
    if (partial.length === 1) return partial;
    if (partial.length > 1) return [pickLargest(partial)];
  }

  return [];
}

/**
 * Choose the screen frame(s) to import onto the canvas.
 * Prefers a root frame whose name matches the .fig / Figma file name, not every page child.
 */
export function pickCanvasScreenRoots(
  fig: FigDocument,
  canvasFigId: string,
  opts: {
    fileName: string;
    figDocumentName?: string;
    pageName?: string;
  },
): FigNode[] {
  const candidates = collectScreenCandidates(fig, canvasFigId);
  if (candidates.length === 0) return [];

  const baseName = opts.fileName.replace(/\.fig$/i, "").trim();
  const pageName = opts.pageName?.trim();
  const genericPage = pageName ? /^page\s*\d*$/i.test(pageName) : false;
  const nameHints = [baseName, opts.figDocumentName, genericPage ? undefined : pageName].filter(
    (n): n is string => Boolean(n?.trim()),
  );

  const matched = matchByNames(candidates, nameHints);
  if (matched.length > 0) return matched;

  const withoutJunk = candidates.filter((c) => !ROOT_NAME_JUNK.test((c.name ?? "").trim()));
  const pool = withoutJunk.length > 0 ? withoutJunk : candidates;

  if (pool.length === 1) return pool;
  // Import every top-level screen so multi-frame pages match Figma (not only the largest).
  return pool;
}

export function pickCanvasScreenRootIds(
  fig: FigDocument,
  canvasFigId: string,
  opts: Parameters<typeof pickCanvasScreenRoots>[2],
): string[] {
  return pickCanvasScreenRoots(fig, canvasFigId, opts)
    .map((n) => nodeId(n))
    .filter((id): id is string => Boolean(id));
}
