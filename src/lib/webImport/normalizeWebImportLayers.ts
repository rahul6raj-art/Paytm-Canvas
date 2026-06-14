import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { parseColor } from "@/lib/webImport/cssParseUtils";
import type { EditorNode } from "@/stores/useEditorStore";

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
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
      };
    }
  }
}

/** Push stacked siblings down when a parent frame overlaps the one above it. */
export function fixOverlappingStackedSiblings(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): void {
  for (const [, kids] of Object.entries(childOrder)) {
    if (kids.length < 2) continue;
    const sorted = [...kids].filter((id) => nodes[id]?.visible !== false);
    sorted.sort((a, b) => (nodes[a]?.y ?? 0) - (nodes[b]?.y ?? 0));
    for (let i = 1; i < sorted.length; i++) {
      const prev = nodes[sorted[i - 1]!]!;
      const curId = sorted[i]!;
      const cur = nodes[curId]!;
      const prevBottom = prev.y + prev.height;
      const kids = childOrder[curId] ?? [];
      const kidsStartAtOrigin =
        kids.length === 0 ||
        kids.every((cid) => (nodes[cid]?.y ?? 0) <= 2);
      if (cur.y < prevBottom - 1 && kidsStartAtOrigin) {
        nodes[curId] = { ...cur, y: prevBottom };
      }
    }
  }
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
    const n = nodes[cur];
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
