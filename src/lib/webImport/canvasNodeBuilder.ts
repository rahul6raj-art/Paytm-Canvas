import { convertSvgTree } from "@/lib/svgImport";
import { sanitizeImportText } from "@/lib/webImport/urlValidation";
import { mapBackgroundSizeToFit } from "@/lib/webImport/backgroundImageFit";
import { ensureReadableTextColor } from "@/lib/webImport/colorContrast";
import { isLayoutContainer } from "@/lib/webImport/layoutAnalyzer";
import { isImportableTextContent, isSemanticTextTag } from "@/lib/webImport/textContentHeuristics";
import type {
  DesignNode,
  ImportWebPageMeta,
  ImportWebSceneNode,
} from "@/lib/webImport/types";

let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

const INPUT_TAGS = new Set(["input", "textarea", "select"]);

type AssetMap = Record<string, { id: string; dataUrl: string; name: string; mimeType: string }>;
type MasterMap = Map<string, ImportWebSceneNode>;

function buildFromDesign(
  node: DesignNode,
  assets: AssetMap,
  masters: MasterMap,
): ImportWebSceneNode | null {
  if (node.sourceComponentId) {
    const master = masters.get(node.sourceComponentId);
    if (master) return cloneSceneNode(master, node);
    return null;
  }
  const scene = buildSceneNode(node, assets, masters);
  if (node.isComponentMaster && node.componentId) {
    masters.set(`web-cmp-${node.componentId}`, scene);
  }
  return scene;
}

function buildSceneNode(
  node: DesignNode,
  assets: AssetMap,
  masters: MasterMap,
): ImportWebSceneNode {
  const type = nodeKind(node);
  const layout = node.layout;
  const style = node.style;
  const hasFill = Boolean(style.fillEnabled && (style.fill || style.fillGradient));

  const base: ImportWebSceneNode = {
    id: nextId("web"),
    type,
    name: node.name,
    x: node.bounds.x,
    y: node.bounds.y,
    width: node.bounds.width,
    height: node.bounds.height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    codeClassName: node.codeClassName,
    codeJsxTag: node.codeJsxTag,
    codeJsxIntrinsic: node.codeJsxIntrinsic,
    fill: hasFill ? style.fill : undefined,
    fillEnabled: hasFill,
    fillOpacity: style.fillOpacity,
    fillType: style.fillType,
    fillGradient: style.fillGradient,
    strokeColor: style.strokeColor,
    strokeWidth: style.strokeWidth,
    strokeEnabled: style.strokeEnabled,
    cornerRadius: style.cornerRadius,
    cornerRadii: style.cornerRadii,
    opacity: style.opacity,
    effects: style.effects,
    layoutMode: layout.layoutMode,
    layoutGap: layout.layoutGap,
    layoutWrap: layout.layoutWrap,
    paddingTop: layout.paddingTop,
    paddingRight: layout.paddingRight,
    paddingBottom: layout.paddingBottom,
    paddingLeft: layout.paddingLeft,
    primaryAxisAlign: layout.primaryAxisAlign,
    counterAxisAlign: layout.counterAxisAlign,
    layoutPositioning: layout.layoutPositioning,
    layoutSizingHorizontal: layout.layoutSizingHorizontal,
    layoutSizingVertical: layout.layoutSizingVertical,
    layoutGrow: layout.layoutGrow,
    clipChildren: node.overflowHidden ?? false,
    isComponent: node.isComponentMaster || undefined,
    componentId: node.componentId,
    sourceComponentId: node.sourceComponentId,
  };

  if (type === "text" && node.text) {
    base.content = sanitizeImportText(node.text, 4000);
    base.fontFamily = node.typography?.fontFamily ?? "Inter, sans-serif";
    base.fontSize = node.typography?.fontSize ?? 14;
    base.fontWeight = node.typography?.fontWeight ?? 400;
    base.lineHeight = node.typography?.lineHeight;
    base.letterSpacing = node.typography?.letterSpacing;
    base.textDecoration = node.typography?.textDecoration;
    base.textAlign = node.typography?.textAlign ?? "left";
    base.verticalAlign = node.typography?.verticalAlign;
    base.textResizeMode = "auto-height";
    base.fill = style.fill ?? "#111111";
    base.fillEnabled = true;
    return base;
  }

  if (type === "image" && node.imageSrc) {
    const aid = nextId("asset");
    assets[aid] = {
      id: aid,
      dataUrl: node.imageSrc,
      name: node.ariaLabel || "Imported image",
      mimeType: node.imageSrc.startsWith("data:") ? "image/png" : "image/png",
    };
    base.assetId = aid;
    base.imageSrc = node.imageSrc;
    base.imageFitMode = style.imageFitMode;
  }

  if (node.svgMarkup) {
    return buildSvgSceneNode(node, assets, base);
  }

  const children: ImportWebSceneNode[] = [];
  for (const child of node.children) {
    const built = buildFromDesign(child, assets, masters);
    if (built) children.push(built);
  }

  if (node.backgroundImageSrc && type !== "image") {
    children.unshift(
      buildBackgroundImageLayer(node, assets, node.bounds.width, node.bounds.height),
    );
  }

  if (children.length > 0) {
    base.children = children;
    if (base.type === "rectangle") base.type = "frame";
    if (isLayoutContainer(layout) && !base.layoutMode) {
      base.layoutMode = layout.layoutMode ?? "vertical";
    }
  }

  if (node.role === "button" && node.tagName.toLowerCase() === "a") {
    if (children.length > 0) {
      if (node.text && !hasDescendantText(children)) {
        base.children = [...children, buildRecoveredLabel(node, base)];
      }
      return { ...base, layoutMode: "none", layoutGap: 0 };
    }
  }

  if (node.role === "button" && (node.text || node.children.length > 0)) {
    if (children.length > 0) {
      return preserveCapturedButtonFrame(node, base, children);
    }
    if (node.text || node.children.length > 0) {
      return buildStyledControlFrame(node, base, "button");
    }
  }

  if (
    INPUT_TAGS.has(node.tagName.toLowerCase()) ||
    node.role === "input" ||
    node.role === "dropdown"
  ) {
    return buildStyledControlFrame(node, base, "input");
  }

  // Recover a container's own text label (links/tabs/styled divs) that would
  // otherwise be lost because frames don't render text. Only when no descendant
  // already carries that text, to avoid duplicating inline-text content.
  if (
    node.text &&
    base.children &&
    base.children.length > 0 &&
    !hasDescendantText(base.children)
  ) {
    base.children = [...base.children, buildRecoveredLabel(node, base)];
    base.layoutMode = base.layoutMode ?? "horizontal";
    base.primaryAxisAlign = base.primaryAxisAlign ?? "center";
    base.counterAxisAlign = base.counterAxisAlign ?? "center";
    base.layoutGap = base.layoutGap ?? 8;
    base.preserveAutoLayout = true;
  }

  return base;
}

function hasDescendantText(children: ImportWebSceneNode[]): boolean {
  for (const c of children) {
    if (c.type === "text" && c.content && c.content.trim()) return true;
    if (c.children && hasDescendantText(c.children)) return true;
  }
  return false;
}

function buildRecoveredLabel(
  node: DesignNode,
  base: ImportWebSceneNode,
): ImportWebSceneNode {
  const buttonBg = base.fillEnabled ? base.fill : undefined;
  const rawColor = node.typography?.color ?? "#111111";
  const color = ensureReadableTextColor(rawColor, buttonBg) ?? rawColor;
  return {
    id: nextId("web"),
    type: "text",
    name: "Label",
    x: 0,
    y: 0,
    width: Math.max(40, base.width),
    height: 20,
    content: sanitizeImportText(node.text || "", 200),
    fontFamily: node.typography?.fontFamily ?? "Inter",
    fontSize: node.typography?.fontSize ?? 14,
    fontWeight: node.typography?.fontWeight ?? 500,
    textAlign: node.typography?.textAlign ?? "center",
    fill: color,
    fillEnabled: true,
    layoutSizingHorizontal: "hug",
    layoutSizingVertical: "hug",
    layoutPositioning: "auto",
  };
}

function preserveCapturedButtonFrame(
  node: DesignNode,
  base: ImportWebSceneNode,
  children: ImportWebSceneNode[],
): ImportWebSceneNode {
  const label = sanitizeImportText(node.text || "", 200);
  const buttonBg = base.fillEnabled ? base.fill : undefined;
  const rawLabelColor = node.typography?.color ?? "#ffffff";
  const labelColor =
    ensureReadableTextColor(rawLabelColor, buttonBg) ?? rawLabelColor;

  let kids = [...children];
  const hasText = kids.some((c) => c.type === "text" && c.content?.trim());
  if (label && !hasText) {
    const icon = kids.find(
      (c) =>
        c.type === "frame" ||
        c.name === "Svg" ||
        (c.width <= 32 && c.height <= 32),
    );
    const fontSize = node.typography?.fontSize ?? 16;
    const textH = 20;
    const gap = 8;
    const textX = icon ? icon.x + icon.width + gap : Math.max(8, (base.width - label.length * fontSize * 0.55) / 2);
    kids.push({
      id: nextId("web"),
      type: "text",
      name: "Label",
      x: Math.round(textX),
      y: Math.max(0, Math.round((base.height - textH) / 2)),
      width: Math.max(40, base.width - textX - 8),
      height: textH,
      content: label,
      fontFamily: node.typography?.fontFamily ?? "Inter",
      fontSize,
      fontWeight: node.typography?.fontWeight ?? 600,
      textAlign: icon ? "left" : "center",
      fill: labelColor,
      fillEnabled: true,
      layoutPositioning: "absolute",
    });
  }

  return {
    ...base,
    type: "frame",
    name: node.name || "Button",
    layoutMode: "none",
    layoutGap: 0,
    children: kids,
  };
}

function buildStyledControlFrame(
  node: DesignNode,
  base: ImportWebSceneNode,
  kind: "input" | "button",
): ImportWebSceneNode {
  const padL = node.layout.paddingLeft ?? (kind === "input" ? 12 : 16);
  const padR = node.layout.paddingRight ?? padL;
  const padT = node.layout.paddingTop ?? (kind === "input" ? 8 : 10);
  const padB = node.layout.paddingBottom ?? padT;
  const label =
    kind === "input"
      ? sanitizeImportText(node.placeholder || node.inputValue || node.text || "", 200)
      : sanitizeImportText(node.text || "", 200);
  const buttonBg = base.fillEnabled ? base.fill : undefined;
  const rawLabelColor =
    kind === "input"
      ? node.typography?.color ?? "#6b7280"
      : node.typography?.color ?? "#ffffff";
  const labelColor =
    kind === "button"
      ? ensureReadableTextColor(rawLabelColor, buttonBg) ?? rawLabelColor
      : rawLabelColor;

  const textChild: ImportWebSceneNode = {
    id: nextId("web"),
    type: "text",
    name: kind === "input" ? "Placeholder" : "Label",
    x: padL,
    y: kind === "button" ? Math.max(padT, (base.height - 20) / 2) : padT,
    width: Math.max(40, base.width - padL - padR),
    height: 20,
    content: label,
    fontFamily: node.typography?.fontFamily ?? "Inter",
    fontSize: node.typography?.fontSize ?? (kind === "input" ? 14 : 15),
    fontWeight: node.typography?.fontWeight ?? (kind === "button" ? 600 : 400),
    textAlign: kind === "button" ? "center" : "left",
    fill: labelColor,
    fillEnabled: true,
    layoutPositioning: "absolute",
  };

  const existingKids = base.children ?? [];
  const visualKids = existingKids.filter(
    (c) => c.type !== "text" || (c.content && c.content.trim().toLowerCase() !== label.trim().toLowerCase()),
  );
  const hasLabelChild = existingKids.some((c) => c.type === "text" && c.content?.trim());
  let children: ImportWebSceneNode[];
  if (kind === "button" && visualKids.length > 0) {
    children = hasLabelChild || !label ? visualKids : [...visualKids, textChild];
  } else if (kind === "input" && visualKids.length > 0) {
    children = hasLabelChild ? visualKids : label ? [textChild, ...visualKids] : visualKids;
  } else {
    children = label ? [textChild, ...visualKids] : visualKids;
  }

  const useCapturedLayout = kind === "input" && visualKids.length > 0 && hasLabelChild;

  return {
    ...base,
    type: "frame",
    name: node.name || (kind === "input" ? "Input" : "Button"),
    layoutMode: "none",
    paddingTop: useCapturedLayout ? 0 : padT,
    paddingRight: useCapturedLayout ? 0 : padR,
    paddingBottom: useCapturedLayout ? 0 : padB,
    paddingLeft: useCapturedLayout ? 0 : padL,
    strokeEnabled: base.strokeEnabled ?? Boolean((base.strokeWidth ?? 0) > 0 && base.strokeColor),
    children,
  };
}

function buildBackgroundImageLayer(
  node: DesignNode,
  assets: AssetMap,
  width: number,
  height: number,
): ImportWebSceneNode {
  const src = node.backgroundImageSrc!;
  const aid = nextId("asset");
  assets[aid] = {
    id: aid,
    dataUrl: src,
    name: "Background image",
    mimeType: "image/png",
  };
  return {
    id: nextId("web"),
    type: "image",
    name: "Background",
    x: 0,
    y: 0,
    width,
    height,
    assetId: aid,
    imageSrc: src,
    imageFitMode: mapBackgroundSizeToFit(node.backgroundSize),
    layoutPositioning: "absolute",
    layoutSizingHorizontal: "fill",
    layoutSizingVertical: "fill",
  };
}

function nodeKind(node: DesignNode): ImportWebSceneNode["type"] {
  const tag = node.tagName.toLowerCase();
  if (INPUT_TAGS.has(tag) || node.role === "input" || node.role === "dropdown") {
    return "frame";
  }
  if (node.role === "button") return "frame";
  if ((tag === "img" || node.role === "image" || node.role === "avatar") && node.imageSrc) {
    return "image";
  }
  if (
    node.backgroundImageSrc &&
    node.children.length === 0 &&
    !node.text &&
    ["div", "section", "span"].includes(tag)
  ) {
    return "image";
  }
  if (
    node.imageSrc &&
    node.children.length === 0 &&
    !node.text &&
    ["div", "section", "span"].includes(tag)
  ) {
    return "image";
  }
  if (
    (node.role === "text" ||
      (node.text &&
        tag !== "svg" &&
        !INPUT_TAGS.has(tag) &&
        (isSemanticTextTag(tag) || tag === "button" || tag === "a") &&
        isImportableTextContent(node.text, {
          className: node.codeClassName,
          tagName: tag,
          role: node.role,
        }))) &&
    node.children.length === 0
  ) {
    return "text";
  }
  if (node.svgMarkup) return "frame";
  if (["section", "main", "article", "header", "footer", "nav", "form", "div"].includes(tag)) {
    return node.children.length > 0 ? "frame" : node.style.fillEnabled ? "rectangle" : "frame";
  }
  if (node.children.length > 0) return "frame";
  return "rectangle";
}

function buildSvgSceneNode(
  node: DesignNode,
  assets: AssetMap,
  base: ImportWebSceneNode,
): ImportWebSceneNode {
  const result = convertSvgTree(node.svgMarkup!, node.name || "SVG");
  if (!result) {
    return { ...base, type: "rectangle", name: node.name || "SVG" };
  }

  Object.assign(assets, Object.fromEntries(
    Object.entries(result.assets).map(([id, a]) => [
      id,
      { id, dataUrl: a.dataUrl, name: a.name, mimeType: a.mimeType },
    ]),
  ));

  const root = result.nodes[result.rootId];
  if (!root) return { ...base, type: "frame", name: "SVG" };

  const vbMatch = node.svgMarkup?.match(/viewBox=["']([^"']+)["']/i);
  const vbParts = vbMatch?.[1]?.trim().split(/\s+/).map(Number) ?? [];
  const vbW = vbParts[2] && vbParts[2] > 0 ? vbParts[2] : root.width;
  const vbH = vbParts[3] && vbParts[3] > 0 ? vbParts[3] : root.height;
  const scaleX = base.width > 0 && vbW > 0 ? base.width / vbW : 1;
  const scaleY = base.height > 0 && vbH > 0 ? base.height / vbH : 1;

  const children: ImportWebSceneNode[] = [];
  for (const cid of result.childOrder[result.rootId] ?? []) {
    const n = result.nodes[cid];
    if (!n) continue;
    const scene = editorNodeToScene(n, result.nodes, result.childOrder, assets);
    children.push(scaleSceneNode(scene, scaleX, scaleY));
  }

  return sanitizeSvgGroupFills({
    ...base,
    type: "frame",
    name: node.name || "SVG",
    children,
    clipChildren: true,
    layoutMode: "none",
    primaryAxisAlign: "center",
    counterAxisAlign: "center",
  });
}

/** SVG <g> nodes inherit default black fill — disable so child paths stay visible. */
function sanitizeSvgGroupFills(node: ImportWebSceneNode): ImportWebSceneNode {
  const children = node.children?.map(sanitizeSvgGroupFills);
  const isOpaqueBlackGroup =
    node.type === "group" &&
    node.fillEnabled &&
    (node.fill?.toLowerCase() === "#000000" || node.fill?.toLowerCase() === "#000") &&
    (children?.length ?? 0) > 0;
  if (isOpaqueBlackGroup) {
    return { ...node, fillEnabled: false, fill: undefined, children };
  }
  return children ? { ...node, children } : node;
}

function scaleSceneNode(
  node: ImportWebSceneNode,
  scaleX: number,
  scaleY: number,
): ImportWebSceneNode {
  const scaled: ImportWebSceneNode = {
    ...node,
    x: node.x * scaleX,
    y: node.y * scaleY,
    width: node.width * scaleX,
    height: node.height * scaleY,
    children: node.children?.map((c) => scaleSceneNode(c, scaleX, scaleY)),
  };
  if (node.pathPoints?.length) {
    scaled.pathPoints = node.pathPoints.map((p) => ({
      ...p,
      x: p.x * scaleX,
      y: p.y * scaleY,
    }));
  }
  if (node.fontSize) scaled.fontSize = node.fontSize * Math.min(scaleX, scaleY);
  return scaled;
}

function editorNodeToScene(
  node: import("@/stores/useEditorStore").EditorNode,
  nodes: Record<string, import("@/stores/useEditorStore").EditorNode>,
  childOrder: Record<string, string[]>,
  assets: AssetMap,
): ImportWebSceneNode {
  const scene: ImportWebSceneNode = {
    id: nextId("web"),
    type: node.type === "ellipse" ? "rectangle" : node.type,
    name: node.name,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    rotation: node.rotation ?? 0,
    visible: node.visible !== false,
    fill: node.fill,
    fillEnabled: node.fillEnabled,
    fillOpacity: node.fillOpacity,
    fillType: node.fillType,
    fillGradient: node.fillGradient,
    strokeColor: node.strokeColor,
    strokeWidth: node.strokeWidth,
    strokeEnabled: node.strokeEnabled,
    cornerRadius: node.cornerRadius,
    cornerRadii: node.cornerRadii,
    opacity: node.opacity,
    effects: node.effects,
    content: node.content,
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    pathPoints: node.pathPoints,
    pathClosed: node.pathClosed,
    assetId: node.assetId,
    imageSrc: node.imageSrc,
  };
  if (node.assetId && node.imageSrc && !assets[node.assetId]) {
    assets[node.assetId] = {
      id: node.assetId,
      dataUrl: node.imageSrc,
      name: node.name,
      mimeType: "image/png",
    };
  }
  const kids = (childOrder[node.id] ?? []).map((cid) =>
    editorNodeToScene(nodes[cid]!, nodes, childOrder, assets),
  );
  if (kids.length) scene.children = kids;
  return scene;
}

function cloneSceneNode(
  master: ImportWebSceneNode,
  instance: DesignNode,
): ImportWebSceneNode {
  const idMap = new Map<string, string>();
  const clone = (n: ImportWebSceneNode, isRoot: boolean): ImportWebSceneNode => {
    const newId = nextId("web");
    idMap.set(n.id, newId);
    const cloned: ImportWebSceneNode = {
      ...n,
      id: newId,
      children: n.children?.map((c) => clone(c, false)),
    };
    if (isRoot) {
      cloned.x = instance.bounds.x;
      cloned.y = instance.bounds.y;
      cloned.width = instance.bounds.width;
      cloned.height = instance.bounds.height;
      cloned.sourceComponentId = instance.sourceComponentId;
      cloned.isComponent = undefined;
      cloned.componentId = undefined;
      cloned.name = instance.name;
    }
    return cloned;
  };
  return clone(master, true);
}

export function designTreeToScene(
  root: DesignNode,
  page: ImportWebPageMeta,
): { scene: ImportWebSceneNode; assets: AssetMap } {
  idSeq = 0;
  const assets: AssetMap = {};
  const masters: MasterMap = new Map();

  const builtChildren: ImportWebSceneNode[] = [];
  for (const child of root.children) {
    const scene = buildFromDesign(child, assets, masters);
    if (scene) builtChildren.push(scene);
  }

  const rootLayout = inferSceneRootLayout(builtChildren);
  const scene: ImportWebSceneNode = {
    id: nextId("web-root"),
    type: "frame",
    name: page.title || "Imported page",
    x: 0,
    y: 0,
    width: page.width,
    height: page.height,
    fillEnabled: false,
    clipChildren: true,
    layoutMode: rootLayout.mode,
    layoutGap: rootLayout.gap,
    children: builtChildren,
  };

  return { scene, assets };
}

function inferSceneRootLayout(
  children: ImportWebSceneNode[],
): { mode: ImportWebSceneNode["layoutMode"]; gap: number } {
  if (children.length < 2) return { mode: "vertical", gap: 0 };
  const xs = children.map((c) => c.x);
  const ys = children.map((c) => c.y);
  const xSpread = Math.max(...xs) - Math.min(...xs);
  const ySpread = Math.max(...ys) - Math.min(...ys);
  if (xSpread > ySpread && xSpread > 40) {
    let gap = 0;
    const sorted = [...children].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const cur = sorted[i]!;
      gap = Math.max(gap, cur.x - (prev.x + prev.width));
    }
    return { mode: "horizontal", gap: Math.max(0, Math.round(gap)) };
  }
  return { mode: "vertical", gap: 0 };
}
