import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { parseColor } from "@/lib/webImport/cssParseUtils";
import { textLayoutPatchForNode } from "@/lib/text/textLayout";
import { textResizePatch } from "@/lib/text/textNodeModel";
import type { EditorNode } from "@/stores/useEditorStore";
import { isPhoneShellBottomChrome } from "@/lib/webImport/phoneShellBottomChrome";
import {
  isPhoneShellClassName,
  isPhoneShellScrollClassName,
} from "@/lib/webImport/phoneShellViewport";

const GENERIC_WRAPPER = /^(div|card|section|main|article|form|span|wrapper|top-)/i;
const SEMANTIC_NAME =
  /^(input|button|sign in|sign up|continue with|placeholder|label|first name|last name|email|svg|background|image|hero|or$)/i;

function isSemanticNode(node: EditorNode): boolean {
  if (node.type === "text" || node.type === "image" || node.type === "path") return true;
  if (node.content?.trim()) return true;
  if (SEMANTIC_NAME.test(node.name.trim())) return true;
  return false;
}

function isPassThroughWrapper(node: EditorNode, children: EditorNode[]): boolean {
  if (children.length !== 1) return false;
  if (node.type !== "frame" && node.type !== "group") return false;
  if (isSemanticNode(node)) return false;

  const child = children[0]!;
  // Keep 1px (or tiny) layout spacers that position a taller child.
  if (node.height < 16 && child.height > node.height * 2) return false;

  if (node.strokeEnabled && (node.strokeWidth ?? 0) > 0) return false;
  if ((node.effects?.length ?? 0) > 0) return false;
  if (node.fillGradient) return false;
  const name = node.name.trim();
  if ((node.layoutMode ?? "none") !== "none") {
    if (!GENERIC_WRAPPER.test(name)) return false;
    const hasStructure =
      (node.layoutGap ?? 0) > 0 ||
      (node.paddingTop ?? 0) > 0 ||
      (node.paddingLeft ?? 0) > 0;
    if (hasStructure) return false;
  }
  if (node.clipChildren && node.fillEnabled && node.fill && node.fill !== "#ffffff") {
    return false;
  }

  if (/\bcard\b/i.test(node.codeClassName ?? "")) return false;
  if ((node.cornerRadius ?? 0) > 0) return false;
  if (node.cornerRadii?.some((r) => (r ?? 0) > 0)) return false;
  if (/^card$/i.test(node.name.trim())) return false;

  const fill = node.fill?.toLowerCase();
  if (node.fillEnabled && fill && fill !== "#ffffff" && fill !== "white") return false;

  return true;
}

/** Collapse single-child wrapper frames (nested Div/Card noise) into their parent. */
export function collapsePassThroughWrappers(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [parentId, kidIds] of Object.entries(childOrder)) {
      if (parentId === EDITOR_ROOT_KEY) continue;
      const nextKids: string[] = [];
      let parentKidsChanged = false;

      for (const kidId of kidIds) {
        const wrapper = nodes[kidId];
        const wrapperKids = childOrder[kidId] ?? [];
        const grandChildren = wrapperKids
          .map((id) => nodes[id])
          .filter((n): n is EditorNode => Boolean(n));

        if (wrapper && isPassThroughWrapper(wrapper, grandChildren)) {
          const childId = wrapperKids[0]!;
          const child = nodes[childId];
          if (child) {
            const parentKey = wrapper.parentId;
            nodes[childId] = {
              ...child,
              parentId: parentKey ?? null,
              x: Math.round(child.x + wrapper.x),
              y: Math.round(child.y + wrapper.y),
            };
            if (parentKey) {
              const siblings = childOrder[parentKey] ?? [];
              childOrder[parentKey] = siblings.map((id) => (id === wrapper.id ? childId : id));
            }
            nextKids.push(childId);
            delete nodes[kidId];
            delete childOrder[kidId];
            changed = true;
            parentKidsChanged = true;
            continue;
          }
        }
        nextKids.push(kidId);
      }

      if (parentKidsChanged) {
        childOrder[parentId] = nextKids;
      }
    }
  }
}

/** Ensure fills and strokes are hex so SVG + WASM render imported colors. */
export function normalizeWebImportColors(
  nodes: Record<string, EditorNode>,
): void {
  for (const [id, n] of Object.entries(nodes)) {
    const patch: Partial<EditorNode> = {};
    if (n.fill) {
      const hex = parseColor(n.fill);
      if (hex) patch.fill = hex;
    }
    if (n.strokeColor) {
      const hex = parseColor(n.strokeColor);
      if (hex) patch.strokeColor = hex;
    }
    if (Object.keys(patch).length > 0) {
      nodes[id] = { ...n, ...patch };
    }
  }
}

function overlapRatio(a: EditorNode, b: EditorNode): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  if (x2 <= x1 || y2 <= y1) return 0;
  const area = (x2 - x1) * (y2 - y1);
  const minArea = Math.min(a.width * a.height, b.width * b.height);
  return minArea > 0 ? area / minArea : 0;
}

function collectNodeText(
  id: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string {
  const n = nodes[id];
  if (!n) return "";
  const parts: string[] = [];
  if (n.type === "text" && n.content) parts.push(n.content);
  for (const cid of childOrder[id] ?? []) {
    const t = collectNodeText(cid, nodes, childOrder);
    if (t) parts.push(t);
  }
  return parts.join(" ");
}

function isNameFieldText(text: string): boolean {
  return /\bfirst name\b|\blast name\b/i.test(text);
}

function isEmailFieldText(text: string): boolean {
  return /\benter your email\b/i.test(text);
}

function importedTextLineHeightPx(node: EditorNode): number {
  const fontSize = node.fontSize ?? 14;
  const lineHeight = node.lineHeight;
  if (typeof lineHeight !== "number") return fontSize * 1.2;
  // DOM import stores unitless CSS ratios (e.g. 1.27), not px.
  return lineHeight <= 4 ? fontSize * lineHeight : lineHeight;
}

/** Re-measure imported text so short labels are not clipped to narrow DOM boxes. */
export function normalizeWebImportTextNodes(nodes: Record<string, EditorNode>): void {
  for (const [id, n] of Object.entries(nodes)) {
    if (n.type !== "text") continue;
    const content = n.content?.trim();
    if (!content) continue;

    const fontSize = n.fontSize ?? 14;
    const lineH = importedTextLineHeightPx(n);
    const estW = Math.ceil(content.length * fontSize * 0.58) + 8;
    const singleLine = n.height <= lineH * 1.6;
    const clipped = singleLine && estW > n.width + 2;

    let next: EditorNode;
    if (clipped) {
      next = { ...n, ...textResizePatch("auto-width") };
      const layoutPatch = expandImportedTextLayout(next, content);
      if (layoutPatch) next = { ...next, ...layoutPatch };
    } else if (singleLine && estW <= n.width + 2) {
      // Short single-line labels (bottom nav tabs, chips) — keep point text, do not wrap.
      next = {
        ...n,
        width: Math.max(n.width, estW),
        ...textResizePatch("auto-width"),
      };
    } else {
      next = { ...n, ...textResizePatch("auto-height") };
      try {
        const layoutPatch = textLayoutPatchForNode(next, content);
        if (layoutPatch?.width && layoutPatch.width > next.width + 1) {
          next = {
            ...next,
            width: layoutPatch.width,
            ...textResizePatch("auto-width"),
          };
        }
        if (layoutPatch?.height && layoutPatch.height > next.height) {
          next = { ...next, height: layoutPatch.height };
        }
      } catch {
        if (estW > next.width + 1) {
          next = { ...next, width: estW, ...textResizePatch("auto-width") };
        }
      }
    }
    nodes[id] = next;
  }
}

const BOTTOM_NAV_LABEL_RE = /\bbn__label\b/;

/** Keep bottom nav tab labels on one centered line after import normalization. */
export function normalizeBottomNavTextNodes(
  nodes: Record<string, EditorNode>,
): void {
  for (const [id, n] of Object.entries(nodes)) {
    if (n.type !== "text") continue;
    if (!BOTTOM_NAV_LABEL_RE.test(n.codeClassName ?? "")) continue;
    const content = n.content?.trim();
    if (!content) continue;

    const fontSize = n.fontSize ?? 12;
    const lineH = importedTextLineHeightPx(n);
    const estW = Math.ceil(content.length * fontSize * 0.58) + 4;
    const width = Math.max(estW, 40);
    const height = Math.ceil(lineH);

    let x = n.x;
    const parent = n.parentId ? nodes[n.parentId] : undefined;
    if (parent) {
      x = Math.max(0, Math.round((parent.width - width) / 2));
    }

    nodes[id] = {
      ...n,
      x,
      width,
      height,
      textAlign: "center",
      ...textResizePatch("auto-width"),
    };
  }
}

/** Fill-only SVG paths must not pick up visible center strokes from defaults. */
export function normalizeWebImportSvgPaths(nodes: Record<string, EditorNode>): void {
  for (const [id, n] of Object.entries(nodes)) {
    if (n.type !== "path") continue;
    const patch: Partial<EditorNode> = {};
    const hasFill = n.fillEnabled !== false && Boolean(n.fill);
    const hasStroke =
      n.strokeEnabled !== false &&
      (n.strokeWidth ?? 0) > 0 &&
      Boolean(n.strokeColor);

    if (hasFill && hasStroke) {
      patch.strokeEnabled = false;
      patch.strokeWidth = 0;
    } else if ((n.strokeWidth ?? 0) <= 0 || n.strokeEnabled === false) {
      patch.strokeEnabled = false;
      patch.strokeWidth = 0;
    }
    if (hasFill) {
      patch.fillEnabled = true;
    }
    if (Object.keys(patch).length > 0) {
      nodes[id] = { ...n, ...patch };
    }
  }
}

function expandImportedTextLayout(
  node: EditorNode,
  content: string,
): Partial<EditorNode> | null {
  try {
    const layoutPatch = textLayoutPatchForNode(node, content);
    if (!layoutPatch?.width || layoutPatch.width <= node.width) return layoutPatch;
    return { ...layoutPatch, ...textResizePatch(node.textResizeMode ?? "auto-width") };
  } catch {
    const charW = (node.fontSize ?? 14) * 0.58;
    const estW = Math.ceil(content.length * charW) + 8;
    if (estW <= node.width) return { ...textResizePatch("auto-width") };
    return { width: estW, ...textResizePatch("auto-width") };
  }
}

/** Expand `.pml-home__scroll` (and similar) to fit below-the-fold sections. */
export function expandWebImportScrollFrames(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [id, kids] of Object.entries(childOrder)) {
    const parent = nodes[id];
    if (!parent || (parent.type !== "frame" && parent.type !== "group")) continue;
    const cls = parent.codeClassName ?? "";
    if (!/__scroll\b/.test(cls)) continue;
    let maxY = 0;
    for (const cid of kids) {
      const c = nodes[cid];
      if (!c || c.visible === false) continue;
      maxY = Math.max(maxY, c.y + c.height);
    }
    if (maxY <= parent.height) continue;
    nodes[id] = {
      ...parent,
      height: Math.ceil(maxY),
      clipChildren: false,
    };
  }
}

/** Phone shells do not clip on canvas — full scroll content stays visible. */
export function disableClipOnScrollContainers(nodes: Record<string, EditorNode>): void {
  for (const [id, node] of Object.entries(nodes)) {
    const cls = node.codeClassName ?? "";
    if (
      /__scroll\b/.test(cls) ||
      /\bpml-(?:home|more|stocks|signup|onboarding)\b/.test(cls)
    ) {
      nodes[id] = { ...node, clipChildren: false };
    }
  }
}

/** Keep decorative layers (glows, blurs) visible when children extend outside parent bounds. */
export function preserveWebImportOverflowEffects(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const parent = nodes[parentId];
    if (!parent || parent.clipChildren === false || kids.length === 0) continue;
    if (
      isPhoneShellClassName(parent.codeClassName) ||
      isPhoneShellScrollClassName(parent.codeClassName)
    ) {
      continue;
    }

    let needsNoClip = false;
    for (const cid of kids) {
      const c = nodes[cid];
      if (!c?.visible) continue;
      const extendsOutside =
        c.x < -1 ||
        c.y < -1 ||
        c.x + c.width > parent.width + 1 ||
        c.y + c.height > parent.height + 1;
      if (!extendsOutside) continue;
      if (
        (c.effects?.length ?? 0) > 0 ||
        c.fillGradient ||
        (c.opacity ?? 1) < 0.98 ||
        c.name.toLowerCase().includes("glow")
      ) {
        needsNoClip = true;
        break;
      }
    }
    if (needsNoClip) {
      nodes[parentId] = { ...parent, clipChildren: false };
    }
  }
}

/** Web import uses browser-measured absolute geometry — disable flex reflow. */
export function stripWebImportAutoLayout(nodes: Record<string, EditorNode>): void {
  for (const [id, n] of Object.entries(nodes)) {
    if ((n.layoutMode ?? "none") === "none") continue;
    nodes[id] = { ...n, layoutMode: "none", layoutGap: 0 };
  }
}

function isLayoutContainer(node: EditorNode): boolean {
  return node.type === "frame" || node.type === "group";
}

/** Drop name-field groups that overlap the email field (SPA keeps both steps in DOM). */
export function dedupeOverlappingFormSiblings(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    const toRemove = new Set<string>();
    for (let i = 0; i < kids.length; i++) {
      for (let j = i + 1; j < kids.length; j++) {
        const idA = kids[i]!;
        const idB = kids[j]!;
        const a = nodes[idA];
        const b = nodes[idB];
        if (!a || !b || a.visible === false || b.visible === false) continue;
        if (!isLayoutContainer(a) || !isLayoutContainer(b)) continue;

        const ratio = overlapRatio(a, b);
        if (ratio < 0.35) continue;

        const textA = collectNodeText(idA, nodes, childOrder);
        const textB = collectNodeText(idB, nodes, childOrder);
        if (isNameFieldText(textA) && isEmailFieldText(textB)) toRemove.add(idA);
        else if (isNameFieldText(textB) && isEmailFieldText(textA)) toRemove.add(idB);
      }
    }
    if (toRemove.size === 0) continue;

    const removeSubtree = (id: string) => {
      for (const cid of childOrder[id] ?? []) removeSubtree(cid);
      delete nodes[id];
      delete childOrder[id];
    };

    childOrder[parentId] = kids.filter((id) => !toRemove.has(id));
    for (const id of toRemove) removeSubtree(id);
  }
}

/** Shrink wrapper frames to the bottom of their children (fixes extra input wrapper height). */
export function trimFramesToChildBounds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [id, kids] of Object.entries(childOrder)) {
    const parent = nodes[id];
    if (!parent || parent.type !== "frame") continue;
    if (kids.length === 0) continue;
    let maxY = 0;
    for (const cid of kids) {
      const c = nodes[cid];
      if (!c || c.visible === false) continue;
      maxY = Math.max(maxY, c.y + c.height);
    }
    const contentH = Math.ceil(maxY);
    const excess = parent.height - contentH;
    if (excess >= 4 && excess <= 48) {
      nodes[id] = {
        ...parent,
        height: contentH,
      };
    }
  }
}

/** Push stacked siblings down when a parent frame overlaps the one above it. */
export function fixOverlappingStackedSiblings(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (kids.length < 2) continue;
    const parent = nodes[parentId];
    if (isSvgIconSubpathStack(parent, kids, nodes)) continue;
    const sorted = [...kids].filter((id) => nodes[id]?.visible !== false);
    sorted.sort((a, b) => (nodes[a]?.y ?? 0) - (nodes[b]?.y ?? 0));
    for (let i = 1; i < sorted.length; i++) {
      const prev = nodes[sorted[i - 1]!]!;
      const curId = sorted[i]!;
      const cur = nodes[curId]!;
      if (
        isPhoneShellBottomChrome(cur.codeClassName, cur.codeJsxTag) ||
        isPhoneShellBottomChrome(prev.codeClassName, prev.codeJsxTag)
      ) {
        continue;
      }
      const prevBottom = prev.y + prev.height;
      const kids = childOrder[curId] ?? [];
      const kidsStartAtOrigin =
        kids.length === 0 ||
        kids.every((cid) => (nodes[cid]?.y ?? 0) <= 2);
      // Same-row flex children share a Y but are not a vertical stack — skip them.
      const xOverlap =
        Math.max(0, Math.min(prev.x + prev.width, cur.x + cur.width) - Math.max(prev.x, cur.x));
      const minW = Math.min(prev.width, cur.width);
      const columnAligned = minW > 0 && xOverlap > minW * 0.25;
      if (cur.y < prevBottom - 1 && kidsStartAtOrigin && columnAligned) {
        nodes[curId] = { ...cur, y: prevBottom };
      }
    }
  }
}

const SVG_ICON_VECTOR_TYPES = new Set<EditorNode["type"]>([
  "path",
  "rectangle",
  "ellipse",
  "line",
  "polygon",
]);

/** SVG icons decompose into overlapping path layers — never reflow them as a vertical stack. */
function isSvgIconSubpathStack(
  parent: EditorNode | undefined,
  kids: string[],
  nodes: Record<string, EditorNode>,
): boolean {
  if (!parent) return false;
  if (parent.name === "Svg") return true;
  if (parent.width > 72 || parent.height > 72) return false;
  const visible = kids
    .map((id) => nodes[id])
    .filter((n): n is EditorNode => Boolean(n && n.visible !== false));
  if (visible.length < 2) return false;
  return visible.every((n) => SVG_ICON_VECTOR_TYPES.has(n.type));
}

const FOOTER_LINK_FILL = /^#256bfa$/i;

/** Legal footer: center alignment, underline links, consistent muted body color. */
export function normalizeFooterLegalText(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [id, n] of Object.entries(nodes)) {
    const isFooter =
      n.codeJsxTag === "p" &&
      (n.codeClassName?.includes("text-center") ||
        n.name?.toLowerCase().includes("by clicking"));
    if (!isFooter) continue;
    nodes[id] = { ...n, layoutMode: "none", textAlign: "center" };
    for (const cid of childOrder[id] ?? []) {
      const child = nodes[cid];
      if (!child || child.type !== "text") continue;
      const isLink =
        child.codeJsxTag === "a" ||
        FOOTER_LINK_FILL.test(child.fill ?? "") ||
        child.name?.toLowerCase().includes("underline");
      nodes[cid] = {
        ...child,
        fontSize: child.fontSize ?? 14,
        lineHeight: child.lineHeight ?? 1.43,
        fill: isLink ? child.fill ?? "#256bfa" : child.fill ?? "#737373",
        textDecoration: isLink ? "underline" : child.textDecoration,
      };
    }
  }
}

function worldY(
  id: string,
  nodes: Record<string, EditorNode>,
): number {
  let y = 0;
  let cur: string | null | undefined = id;
  while (cur) {
    const n: EditorNode | undefined = nodes[cur];
    if (!n) break;
    y += n.y;
    cur = n.parentId;
  }
  return y;
}

function shiftSubtreeY(
  id: string,
  delta: number,
  nodes: Record<string, EditorNode>,
): void {
  const n = nodes[id];
  if (!n || delta === 0) return;
  nodes[id] = { ...n, y: n.y + delta };
}

/** Preserve the 16px gap between the email field block and the primary CTA. */
export function normalizeEmailToButtonGap(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  gapPx = 16,
): void {
  const input = Object.values(nodes).find(
    (n) =>
      n.name === "Input" ||
      (childOrder[n.id] ?? []).some((cid) =>
        nodes[cid]?.name?.toLowerCase().includes("enter your email"),
      ),
  );
  const btn = Object.values(nodes).find((n) => n.name === "Continue with Email");
  if (!input || !btn) return;
  const inputBottom = worldY(input.id, nodes) + input.height;
  const btnTop = worldY(btn.id, nodes);
  const delta = gapPx - (btnTop - inputBottom);
  if (delta > 2) shiftSubtreeY(btn.id, delta, nodes);
}

/** Prevent flex reflow when every child already has captured absolute coordinates. */
export function disableAutoLayoutForAbsoluteChildren(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [parentId, kids] of Object.entries(childOrder)) {
    if (kids.length < 2) continue;
    const parent = nodes[parentId];
    if (!parent || (parent.layoutMode ?? "none") === "none") continue;
    const visibleKids = kids
      .map((id) => nodes[id])
      .filter((n): n is EditorNode => Boolean(n && n.visible !== false));
    if (visibleKids.length < 2) continue;
    if (visibleKids.every((k) => k.layoutPositioning === "absolute")) {
      nodes[parentId] = { ...parent, layoutMode: "none", layoutGap: 0 };
    }
  }
}
