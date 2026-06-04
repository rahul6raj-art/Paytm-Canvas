import type { BooleanOperation } from "@/lib/booleanGeometry";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import {
  parseBooleanOperandsFromExportSvg,
  parseBooleanOperandsFromMarkup,
  pathNodesFromSvgOperands,
} from "@/lib/codeImport/booleanSvgImport";
import { DEFAULT_FRAME_FILL, DEFAULT_SHAPE_FILL } from "@/lib/shapes/shapeModel";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { EditorNode, NodeKind } from "@/stores/useEditorStore";
import { placeScreenFrameOnCanvas } from "@/lib/codeExport/frameRelativeExport";
import {
  isPaytmCraftRoundTripHtml,
  parseNodeKindFromPcAttrs,
  PC_BOOLEAN_OP_ATTR,
  PC_COMPONENT_ATTR,
  PC_ID_ATTR,
  PC_MASK_GROUP_ATTR,
  PC_NAME_ATTR,
  PC_SHAPE_ATTR,
  PC_TYPE_ATTR,
} from "@/lib/codeExport/pcMetadata";
import { finalizeImportedGraph } from "@/lib/codeRoundTrip/finalizeImportedGraph";
import { classNameToNodePatch, mergeStylePatches } from "@/lib/codeRoundTrip/reactClassNameImport";
import { placeholderSizeForComponent } from "@/lib/codeRoundTrip/reactComponentPlaceholders";
import { sanitizeComponentName } from "@/lib/codeRoundTrip/reactStyle";
import { reactStyleToNodePatch } from "@/lib/codeRoundTrip/reactStyleImport";
import {
  ellipseHasCustomArc,
  parseEllipseArcPcAttrs,
  PC_ARC_RATIO_ATTR,
  PC_ARC_START_ATTR,
  PC_ARC_SWEEP_ATTR,
} from "@/lib/shapes/ellipseArcExport";
import type { HtmlImportElement } from "./htmlParseTree";
import { parseHtmlImportTree } from "./htmlParseTree";
import { parseInlineCss } from "./parseInlineCss";

const INTRINSIC_HTML = new Set([
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "label",
  "a",
  "button",
  "section",
  "main",
  "article",
  "header",
  "footer",
  "nav",
  "form",
  "ul",
  "ol",
  "li",
  "img",
  "input",
  "textarea",
]);

const SKIP_TAGS = new Set([
  "script",
  "style",
  "meta",
  "link",
  "head",
  "title",
  "noscript",
  "html",
  "body",
  "svg",
]);

const BOOLEAN_OPS = new Set<BooleanOperation>(["union", "subtract", "intersect", "exclude"]);

let idSeq = 0;
function nextId(): string {
  idSeq += 1;
  return `pc-${idSeq}`;
}

export type HtmlImportResult =
  | {
      ok: true;
      slice: EditorPersistSlice;
      componentName: string;
      message: string;
    }
  | { ok: false; error: string };

function isIntrinsicHtmlTag(tag: string): boolean {
  return INTRINSIC_HTML.has(tag.toLowerCase());
}

function resolveNodeKind(
  pcType: string | undefined,
  legacyShape: string | undefined,
  tag: string,
  hasText: boolean,
  hasElementChildren: boolean,
): NodeKind {
  const explicit = parseNodeKindFromPcAttrs(pcType, legacyShape);
  if (explicit) return explicit;

  const lower = tag.toLowerCase();
  if (lower === "img") return "image";
  if (
    ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "label", "a", "li"].includes(lower) &&
    hasText &&
    !hasElementChildren
  ) {
    return "text";
  }
  if (!isIntrinsicHtmlTag(tag)) return "frame";
  if (hasElementChildren) return "frame";
  if (lower === "div" || lower === "section" || lower === "main") return "frame";
  return "rectangle";
}

function defaultSizeForKind(kind: NodeKind, tag: string): { width: number; height: number } {
  if (kind === "text") return { width: 120, height: 24 };
  if (kind === "image") return { width: 120, height: 120 };
  if (!isIntrinsicHtmlTag(tag)) return placeholderSizeForComponent(tag);
  return { width: 160, height: 48 };
}

function applyCornerRadiusForKind(node: EditorNode): EditorNode {
  const w = node.width;
  const h = node.height;
  if (node.type === "ellipse") {
    if (ellipseHasCustomArc(node)) return node;
    return { ...node, cornerRadius: 9999 };
  }
  if (node.type === "rectangle" && node.cornerRadius !== undefined) {
    const maxR = Math.min(w, h) / 2;
    if (node.cornerRadius >= 999 || node.cornerRadius > maxR) {
      return { ...node, cornerRadius: Math.min(node.cornerRadius, maxR) };
    }
  }
  return node;
}

function readElementAttrs(el: HtmlImportElement): {
  id: string;
  pcType?: string;
  name?: string;
  shape?: string;
  className?: string;
  componentTag?: string;
  style: ReturnType<typeof parseInlineCss>;
  src?: string;
  arcStart?: string;
  arcSweep?: string;
  arcRatio?: string;
} {
  const rawId = el.getAttr(PC_ID_ATTR);
  const id = rawId && /^[\w-]+$/.test(rawId) ? rawId : nextId();
  return {
    id,
    pcType: el.getAttr(PC_TYPE_ATTR),
    name: el.getAttr(PC_NAME_ATTR),
    shape: el.getAttr(PC_SHAPE_ATTR),
    className: el.getAttr("class"),
    componentTag: el.getAttr(PC_COMPONENT_ATTR),
    style: parseInlineCss(el.getAttr("style")),
    src: el.getAttr("src"),
    arcStart: el.getAttr(PC_ARC_START_ATTR),
    arcSweep: el.getAttr(PC_ARC_SWEEP_ATTR),
    arcRatio: el.getAttr(PC_ARC_RATIO_ATTR),
  };
}

function finalizeFrameAfterChildren(
  node: EditorNode,
  preserveExactLayout: boolean,
): EditorNode {
  if (node.type !== "frame" && node.type !== "group") return node;
  let next = { ...node };
  if (preserveExactLayout) {
    if (!next.layoutMode) next.layoutMode = "none";
    if (next.type === "frame") next.clipChildren = true;
    return next;
  }
  return next;
}

type BuildCtx = {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  preserveExactLayout: boolean;
};

function buildFromElement(
  el: HtmlImportElement,
  parentId: string | null,
  ctx: BuildCtx,
  siblingIndex: number,
): string {
  const tag = el.tagLower;
  const attrs = readElementAttrs(el);
  const booleanOpRaw = el.getAttr(PC_BOOLEAN_OP_ATTR);
  const booleanOp = BOOLEAN_OPS.has(booleanOpRaw as BooleanOperation)
    ? (booleanOpRaw as BooleanOperation)
    : undefined;
  const isMaskGroupAttr = el.getAttr(PC_MASK_GROUP_ATTR) === "true";

  let elementKids = el
    .childElements()
    .filter((c) => !SKIP_TAGS.has(c.tagLower));
  const svgExport =
    el.querySelector("svg") ??
    elementKids.find((c) => c.tagLower === "svg") ??
    null;
  if (booleanOp && svgExport) {
    elementKids = elementKids.filter((c) => c.tagLower !== "svg");
  }

  if (isMaskGroupAttr) {
    const clipWrapper = elementKids.find((c) => {
      const style = parseInlineCss(c.getAttr("style"));
      return typeof style.clipPath === "string" && style.clipPath.includes("url(");
    });
    if (clipWrapper) {
      elementKids = clipWrapper.childElements().filter((c) => !SKIP_TAGS.has(c.tagLower));
    }
  }

  const textContent = el.directText();
  const hasElementChildren = elementKids.length > 0;

  const componentTag = attrs.componentTag;
  const effectiveTag = componentTag ?? tag;
  const intrinsic = componentTag ? false : isIntrinsicHtmlTag(tag);

  const kind = resolveNodeKind(
    attrs.pcType,
    attrs.shape,
    effectiveTag,
    !!textContent,
    hasElementChildren,
  );
  const mergedPatch = mergeStylePatches(
    reactStyleToNodePatch(attrs.style),
    classNameToNodePatch(attrs.className),
  );
  const defaults = defaultSizeForKind(kind, effectiveTag);

  let node: EditorNode = {
    id: attrs.id,
    parentId,
    name: attrs.name ?? effectiveTag,
    x: mergedPatch.x ?? 0,
    y: mergedPatch.y ?? siblingIndex * (defaults.height + 8),
    width: mergedPatch.width ?? defaults.width,
    height: mergedPatch.height ?? defaults.height,
    rotation: mergedPatch.rotation ?? 0,
    visible: true,
    locked: false,
    expanded: true,
    fill:
      mergedPatch.fill ??
      (kind === "text" ? undefined : kind === "frame" ? DEFAULT_FRAME_FILL : DEFAULT_SHAPE_FILL),
    fillEnabled: kind !== "text",
    codeJsxTag: effectiveTag,
    codeJsxIntrinsic: intrinsic,
    codeClassName: attrs.className,
    ...mergedPatch,
    type: kind,
  };

  const arcPatch = parseEllipseArcPcAttrs({
    arcStart: attrs.arcStart,
    arcSweep: attrs.arcSweep,
    arcRatio: attrs.arcRatio,
  });
  if (arcPatch) {
    node = { ...node, ...arcPatch };
  }

  node = applyCornerRadiusForKind(node);

  if (kind === "text") {
    node.content = textContent || "Text";
    node.textColor = mergedPatch.textColor ?? node.textColor ?? "#111111";
    node.fill = node.textColor;
    node.textResizeMode = "auto-width";
  }

  if (kind === "image" && attrs.src) {
    node.imageSrc = attrs.src;
    node.imageName = effectiveTag;
  }

  if (booleanOp) {
    const parsed =
      (svgExport
        ? parseBooleanOperandsFromExportSvg(svgExport, booleanOp)
        : null) ??
      parseBooleanOperandsFromMarkup(el.innerMarkup(), booleanOp);
    if (parsed && parsed.operandDs.length > 0) {
      node = {
        ...node,
        type: "group",
        isBooleanGroup: true,
        booleanOperation: booleanOp,
        fill: parsed.fill,
        fillEnabled: true,
      };
      const operandNodes = pathNodesFromSvgOperands(
        parsed.operandDs,
        attrs.id,
        node.width,
        node.height,
        parsed.fill,
        nextId,
      );
      const childIds: string[] = [];
      for (const opNode of operandNodes) {
        ctx.nodes[opNode.id] = opNode;
        childIds.push(opNode.id);
      }
      ctx.childOrder[attrs.id] = childIds;
      ctx.nodes[attrs.id] = finalizeFrameAfterChildren(node, ctx.preserveExactLayout);
      return attrs.id;
    }
  }

  const childIds: string[] = [];
  for (let i = 0; i < elementKids.length; i++) {
    const ch = elementKids[i]!;
    const built = buildFromElement(ch, attrs.id, ctx, i);
    if (ctx.nodes[built]) childIds.push(built);
  }
  ctx.childOrder[attrs.id] = childIds;
  node = finalizeFrameAfterChildren(node, ctx.preserveExactLayout);

  if (booleanOp) {
    node = {
      ...node,
      isBooleanGroup: true,
      booleanOperation: booleanOp,
    };
  }

  ctx.nodes[attrs.id] = node;
  return attrs.id;
}

function findImportRootElements(root: HtmlImportElement): HtmlImportElement[] {
  const pcRoot = root.querySelector("[data-pc-root]");
  if (pcRoot) {
    if (pcRoot.getAttr(PC_ID_ATTR)) return [pcRoot];
    const kids = pcRoot.childElements().filter((c) => !SKIP_TAGS.has(c.tagLower));
    if (kids.length > 0) return kids;
    return [pcRoot];
  }

  const kids = root.childElements().filter((c) => !SKIP_TAGS.has(c.tagLower));
  return kids.length > 0 ? kids : [root];
}

export function importHtmlFromString(
  source: string,
  opts?: { fileName?: string },
): HtmlImportResult {
  idSeq = 0;
  const trimmed = source.trim();
  if (!trimmed) {
    return { ok: false, error: "Paste HTML or upload an .html file." };
  }

  const parsed = parseHtmlImportTree(trimmed);
  if (!parsed.ok) {
    return { ok: false, error: parsed.error };
  }

  const roots = findImportRootElements(parsed.root);
  if (roots.length === 0) {
    return { ok: false, error: "No HTML elements found to import." };
  }

  const preserveExactLayout = isPaytmCraftRoundTripHtml(trimmed);
  const ctx: BuildCtx = { nodes: {}, childOrder: {}, preserveExactLayout };
  const builtRootIds: string[] = [];

  for (let i = 0; i < roots.length; i++) {
    const built = buildFromElement(roots[i]!, null, ctx, i);
    if (ctx.nodes[built]) builtRootIds.push(built);
  }

  if (builtRootIds.length === 0) {
    return { ok: false, error: "No layers could be built from this HTML." };
  }

  let exportRootIds = builtRootIds;
  if (builtRootIds.length > 1) {
    const wrapId = nextId();
    const wrap: EditorNode = {
      id: wrapId,
      parentId: null,
      type: "frame",
      name: "Imported",
      x: 0,
      y: 0,
      width: 390,
      height: 600,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      layoutMode: "vertical",
      layoutGap: 0,
      fill: "#ffffff",
      fillEnabled: true,
      clipChildren: true,
    };
    ctx.nodes[wrapId] = wrap;
    ctx.childOrder[wrapId] = builtRootIds;
    for (const id of builtRootIds) {
      const n = ctx.nodes[id];
      if (n) ctx.nodes[id] = { ...n, parentId: wrapId };
    }
    exportRootIds = [wrapId];
  }

  if (preserveExactLayout) {
    ctx.nodes = placeScreenFrameOnCanvas(ctx.nodes, exportRootIds);
  } else {
    ctx.nodes = finalizeImportedGraph(ctx.nodes, ctx.childOrder);
    ctx.nodes = placeScreenFrameOnCanvas(ctx.nodes, exportRootIds);
  }

  ctx.childOrder[EDITOR_ROOT_KEY] = exportRootIds;

  const rootNode = ctx.nodes[exportRootIds[0]!];
  const componentName = sanitizeComponentName(
    opts?.fileName?.replace(/\.[^.]+$/, "") ?? rootNode?.name ?? "ImportedHtml",
  );
  if (rootNode) {
    ctx.nodes[exportRootIds[0]!] = { ...rootNode, name: rootNode.name || componentName };
  }

  const slice = wrapPersistSliceWithPages({
    nodes: ctx.nodes,
    childOrder: ctx.childOrder,
    assets: {},
    designTokens: {},
    fileName: componentName,
    selectedIds: exportRootIds,
    zoom: 1,
    pan: { x: 0, y: 0 },
    showGrid: true,
    showRulers: true,
    canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    comments: [],
  });

  const count = Object.keys(ctx.nodes).length;
  return {
    ok: true,
    slice,
    componentName,
    message: preserveExactLayout
      ? `Imported ${count} layer(s) with 1:1 layout (${componentName}).`
      : `Converted HTML to ${count} editable layer(s) (${componentName}).`,
  };
}
