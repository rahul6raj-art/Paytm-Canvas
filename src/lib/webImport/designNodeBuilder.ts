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

function isTextDomNode(node: DomSnapshotNode): boolean {
  const tag = node.tagName.toLowerCase();
  if (INPUT_TAGS.has(tag) || tag === "button" || tag === "img" || tag === "svg") return false;
  if (!TEXT_TAGS.has(tag)) return false;
  if (!isImportableTextContent(node.text, {
    className: node.className,
    tagName: tag,
    role: node.role,
  })) {
    return false;
  }
  if (node.children.length === 0) return true;
  return node.children.every((c) => {
    const ct = c.tagName.toLowerCase();
    return ["span", "strong", "em", "small", "br", "svg"].includes(ct);
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
      (role === "button" || role === "input" ? extractTypography(node.styles) : undefined);

    const designNode: DesignNode = {
      id: node.id,
      domId: node.id,
      tagName: node.tagName,
      name: semanticDisplayName(role, node),
      role,
      bounds,
      layout,
      style,
      typography: isText || role === "button" ? resolvedTypography : undefined,
      // Buttons are not text nodes, but their label must survive so control
      // frames can render it. Inputs use placeholder/value instead.
      text: isText || role === "button" ? node.text : undefined,
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
      children: isText ? [] : node.children.map((c) => build(c, node, depth + 1)),
    };

    if (node.pseudoElements?.length) {
      for (const pseudo of node.pseudoElements) {
        designNode.children.push(buildPseudoNode(pseudo, node, designNode));
      }
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
