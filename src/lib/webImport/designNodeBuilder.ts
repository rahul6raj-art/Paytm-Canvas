import type { DesignNode, DomSnapshotNode } from "@/lib/webImport/types";
import { childBoundsRelativeToParent, analyzeLayout } from "@/lib/webImport/layoutAnalyzer";
import { mergeNodeStyle, extractPseudoStyle, extractTypography } from "@/lib/webImport/styleExtractor";
import { parseColor, parsePx } from "@/lib/webImport/cssParseUtils";
import { detectSemanticRole, semanticDisplayName } from "@/lib/webImport/semanticAnalyzer";
import { isImportableTextContent } from "@/lib/webImport/textContentHeuristics";
import { overflowImpliesClip } from "@/lib/webImport/overflowClip";

const INPUT_TAGS = new Set(["input", "textarea", "select"]);
const TEXT_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "a", "li", "button"]);
const INTRINSIC_TAGS = new Set([
  "div", "span", "p", "a", "button", "img", "section", "main", "article",
  "header", "footer", "nav", "form", "ul", "ol", "li", "h1", "h2", "h3",
  "h4", "h5", "h6", "label", "input", "textarea", "select",
]);

function codeFields(node: DomSnapshotNode): Pick<DesignNode, "codeClassName" | "codeJsxTag" | "codeJsxIntrinsic"> {
  const tag = node.tagName.toLowerCase();
  const intrinsic = INTRINSIC_TAGS.has(tag);
  return {
    codeClassName: node.className,
    codeJsxTag: intrinsic ? tag : undefined,
    codeJsxIntrinsic: intrinsic ? true : undefined,
  };
}

/** Checkbox/radio labels carry indicator + copy — must stay frames, not flat text. */
function isCompositeFormLabel(node: DomSnapshotNode): boolean {
  const tag = node.tagName.toLowerCase();
  const cls = (node.className ?? "").toLowerCase();
  if (/\b(checkbox|radio|switch|toggle)\b/.test(cls)) return true;
  if (tag !== "label") return false;
  return node.children.some((c) => {
    const ccls = (c.className ?? "").toLowerCase();
    return ccls.includes("__indicator") || ccls.includes("__input");
  });
}

function isTextOnlyLeaf(node: DomSnapshotNode): boolean {
  if (node.children.length > 0) return false;
  if (node.svgMarkup) return false;
  const tag = node.tagName.toLowerCase();
  if (INPUT_TAGS.has(tag) || tag === "button" || tag === "img" || tag === "svg") return false;
  if (isCompositeFormLabel(node)) return false;
  const cls = (node.className ?? "").toLowerCase();
  if (cls.includes("badge") || cls.includes("chip") || cls.includes("tag")) return false;
  if (/\bhero__zero\b/.test(cls)) return false;
  if (node.rect.height > 72 || node.rect.width > 160) return false;
  return isImportableTextContent(node.text, {
    className: node.className,
    tagName: tag,
    role: node.role,
  });
}

function isTextDomNode(node: DomSnapshotNode): boolean {
  if (isTextOnlyLeaf(node)) return true;
  const tag = node.tagName.toLowerCase();
  const cls = (node.className ?? "").toLowerCase();
  if (INPUT_TAGS.has(tag) || tag === "button" || tag === "img" || tag === "svg") return false;
  if (isCompositeFormLabel(node)) return false;
  if (cls.includes("badge") || cls.includes("chip") || cls.includes("tag")) return false;
  if (!TEXT_TAGS.has(tag)) return false;
  if (!isImportableTextContent(node.text, {
    className: node.className,
    tagName: tag,
    role: node.role,
  })) {
    return false;
  }
  if (node.children.length === 0) return true;
  // Keep icon+text composites (e.g. assurance row, badges) as frames so the icon and
  // its centered/laid-out text survive — flattening drops the icon and the alignment.
  return node.children.every((c) => {
    const ct = c.tagName.toLowerCase();
    if (["span", "strong", "em", "small", "br"].includes(ct)) return true;
    if (ct === "a") {
      const role = (c.role ?? "").toLowerCase();
      if (role === "button") return false;
      const ccls = (c.className ?? "").toLowerCase();
      if (/\b(btn|button)\b/.test(ccls)) return false;
      return true;
    }
    return false;
  });
}

export function buildDesignTree(root: DomSnapshotNode): DesignNode {
  const build = (node: DomSnapshotNode, parent?: DomSnapshotNode, depth = 0): DesignNode => {
    const layout = analyzeLayout(node, parent);
    const bounds = parent
      ? childBoundsRelativeToParent(node, parent, parent ? analyzeLayout(parent) : layout)
      : {
          x: Math.max(0, Math.round(node.rect.x)),
          y: Math.max(0, Math.round(node.rect.y)),
          width: Math.max(1, Math.round(node.rect.width)),
          height: Math.max(1, Math.round(node.rect.height)),
        };

    const role = detectSemanticRole(node, depth);
    const isText = isTextDomNode(node);
    const { style: mergedStyle, typography } = mergeNodeStyle(node, isText);
    let style = mergedStyle;
    style = normalizeBorderTopDivider(node, style);
    if (node.tagName.toLowerCase() === "a" && role === "button") {
      const bg = parseColor(node.styles.backgroundColor);
      if (bg) {
        style = { ...style, fill: bg, fillEnabled: true, fillType: "solid" };
      }
    }
    if (
      !style.fillEnabled &&
      depth <= 2 &&
      node.rect.width >= 400 &&
      node.rect.height >= 400 &&
      ["div", "section", "main", "article"].includes(node.tagName.toLowerCase())
    ) {
      style = { ...style, fill: "#ffffff", fillEnabled: true, fillType: "solid" };
    }
    const resolvedTypography =
      typography ??
      (role === "button" || role === "input" || role === "badge"
        ? extractTypography(node.styles)
        : undefined);
    const carriesLabelText = isText || role === "button" || role === "badge";

    const contentChildren = isText ? [] : node.children.map((c) => build(c, node, depth + 1));

    const designNode: DesignNode = {
      id: node.id,
      domId: node.id,
      tagName: node.tagName,
      name: semanticDisplayName(role, node),
      role,
      bounds,
      layout,
      style,
      typography: carriesLabelText ? resolvedTypography : undefined,
      cssLayoutHints: isText
        ? {
            width: node.styles.width,
            maxWidth: node.styles.maxWidth,
            whiteSpace: node.styles.whiteSpace,
          }
        : undefined,
      // Buttons/badges are frames, but their label copy must survive for control/chip frames.
      text: carriesLabelText ? node.text : undefined,
      href: node.href,
      imageSrc: node.src,
      backgroundImageSrc: node.backgroundImageSrc,
      backgroundSize: node.styles.backgroundSize,
      overflowHidden: overflowImpliesClip(node.styles.overflow),
      svgMarkup: node.svgMarkup,
      placeholder: node.placeholder,
      inputValue: node.inputValue,
      ariaLabel: node.ariaLabel,
      ...codeFields(node),
      browserTextLayout: carriesLabelText ? node.browserTextLayout : undefined,
      children: contentChildren,
    };

    if (!isText && node.pseudoElements?.length) {
      const before = node.pseudoElements
        .filter((p) => p.kind === "before")
        .map((p) => buildPseudoNode(p, node, designNode));
      const after = node.pseudoElements
        .filter((p) => p.kind === "after")
        .map((p) => buildPseudoNode(p, node, designNode));
      designNode.children = [...before, ...contentChildren, ...after];
    }

    return designNode;
  };

  return build(root);
}

function buildPseudoNode(
  pseudo: import("@/lib/webImport/types").DomPseudoElement,
  parent: DomSnapshotNode,
  parentDesign: DesignNode,
): DesignNode {
  return {
    id: `${parent.id}-${pseudo.kind}`,
    domId: parent.id,
    tagName: `pseudo-${pseudo.kind}`,
    name: `::${pseudo.kind}`,
    role: undefined,
    bounds: {
      x: 0,
      y: 0,
      width: parentDesign.bounds.width,
      height: parentDesign.bounds.height,
    },
    layout: { kind: "absolute", layoutPositioning: "absolute" },
    style: extractPseudoStyle(pseudo),
    text: pseudo.text,
    children: [],
  };
}

/** Tailwind `border-t` dividers are 1px lines — render as filled rects, not frame strokes. */
function normalizeBorderTopDivider(
  node: DomSnapshotNode,
  style: import("@/lib/webImport/types").ExtractedVisualStyle,
): import("@/lib/webImport/types").ExtractedVisualStyle {
  const topW = parsePx(node.styles.borderTopWidth);
  if (!topW || topW < 1) return style;
  if (node.rect.height > 4) return style;
  const lineColor = parseColor(node.styles.borderTopColor);
  if (!lineColor) return style;
  return {
    ...style,
    fill: lineColor,
    fillEnabled: true,
    fillType: "solid",
    strokeEnabled: false,
    strokeWidth: undefined,
    strokeColor: undefined,
  };
}
