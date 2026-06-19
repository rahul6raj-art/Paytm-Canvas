import { applyDeepAutoLayoutAll, type LayoutNode } from "@/lib/autoLayout";
import { fitRichFrameToContent } from "@/lib/aiRichContentHeight";
import { editorNodesToLayoutMap } from "@/lib/autoLayoutReorder";
import type { EditorNode } from "@/stores/useEditorStore";

export type RichStructureLayout = {
  w: number;
  h: number;
  gutter: number;
  sectionGap: number;
  gridGap: number;
};

type BBox = { minX: number; minY: number; maxX: number; maxY: number };
type FlowMode = "none" | "vertical" | "horizontal";

const STATUS_CHROME = new Set(["Status bar", "Time", "Signal", "Battery"]);
const NAV_CHROME = new Set(["Nav header", "Back", "Screen title"]);
const FOOTER_CHROME = new Set([
  "Tab bar",
  "Pay dock",
  "Pay CTA",
  "Pay CTA label",
  "Primary CTA",
  "Primary CTA label",
]);
const TAB_LABELS = new Set(["Home", "UPI", "Services", "Wealth", "Profile", "Home active", "UPI active"]);

let structId = 0;
function nextStructId(prefix: string): string {
  structId += 1;
  return `ai-struct-${prefix}-${structId}`;
}

function bboxOf(ids: readonly string[], nodes: Record<string, EditorNode>): BBox | null {
  if (ids.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const n = nodes[id];
    if (!n) continue;
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function clampBoxToWidth(box: BBox, maxW: number): BBox {
  const width = Math.min(Math.max(1, box.maxX - box.minX), maxW);
  return {
    minX: Math.max(0, Math.min(box.minX, maxW - width)),
    minY: box.minY,
    maxX: Math.max(0, Math.min(box.minX, maxW - width)) + width,
    maxY: box.maxY,
  };
}

function isStatusChrome(node: EditorNode): boolean {
  return STATUS_CHROME.has(node.name);
}

function isNavChrome(node: EditorNode): boolean {
  return NAV_CHROME.has(node.name);
}

function isFooterChrome(node: EditorNode): boolean {
  return FOOTER_CHROME.has(node.name) || TAB_LABELS.has(node.name);
}

function isSectionHeader(node: EditorNode): boolean {
  return node.type === "text" && node.name === "Section header" && Boolean(node.content?.trim());
}

function isListRowAnchor(node: EditorNode, layout: RichStructureLayout): boolean {
  return (
    node.type === "rectangle" &&
    node.width >= layout.w - layout.gutter * 2 - 8 &&
    node.height >= 44 &&
    node.height <= 96 &&
    !node.name.endsWith(" chart") &&
    node.name !== "Status bar" &&
    node.name !== "Nav header"
  );
}

function nodesInsideAnchor(anchor: EditorNode, ids: readonly string[], nodes: Record<string, EditorNode>): string[] {
  const pad = 2;
  const left = anchor.x - pad;
  const top = anchor.y - pad;
  const right = anchor.x + anchor.width + pad;
  const bottom = anchor.y + anchor.height + pad;
  return ids.filter((id) => {
    const n = nodes[id]!;
    const cx = n.x + n.width / 2;
    const cy = n.y + n.height / 2;
    return cx >= left && cx <= right && cy >= top && cy <= bottom;
  });
}

function sortForFlow(ids: readonly string[], nodes: Record<string, EditorNode>, mode: FlowMode): string[] {
  if (mode === "none") return [...ids];
  return [...ids].sort((a, b) => {
    const na = nodes[a]!;
    const nb = nodes[b]!;
    return mode === "horizontal" ? na.x - nb.x || na.y - nb.y : na.y - nb.y || na.x - nb.x;
  });
}

function makeFrame(
  id: string,
  parentId: string,
  name: string,
  box: BBox,
  opts: {
    layoutMode?: EditorNode["layoutMode"];
    layoutGap?: number;
    padding?: number;
    padX?: number;
    fillEnabled?: boolean;
    sizingH?: EditorNode["layoutSizingHorizontal"];
    sizingV?: EditorNode["layoutSizingVertical"];
    counterAxisAlign?: EditorNode["counterAxisAlign"];
    primaryAxisAlign?: EditorNode["primaryAxisAlign"];
  },
): EditorNode {
  const pad = opts.padding ?? 0;
  const padX = opts.padX ?? pad;
  return {
    id,
    parentId,
    type: "frame",
    name,
    x: box.minX,
    y: box.minY,
    width: Math.max(1, box.maxX - box.minX),
    height: Math.max(1, box.maxY - box.minY),
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fillEnabled: opts.fillEnabled ?? false,
    fill: "#ffffff",
    clipChildren: true,
    layoutMode: opts.layoutMode ?? "none",
    layoutGap: opts.layoutGap ?? 0,
    paddingTop: pad,
    paddingRight: padX,
    paddingBottom: pad,
    paddingLeft: padX,
    layoutSizingHorizontal: opts.sizingH ?? "fixed",
    layoutSizingVertical: opts.sizingV ?? "fixed",
    primaryAxisAlign: opts.primaryAxisAlign ?? "start",
    counterAxisAlign: opts.counterAxisAlign ?? "start",
  };
}

function reparentCluster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
  frame: EditorNode,
  memberIds: readonly string[],
  flow: FlowMode,
): void {
  nodes[frame.id] = frame;
  if (!childOrder[parentId]) childOrder[parentId] = [];
  childOrder[parentId]!.push(frame.id);

  const ordered = sortForFlow(memberIds, nodes, flow);
  for (const id of ordered) {
    const n = nodes[id];
    if (!n) continue;
    const useFlow = flow !== "none";
    nodes[id] = {
      ...n,
      parentId: frame.id,
      x: useFlow ? 0 : n.x - frame.x,
      y: useFlow ? 0 : n.y - frame.y,
      layoutSizingHorizontal:
        flow === "horizontal" ? "fill" : n.layoutSizingHorizontal ?? (n.type === "text" ? "fill" : "fixed"),
      layoutSizingVertical: n.layoutSizingVertical ?? "hug",
      layoutPositioning: "auto",
      layoutGrow: flow === "horizontal" ? 1 : n.layoutGrow,
    };
  }
  childOrder[frame.id] = ordered;
}

function wrapCluster(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
  name: string,
  memberIds: readonly string[],
  layout: RichStructureLayout,
  mode: FlowMode,
  opts?: { fullBleed?: boolean; maxWidth?: number },
): string | null {
  if (memberIds.length === 0) return null;
  if (memberIds.length === 1) return memberIds[0]!;

  let box = bboxOf(memberIds, nodes);
  if (!box) return null;

  const maxW = opts?.maxWidth ?? layout.w;
  if (opts?.fullBleed) {
    box = { minX: 0, minY: box.minY, maxX: layout.w, maxY: box.maxY };
  } else {
    box = clampBoxToWidth(box, maxW);
  }

  const frameId = nextStructId(name.replace(/\s+/g, "-").toLowerCase());
  const frame = makeFrame(frameId, parentId, name, box, {
    layoutMode: mode === "none" ? "none" : mode,
    layoutGap: mode === "horizontal" ? layout.gridGap : mode === "vertical" ? layout.sectionGap : 0,
    sizingH: mode === "none" ? "fixed" : "fill",
    sizingV: mode === "none" ? "fixed" : "hug",
    counterAxisAlign: mode === "horizontal" && name === "Footer" ? "center" : "start",
  });

  const list = childOrder[parentId] ?? [];
  childOrder[parentId] = list.filter((id) => !memberIds.includes(id));
  reparentCluster(nodes, childOrder, parentId, frame, memberIds, mode);
  return frameId;
}

function organizeRowMembers(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
  rowIds: readonly string[],
  layout: RichStructureLayout,
): string[] {
  const remaining = [...rowIds];
  const out: string[] = [];
  const anchors = remaining.filter((id) => isListRowAnchor(nodes[id]!, layout));

  for (const anchorId of anchors) {
    const anchor = nodes[anchorId]!;
    const group = nodesInsideAnchor(anchor, remaining, nodes);
    if (group.length <= 1) continue;
    const wrapped = wrapCluster(nodes, childOrder, parentId, anchor.name, group, layout, "none");
    if (wrapped) {
      out.push(wrapped);
      for (const id of group) {
        const idx = remaining.indexOf(id);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }
  }

  const statTiles = remaining.filter((id) => nodes[id]?.name.endsWith(" stat"));
  if (statTiles.length >= 2) {
    const wrapped = wrapCluster(nodes, childOrder, parentId, "Stats", statTiles, layout, "horizontal", {
      maxWidth: layout.w - layout.gutter * 2,
    });
    if (wrapped) {
      out.push(wrapped);
      for (const id of statTiles) {
        const idx = remaining.indexOf(id);
        if (idx >= 0) remaining.splice(idx, 1);
      }
    }
  }

  if (remaining.length >= 2) {
    const wrapped = wrapCluster(nodes, childOrder, parentId, "Group", remaining, layout, "none", {
      maxWidth: layout.w,
    });
    if (wrapped) {
      return [...out, wrapped];
    }
  }

  return [...out, ...remaining];
}

function clusterContentSections(
  ids: readonly string[],
  nodes: Record<string, EditorNode>,
  layout: RichStructureLayout,
): { name: string; ids: string[] }[] {
  const sorted = [...ids].sort((a, b) => {
    const na = nodes[a]!;
    const nb = nodes[b]!;
    return na.y - nb.y || na.x - nb.x;
  });

  const sections: { name: string; ids: string[] }[] = [];
  let current: { name: string; ids: string[] } | null = null;

  for (const id of sorted) {
    const node = nodes[id]!;
    if (isSectionHeader(node)) {
      if (current?.ids.length) sections.push(current);
      current = { name: node.content!.trim(), ids: [id] };
      continue;
    }

    if (!current) {
      current = { name: inferSectionName(node), ids: [] };
    }

    const prev = current.ids.length ? nodes[current.ids[current.ids.length - 1]!] : null;
    if (prev && node.y - (prev.y + prev.height) > layout.sectionGap + 16 && current.ids.length >= 2) {
      sections.push(current);
      current = { name: inferSectionName(node), ids: [id] };
      continue;
    }

    current.ids.push(id);
  }

  if (current?.ids.length) sections.push(current);
  return sections;
}

function inferSectionName(node: EditorNode): string {
  if (node.name === "Weekly chart" || node.name.startsWith("Bar ")) return "Weekly chart";
  if (node.name.endsWith(" stat")) return "Stats";
  if (node.name === "Primary CTA" || node.name === "Primary CTA label") return "Actions";
  if (node.name === "Today headline" || node.name === "Hero headline") return "Header";
  if (node.name === "UPI card" || node.name === "Profile card") return node.name.replace(" card", "");
  if (node.name === "Greeting" || node.name === "Avatar") return "Header";
  if (node.name === "Search bar") return "Search";
  return node.name || "Section";
}

function mergeLayoutIntoEditorNodes(
  nodes: Record<string, EditorNode>,
  layoutNodes: Record<string, LayoutNode>,
): Record<string, EditorNode> {
  const next = { ...nodes };
  for (const [id, ln] of Object.entries(layoutNodes)) {
    const en = next[id];
    if (!en) continue;
    next[id] = {
      ...en,
      x: ln.x,
      y: ln.y,
      width: ln.width,
      height: ln.height,
      computedWidth: ln.computedWidth,
      computedHeight: ln.computedHeight,
      layoutDirty: ln.layoutDirty,
    };
  }
  return next;
}

function localRight(nodeId: string, nodes: Record<string, EditorNode>, rootId: string): number {
  let x = nodes[nodeId]?.x ?? 0;
  let p = nodes[nodeId]?.parentId ?? null;
  while (p && p !== rootId) {
    x += nodes[p]?.x ?? 0;
    p = nodes[p]?.parentId ?? null;
  }
  return x + (nodes[nodeId]?.width ?? 0);
}

function enforceMobileShellBounds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  frameId: string,
  shellW: number,
): void {
  const root = nodes[frameId];
  if (!root) return;
  nodes[frameId] = {
    ...root,
    width: shellW,
    clipChildren: true,
    layoutSizingHorizontal: "fixed",
  };

  const walk = (parentId: string) => {
    const parent = nodes[parentId];
    const parentW = parent?.width ?? shellW;
    for (const cid of childOrder[parentId] ?? []) {
      const n = nodes[cid];
      if (!n) continue;
      if ((n.layoutMode ?? "none") === "none" && n.x + n.width > parentW + 0.5) {
        nodes[cid] = { ...n, width: Math.max(1, parentW - n.x) };
      }
      if (n.type === "frame" || n.type === "group") walk(cid);
    }
  };
  walk(frameId);

  for (const id of Object.keys(nodes)) {
    if (localRight(id, nodes, frameId) > shellW + 1) {
      const n = nodes[id]!;
      if (n.type === "text") {
        const localX = n.x;
        nodes[id] = { ...n, width: Math.max(1, shellW - localX - 12) };
      }
    }
  }
}

/** Turn flat AI screen layers into grouped section frames with auto-layout. */
export function organizeRichScreenHierarchy(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  frameId: string,
  layout: RichStructureLayout,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]>; contentHeight: number } {
  structId = 0;
  const nextNodes = { ...nodes };
  const nextOrder: Record<string, string[]> = {
    ...childOrder,
    [frameId]: [...(childOrder[frameId] ?? [])],
  };

  const topIds = nextOrder[frameId] ?? [];
  if (topIds.length === 0) {
    return { nodes: nextNodes, childOrder: nextOrder, contentHeight: layout.h };
  }

  const statusIds = topIds.filter((id) => isStatusChrome(nextNodes[id]!));
  const navIds = topIds.filter((id) => isNavChrome(nextNodes[id]!));
  const footerIds = topIds.filter((id) => isFooterChrome(nextNodes[id]!));
  const contentIds = topIds.filter(
    (id) => !statusIds.includes(id) && !navIds.includes(id) && !footerIds.includes(id),
  );

  const structuredTop: string[] = [];

  if (statusIds.length) {
    const wrapped = wrapCluster(nextNodes, nextOrder, frameId, "Status bar", statusIds, layout, "none", {
      fullBleed: true,
    });
    if (wrapped) structuredTop.push(wrapped);
  }

  if (navIds.length) {
    const wrapped = wrapCluster(nextNodes, nextOrder, frameId, "Navigation", navIds, layout, "none", {
      fullBleed: true,
    });
    if (wrapped) structuredTop.push(wrapped);
  }

  if (contentIds.length) {
    const contentFrameId = nextStructId("content");
    const contentBox = clampBoxToWidth(bboxOf(contentIds, nextNodes)!, layout.w);
    const contentFrame = makeFrame(contentFrameId, frameId, "Content", contentBox, {
      layoutMode: "vertical",
      layoutGap: layout.sectionGap,
      padX: layout.gutter,
      sizingH: "fill",
      sizingV: "hug",
    });
    nextNodes[contentFrameId] = contentFrame;
    structuredTop.push(contentFrameId);
    nextOrder[frameId] = (nextOrder[frameId] ?? []).filter((id) => !contentIds.includes(id));
    nextOrder[contentFrameId] = [];

    for (const id of contentIds) {
      const n = nextNodes[id]!;
      nextNodes[id] = {
        ...n,
        parentId: contentFrameId,
        x: n.x - contentFrame.x,
        y: n.y - contentFrame.y,
        layoutPositioning: "auto",
        layoutSizingHorizontal: "fill",
      };
      nextOrder[contentFrameId]!.push(id);
    }

    const localLayout: RichStructureLayout = {
      ...layout,
      w: layout.w,
      h: contentFrame.height,
    };

    const sections = clusterContentSections(contentIds, nextNodes, localLayout);
    const sectionFrameIds: string[] = [];

    for (const section of sections) {
      const rowBands: string[][] = [];
      const sorted = [...section.ids].sort((a, b) => nextNodes[a]!.y - nextNodes[b]!.y);
      let band: string[] = [];
      for (const id of sorted) {
        const n = nextNodes[id]!;
        if (band.length === 0) {
          band.push(id);
          continue;
        }
        const ref = nextNodes[band[0]!]!;
        if (Math.abs(n.y - ref.y) <= 20) {
          band.push(id);
        } else {
          rowBands.push(band);
          band = [id];
        }
      }
      if (band.length) rowBands.push(band);

      const sectionMembers: string[] = [];
      for (const band of rowBands) {
        sectionMembers.push(...organizeRowMembers(nextNodes, nextOrder, contentFrameId, band, localLayout));
      }

      const uniqueMembers = [...new Set(sectionMembers)];
      if (uniqueMembers.length === 0) continue;

      if (uniqueMembers.length === 1) {
        const only = uniqueMembers[0]!;
        nextNodes[only] = {
          ...nextNodes[only]!,
          name: section.name,
          layoutSizingHorizontal: "fill",
        };
        sectionFrameIds.push(only);
        continue;
      }

      let box = bboxOf(uniqueMembers, nextNodes)!;
      box = clampBoxToWidth(box, layout.w - layout.gutter * 2);
      const sectionFrameId = nextStructId(section.name.replace(/\s+/g, "-").toLowerCase());
      const sectionFrame = makeFrame(sectionFrameId, contentFrameId, section.name, box, {
        layoutMode: "none",
        sizingH: "fill",
        sizingV: "fixed",
      });
      const list = nextOrder[contentFrameId] ?? [];
      nextOrder[contentFrameId] = list.filter((id) => !uniqueMembers.includes(id));
      reparentCluster(nextNodes, nextOrder, contentFrameId, sectionFrame, uniqueMembers, "none");
      sectionFrameIds.push(sectionFrameId);
    }

    nextOrder[contentFrameId] = sectionFrameIds;
  }

  if (footerIds.length) {
    const wrapped = wrapCluster(nextNodes, nextOrder, frameId, "Footer", footerIds, layout, "none", {
      fullBleed: true,
    });
    if (wrapped) structuredTop.push(wrapped);
  }

  nextOrder[frameId] = [
    ...structuredTop,
    ...(nextOrder[frameId] ?? []).filter((id) => !structuredTop.includes(id)),
  ];

  const root = nextNodes[frameId];
  if (root) {
    nextNodes[frameId] = {
      ...root,
      width: layout.w,
      layoutMode: "vertical",
      layoutGap: 0,
      layoutSizingHorizontal: "fixed",
      layoutSizingVertical: "hug",
      clipChildren: true,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      primaryAxisAlign: "start",
      counterAxisAlign: "start",
    };
  }

  let layoutMap = editorNodesToLayoutMap(nextNodes);
  layoutMap = applyDeepAutoLayoutAll(layoutMap, nextOrder);
  let layoutedNodes = mergeLayoutIntoEditorNodes(nextNodes, layoutMap);
  enforceMobileShellBounds(layoutedNodes, nextOrder, frameId, layout.w);
  layoutMap = editorNodesToLayoutMap(layoutedNodes);
  layoutMap = applyDeepAutoLayoutAll(layoutMap, nextOrder);
  layoutedNodes = mergeLayoutIntoEditorNodes(layoutedNodes, layoutMap);
  const contentHeight = fitRichFrameToContent(layoutedNodes, nextOrder, frameId);

  return {
    nodes: layoutedNodes,
    childOrder: nextOrder,
    contentHeight,
  };
}
