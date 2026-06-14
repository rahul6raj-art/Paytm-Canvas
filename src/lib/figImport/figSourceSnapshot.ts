import type { FigDocument, FigNode, FigPaint } from "openfig-core";
import { nodeId } from "openfig-core";
import type { EditorNode } from "@/stores/useEditorStore";
import type { ImportCtx } from "@/lib/figImport/figImportTypes";
import type { FigmaComparableSnapshot } from "@/lib/figImport/figFidelityTypes";
import { placementFromFigNode } from "@/lib/figImport/figNodeGeometry";
import {
  effectiveNodeFillPaints,
  fillTokenIdForPaints,
  gradientFillFromPaints,
  resolvePaintList,
  solidFillFromPaints,
  strokesFromFigNode,
  effectsFromFigNode,
  blendModeFromFigNode,
} from "@/lib/figImport/figImportProperties";
import { serializeGradient, serializeEffects } from "@/lib/figImport/figFidelitySerialize";

const SKIP_TYPES = new Set([
  "CANVAS", "SLICE", "WIDGET", "CODE_BLOCK", "CONNECTOR", "STICKY", "SHAPE_WITH_TEXT",
]);

function mapConstraint(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.toLowerCase();
}

function detectUnsupported(source: FigNode, rawFills: FigPaint[] | undefined): string[] {
  const out: string[] = [];
  const stackMode = (source as { stackMode?: string }).stackMode;
  if (stackMode === "GRID") out.push("grid-auto-layout");
  if (SKIP_TYPES.has(source.type)) out.push(`skipped-type:${source.type}`);
  for (const paint of rawFills ?? []) {
    const t = (paint as { type?: number }).type;
    if (t === 6) out.push("emoji-fill");
    if (t === 7) out.push("video-fill");
  }
  if ((rawFills?.length ?? 0) > 1) out.push("multi-fill-stack");
  return out;
}

/** Build comparable snapshot from raw Figma node (source of truth). */
export function snapshotFromFigNode(
  source: FigNode,
  _doc: FigDocument,
  ctx: ImportCtx,
): FigmaComparableSnapshot | null {
  const figKey = nodeId(source);
  if (!figKey) return null;

  const placement = placementFromFigNode(source);
  const rawFills = effectiveNodeFillPaints(source);
  const resolvedFills = resolvePaintList(rawFills, ctx.variableColors);
  const solid = solidFillFromPaints(resolvedFills);
  const gradient = gradientFillFromPaints(resolvedFills, placement.width, placement.height);
  const fillTokenId = fillTokenIdForPaints(rawFills, ctx.tokensByVariableKey);
  const strokes = strokesFromFigNode(source, ctx.variableColors);
  const effects = effectsFromFigNode(source, ctx.variableColors);
  const blend = blendModeFromFigNode(source);

  const ext = source as FigNode & {
    horizontalConstraint?: string;
    verticalConstraint?: string;
    rectangleCornerRadii?: number[];
    stackMode?: string;
    stackSpacing?: number;
    stackVerticalPadding?: number;
    stackHorizontalPadding?: number;
    stackPaddingBottom?: number;
    stackPaddingRight?: number;
    stackPrimaryAlignItems?: string;
    stackCounterAlignItems?: string;
    stackPrimarySizing?: string;
    stackCounterSizing?: string;
    stackWrap?: boolean;
    stackPositioning?: string;
    stackChildPrimaryGrow?: number;
    stackChildAlignSelf?: string;
  };

  let layoutMode = "none";
  if (ext.stackMode === "HORIZONTAL") layoutMode = "horizontal";
  else if (ext.stackMode === "VERTICAL") layoutMode = "vertical";

  const snap: FigmaComparableSnapshot = {
    figKey,
    figType: source.type,
    nodeType: source.type.toLowerCase(),
    name: (source.name ?? "").trim() || source.type,
    x: round(placement.x),
    y: round(placement.y),
    width: round(placement.width),
    height: round(placement.height),
    rotation: placement.rotation,
    flipHorizontal: placement.flipHorizontal,
    flipVertical: placement.flipVertical,
    opacity: source.opacity,
    visible: (source as { visible?: boolean }).visible !== false,
    fill: solid.fill,
    fillOpacity: solid.fillOpacity,
    fillEnabled: Boolean(solid.fill || gradient.fillType),
    fillType: gradient.fillType,
    fillGradient: gradient.fillGradient ? serializeGradient(gradient.fillGradient) : undefined,
    fillTokenId,
    strokeColor: strokes.strokeColor,
    strokeWidth: strokes.strokeWidth,
    strokeOpacity: strokes.strokeOpacity,
    strokeEnabled: strokes.strokeEnabled,
    cornerRadius: source.cornerRadius,
    cornerRadii: ext.rectangleCornerRadii,
    effects: effects?.length ? serializeEffects(effects) : undefined,
    blendMode: blend.blendMode,
    layoutMode,
    layoutGap: ext.stackSpacing,
    paddingTop: ext.stackVerticalPadding,
    paddingRight: ext.stackPaddingRight ?? ext.stackHorizontalPadding,
    paddingBottom: ext.stackPaddingBottom ?? ext.stackVerticalPadding,
    paddingLeft: ext.stackHorizontalPadding,
    primaryAxisAlign: ext.stackPrimaryAlignItems?.toLowerCase(),
    counterAxisAlign: ext.stackCounterAlignItems?.toLowerCase(),
    layoutSizingHorizontal: mapSizing(ext.stackPrimarySizing),
    layoutSizingVertical: mapSizing(ext.stackCounterSizing),
    layoutPositioning: ext.stackPositioning?.toUpperCase() === "ABSOLUTE" ? "absolute" : "auto",
    layoutWrap: ext.stackWrap,
    layoutGrow: ext.stackChildPrimaryGrow,
    constraintsHorizontal: mapConstraint(ext.horizontalConstraint),
    constraintsVertical: mapConstraint(ext.verticalConstraint),
    clipChildren: (source as { clipContent?: boolean }).clipContent,
    isMask: (source as { isMask?: boolean }).isMask,
    booleanOperation: (source as { booleanOperation?: string }).booleanOperation?.toLowerCase(),
    unsupported: detectUnsupported(source, rawFills),
  };

  if (source.type === "TEXT") {
    Object.assign(snap, extractFigTextSnapshot(source, ctx));
  }

  if (source.type === "INSTANCE") {
    const sym = (source as { symbolData?: { symbolID?: { sessionID?: number; localID?: number } } })
      .symbolData?.symbolID;
    if (sym) snap.sourceComponentId = `${sym.sessionID}:${sym.localID}`;
  }

  if (source.type === "COMPONENT" || source.type === "SYMBOL") {
    snap.isComponent = true;
  }

  return snap;
}

function extractFigTextSnapshot(
  source: FigNode,
  ctx: ImportCtx,
): Partial<FigmaComparableSnapshot> {
  const text =
    (source.textData as { characters?: string } | undefined)?.characters
    ?? (source as { characters?: string }).characters
    ?? "";
  const styleKey = (source as { textStyleID?: number }).textStyleID;
  const tokenId = styleKey != null ? ctx.styleKeyToTokenId?.get(String(styleKey)) : undefined;
  const ext = source as FigNode & {
    fontSize?: number;
    fontName?: { family?: string; style?: string };
    textAlignHorizontal?: string;
  };
  return {
    content: text.slice(0, 2000),
    fontFamily: ext.fontName?.family,
    fontSize: ext.fontSize,
    fontWeight: ext.fontName?.style?.toLowerCase().includes("bold") ? 700 : 400,
    textAlign: ext.textAlignHorizontal?.toLowerCase(),
    textStyleTokenId: tokenId,
  };
}

function mapSizing(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.toUpperCase();
  if (v === "RESIZE_TO_FIT" || v === "AUTO" || v === "HUG") return "hug";
  if (v === "FILL" || v === "STRETCH") return "fill";
  if (v === "FIXED") return "fixed";
  return raw.toLowerCase();
}

/** Build comparable snapshot from editor canvas node. */
export function snapshotFromEditorNode(node: EditorNode): FigmaComparableSnapshot {
  return {
    figKey: node.id.startsWith("fig-") ? node.id.replace(/^fig-/, "").replace(/-/g, ":") : undefined,
    nodeType: node.type,
    name: node.name,
    x: round(node.x),
    y: round(node.y),
    width: round(node.width),
    height: round(node.height),
    rotation: node.rotation,
    flipHorizontal: node.flipHorizontal,
    flipVertical: node.flipVertical,
    opacity: node.opacity,
    visible: node.visible,
    fill: node.fill,
    fillOpacity: node.fillOpacity,
    fillEnabled: node.fillEnabled,
    fillType: node.fillType,
    fillGradient: node.fillGradient ? serializeGradient(node.fillGradient) : undefined,
    fillTokenId: node.fillTokenId,
    strokeColor: node.strokeColor,
    strokeWidth: node.strokeWidth,
    strokeOpacity: node.strokeOpacity,
    strokeEnabled: node.strokeEnabled,
    cornerRadius: node.cornerRadius,
    cornerRadii: node.cornerRadii,
    effects: node.effects?.length ? serializeEffects(node.effects) : undefined,
    blendMode: node.blendMode,
    content: node.content,
    fontFamily: node.fontFamily,
    fontSize: node.fontSize,
    fontWeight: node.fontWeight,
    lineHeight: node.lineHeight,
    letterSpacing: node.letterSpacing,
    textAlign: node.textAlign,
    verticalAlign: node.verticalAlign,
    textStyleTokenId: node.textStyleTokenId,
    layoutMode: node.layoutMode ?? "none",
    layoutGap: node.layoutGap,
    paddingTop: node.paddingTop,
    paddingRight: node.paddingRight,
    paddingBottom: node.paddingBottom,
    paddingLeft: node.paddingLeft,
    primaryAxisAlign: node.primaryAxisAlign,
    counterAxisAlign: node.counterAxisAlign,
    layoutSizingHorizontal: node.layoutSizingHorizontal,
    layoutSizingVertical: node.layoutSizingVertical,
    layoutPositioning: node.layoutPositioning,
    layoutWrap: node.layoutWrap,
    layoutGrow: node.layoutGrow,
    constraintsHorizontal: node.constraintsHorizontal,
    constraintsVertical: node.constraintsVertical,
    isComponent: node.isComponent,
    componentId: node.componentId,
    sourceComponentId: node.sourceComponentId,
    clipChildren: node.clipChildren,
    isMask: node.isMask,
    booleanOperation: node.booleanOperation,
  };
}

function round(n: number | undefined): number {
  if (n == null || !Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
