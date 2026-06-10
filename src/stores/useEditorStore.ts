import { create } from "zustand";
import {
  centeredLocalPointInParent,
  clampInsertLocalPoint,
  frameParentAtWorldPoint,
  insertNodeWithFrameParenting,
  pickDeepestFrameAtWorldPoint,
  resolveFrameParentForShapeInsert,
  pickDeepestVisibleNodeAtWorldPoint,
  targetFrameForInsert,
  worldCenteredRootPoint,
  worldPointToParentLocal,
  worldRect,
} from "@/lib/tree";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import { clampCanvasZoom, DEFAULT_CANVAS_ZOOM, viewportForRootNodes } from "@/lib/canvasZoom";
import { deferFigImportSave, waitForNextPaint } from "@/lib/figImport/figImportRuntime";
import { fitCanvasToImportedDocument } from "@/lib/viewportZoom";
import { normalizeHex } from "@/lib/color";
import type { StrokeSpec } from "@/lib/strokeSpec";
import { mergeStrokeIntoNode } from "@/lib/strokeSpec";
import { canvasChromeForeground } from "@/lib/canvasForeground";
import {
  createEmptyDocumentFields,
  isWorkspaceEmpty,
  mergeSampleDocumentFields,
  readInitialDocumentFields,
} from "@/lib/editorBootstrap";
import {
  applyLayoutPatchWithAutoLayout,
  computeAutoLayout,
  computeAutoLayoutPatches,
  constraintResizeChildPatches,
  layoutSizingPatchesForManualResize,
  markLayoutDirty,
  relayoutDirtyTree,
  type ConstraintHorizontal,
  type ConstraintVertical,
  type ConstraintsPatch,
  type CrossAxisAlign,
  type LayoutMode,
  type LayoutNode,
  type LayoutPatch,
  type LayoutPositioning,
  type PrimaryAxisAlign,
} from "@/lib/autoLayout";
import {
  applyAutoLayoutToContainer,
  applyAutoLayoutToSelection,
  applyWrapSelectionInFrame,
  canAddAutoLayoutToSelection,
} from "@/lib/autoLayoutSelection";
import { freezeAutoLayoutGapBeforeChildInsert } from "@/lib/layoutEngine/inferGap";
import {
  computeAutoLayoutArrowReorderIndex,
  getAutoLayoutArrowReorderContext,
  swapAutoLayoutSiblingOrder,
} from "@/lib/autoLayoutArrowReorder";
import {
  computeResizedBounds,
  isProportionalResize,
  RESIZE_MIN_DIMENSION,
  type Bounds,
  type ResizeHandle,
  type ResizeKind,
  type ResizeModifiers,
} from "@/lib/resize";
import { clearPostCreationPointerSuppress } from "@/lib/canvasCreationGuard";
import { isCanvasBgCreationTool } from "@/lib/canvasInteractionGuards";
import { warnInvalidNodeGeometry } from "@/lib/canvasGeometryDev";
import type { CornerRadii } from "@/lib/cornerRadius";
import {
  canEnterParametricShapeEdit,
  shouldEnterPathEditOnEdit,
} from "@/lib/editMode/shapeEditGate";
import {
  alignNodesInDocument,
  alignableSelectionIds,
  distributeNodesInDocument,
  relayoutParentKeysAfterManualPosition,
} from "@/lib/alignSelection";
import {
  clampStrokeWidth,
  DEFAULT_PENCIL_STROKE_WIDTH,
  nodeSupportsStrokeWidth,
} from "@/lib/strokeAdjust";
import {
  clonedNodePosition,
  parentUsesAutoLayout,
  collectSubtreeIds,
  dedupeChildOrderLists,
  getRenderedWorldTopLeft,
  insertNodeInChildOrder,
  buildParentMapFromChildOrder,
  syncParentIdsFromChildOrder,
  worldPointToParentLocalFromChildOrder,
  isAncestorOf,
  nextFrameName,
  repairNodeHierarchy,
  repairNodeHierarchyIfNeeded,
  syncGroupFrameToVisible,
  boundsForMaskAndContent,
  topLevelSelectedIds,
} from "@/lib/editorGraph";
import {
  cloneEditorSubtree,
  detachInstanceTree,
  findInstanceRoot,
  mergeInstanceOverrides,
  newComponentId,
  newVariantGroupId,
  resolveMasterRootId,
  stripComponentFields,
  canCreateComponentFromSelection,
  groupNodesForComponent,
  wrapNodeInFrameForComponent,
  markNodeAsComponent,
  type InstanceOverridePatch,
} from "@/lib/componentModel";
import {
  defaultPrototypeLink,
  findPrototypeLinkOwner,
  newPrototypeLinkId,
  type PrototypeLink,
} from "@/lib/prototype";
import type { EditorAsset, EditorPersistSlice, PaytmCraftDocument } from "@/lib/documentPersistence";
import type { DesignToken, DetachableTokenKind, EffectTokenValue } from "@/lib/designTokens";
import {
  newDesignTokenId,
  designTokenTimestamp,
  resolveNodeWithDesignTokens,
  isColorValue,
  isTypographyValue,
  isSpacingValue,
  isEffectValue,
} from "@/lib/designTokens";
import {
  defaultNodeEffect,
  mergeNodeEffectPatch,
  newNodeEffectId,
  type NodeEffectType,
} from "@/lib/nodeEffects";
import { effectiveFillType, normalizeFillGradient } from "@/lib/fillGradient";
import { buildPaletteTokens, createColorDesignToken, DEFAULT_COLOR_PALETTE } from "@/lib/designSystemPresets";
import {
  buildResizeContentPatches,
  scaleSubtreeContentPatches,
  shouldProportionalFrameScale,
} from "@/lib/resizeContent";
import { convertFigFileAsync, isFigmaFigFile } from "@/lib/figImport";
import {
  abortFigImport,
  beginFigImport,
  isFigImportCancelled,
} from "@/lib/figImport/figImportSession";
import { importFigmaFromApi } from "@/lib/figmaApi/importFigmaApi";
import { fetchFigmaServerConfig } from "@/lib/figmaApi/figmaServerConfig";
import { readFigmaAccessToken } from "@/lib/figmaImportConnection";
import { isFigmaDesignUrl, parseFigmaFileKey, parseFigmaUrl } from "@/integrations/figma/parse-figma-url";
import { startTransition } from "react";
import {
  computeTextBoxSize,
  patchAffectsTextLayout,
  textLayoutPatchForNode,
  withTextLayoutPatch,
} from "@/lib/text/textLayout";
import { createPointTextAt, createTextBoxFromDrag } from "@/lib/text/textCreation";
import { EMPTY_TEXT_PLACEHOLDER_WIDTH, MIN_TEXT_BOX, textResizePatch } from "@/lib/text/textNodeModel";
import {
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_FONT_SIZE,
  resolveTextTypo,
} from "@/lib/textTypography";
import { createShapeNode } from "@/lib/shapes/shapeCreation";
import {
  duplicatedTextLayerName,
  layerNameFromTextContent,
  nextDuplicatedLayerName,
  nextNumberedLayerName,
} from "@/lib/layerNaming";
import {
  lineEndpointsPatchFromLayout,
  linePatchFromEndpoints,
  lineEndpointsFromNode,
} from "@/lib/shapes/lineGeometry";
import { polygonGeometryPatch } from "@/lib/shapes/polygonGeometry";
import {
  DEFAULT_FRAME_FILL,
  DEFAULT_SHAPE_FILL,
  DEFAULT_SHAPE_STROKE,
  type ShapeType,
} from "@/lib/shapes/shapeModel";
import {
  BOOLEAN_OPERATION_LABELS,
  booleanResultToPathNode,
  boundsForBooleanChildren,
  flattenBooleanGroup,
  getBooleanEligibleSelection,
  isBooleanEligibleNode,
  isBooleanGroup,
  isMaskGroup,
  topmostAmongSiblings,
  type BooleanOperation,
} from "@/lib/booleanGeometry";
import {
  booleanGroupChildrenToRemove,
  canOutlineStroke,
  convertStrokeToVector,
} from "@/lib/outlineStroke";
import { expandBooleanFillStylePatches } from "@/lib/booleanGroupFill";
import { getResizeAnchorLocal, solveNodeXYForAnchorWorld } from "@/lib/resizeTransform";
import {
  finiteCoord,
  finiteDimension,
  hasRotation,
  getNodeWorldOrigin,
} from "@/lib/transformMath";
import { buildEditorAssetFromFile, validateImageImportFile } from "@/lib/editorAssets";
import {
  clearLocalDocument,
  documentToEditorPatch,
  downloadJsonFile,
  editorStateToDocument,
  isBrokenOrphanedLocalDocument,
  parsePaytmCraftDocumentJson,
  prepareDocumentForEditorImport,
  readLocalDocument,
  sanitizeDocumentFilename,
  serializePersistStable,
  validatePaytmCraftDocument,
} from "@/lib/documentPersistence";
import { getSyncProvider } from "@/lib/syncProviderSingleton";
import { getPaytmCraftPublicEnv } from "@/lib/env";
import { apiClient, type CraftFileVersionSummary } from "@/lib/apiClient";
import { getActiveMockWorkspace } from "@/lib/mockAuth";

import {
  clonePersistedEditorSnapshot,
  editorStateToHistorySnapshot,
  historySnapshotToEditorPatch,
  type PersistedEditorSnapshot,
} from "@/lib/editorHistory";

export type { PersistedEditorSnapshot };

import {
  defaultCommentAuthor,
  editorCommentFromCraftApi,
  isNonEmptyCommentBody,
  newCommentId,
  newReplyId,
  type EditorComment,
  type EditorCommentReply,
} from "@/lib/comments";
import { shouldSampleFreehandPoint, simplifyPolyline } from "@/lib/freehandPath";
import {
  newPathPointId,
  normalizePathNode,
  rekeyPathPoints,
  type PathPoint,
} from "@/lib/pathGeometry";
import { mergePathPointHandles } from "@/lib/pathHandles";
import {
  convertNodeToPath,
  ensureRoundedRectPathPoints,
  shapeToPathPoints,
} from "@/lib/shapes/shapeToPath";
import { getPluginById, readInstalledPluginIds, writeInstalledPluginIds } from "@/lib/plugins";
import { getEditorClipboardJson, setEditorClipboardJson } from "@/lib/editorClipboardBuffer";
import { parseEditorClipboardPayload, type EditorClipboardPayloadV1 } from "@/lib/editorClipboardPayload";
import type { PresenceActivityEntry, PresenceUser } from "@/lib/presence";
import {
  DEFAULT_FRAME_PRESET_ID,
  resolveFramePresetSize,
} from "@/lib/framePresets";
import {
  captureActivePage,
  createEmptyPage,
  editorPatchFromPage,
  initialPagesFromCanvas,
  nextPageName,
  pagesWithActiveCaptured,
  type EditorPage,
} from "@/lib/editorPages";

export type { EditorComment, EditorCommentReply };
export type { PathPoint };
export type { PresenceUser, PresenceActivityEntry } from "@/lib/presence";

export type ApiCommentsStatus = "idle" | "loading" | "synced" | "failed";

export type ApiVersionsStatus = "idle" | "loading" | "synced" | "failed";

/** API file version row from `/api/v1/files/.../versions` (re-export). */
export type ApiFileVersion = CraftFileVersionSummary;

const pendingCommentCreateByLocalId = new Map<string, Promise<string>>();
const abortedCommentCreates = new Set<string>();

function resolveCommentServerId(localOrServerId: string): Promise<string> {
  const pending = pendingCommentCreateByLocalId.get(localOrServerId);
  if (pending) return pending;
  return Promise.resolve(localOrServerId);
}

export type Tool =
  | "move"
  | "frame"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "polygon"
  | "star"
  | "triangle"
  | "pencil"
  | "pen"
  | "text"
  | "comment"
  | "hand";

export type EditorMode = "design" | "prototype" | "inspect";
/** @deprecated Use EditorMode */
export type RightTab = EditorMode;

export type DocumentSaveStatus = "saved" | "unsaved" | "saving" | "saved-api" | "api-save-failed";

export type LeftTab = "layers" | "components" | "assets" | "styles";

export type RightPanelTab = "design" | "code";

export type CodePanelFormat = "html" | "react";

export type AlignDirection = "left" | "center-h" | "right" | "top" | "center-v" | "bottom";

export type NodeKind =
  | "frame"
  | "group"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow"
  | "polygon"
  | "path"
  | "text"
  | "image";

/** How image pixels map to the layer box (canvas uses CSS `object-fit`; export uses best-effort equivalents). */
export type ImageFitMode = "fill" | "fit" | "crop";

/** Figma-style child/frame sizing in auto layout */
export type LayoutSizingMode = "fixed" | "hug" | "fill";

export type StrokePosition = "inside" | "center" | "outside";

export type { StrokeSpec } from "@/lib/strokeSpec";

export type { LayoutMode, PrimaryAxisAlign, CrossAxisAlign, ConstraintHorizontal, ConstraintVertical };

export type { InstanceOverridePatch } from "@/lib/componentModel";

export interface EditorNode {
  id: string;
  parentId: string | null;
  type: NodeKind;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Mirror layer horizontally (local X) around center. */
  flipHorizontal?: boolean;
  /** Mirror layer vertically (local Y) around center. */
  flipVertical?: boolean;
  visible: boolean;
  locked: boolean;
  expanded: boolean;
  content?: string;
  fill?: string;
  /** Solid fill (default) or linear gradient */
  fillType?: import("@/lib/fillGradient").FillType;
  fillGradient?: import("@/lib/fillGradient").FillGradient;
  /** 0–1, default 1 */
  fillOpacity?: number;
  /** default true */
  fillEnabled?: boolean;
  /** Canonical Figma-like stroke (synced with legacy flat fields below). */
  stroke?: StrokeSpec;
  strokeColor?: string;
  /** Solid or gradient stroke paint */
  strokeType?: import("@/lib/fillGradient").FillType;
  strokeGradient?: import("@/lib/fillGradient").FillGradient;
  strokeWidth?: number;
  /** 0–1 stroke color opacity */
  strokeOpacity?: number;
  /** When false, stroke is hidden but settings are kept */
  strokeEnabled?: boolean;
  strokePosition?: StrokePosition;
  /** Which edges receive stroke (rectangles / frames). */
  strokeSides?: import("@/lib/strokeAlign").StrokeSidesMode;
  strokeSidesCustom?: import("@/lib/strokeAlign").StrokeSidesCustom;
  /** Line / open path start cap or arrow */
  strokeStartPoint?: import("@/lib/strokeEndpoints").StrokeEndpoint;
  /** Line / open path end cap or arrow */
  strokeEndPoint?: import("@/lib/strokeEndpoints").StrokeEndpoint;
  cornerRadius?: number;
  /** Per-corner radii [top-left, top-right, bottom-right, bottom-left]. */
  cornerRadii?: CornerRadii;
  /** Text color; falls back to `fill` when unset */
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  /** Unitless multiplier, e.g. 1.25 */
  lineHeight?: number;
  /** px */
  letterSpacing?: number;
  /** Stroke dash pattern */
  strokeStyle?: "solid" | "dashed" | "dotted";
  /** Custom dash length (px) when dashed/dotted */
  strokeDashLength?: number;
  /** Custom gap length (px) when dashed/dotted */
  strokeDashGap?: number;
  /** SVG stroke-linecap */
  strokeLinecap?: "butt" | "round" | "square";
  /** SVG stroke-linejoin */
  strokeLinejoin?: "miter" | "round" | "bevel";
  /** Minimum corner angle (degrees) before miter becomes bevel */
  strokeMiterAngle?: number;
  /** Variable width along path (partial sides default to taper). */
  strokeWidthProfile?: "uniform" | "taper";
  /** Flip width profile along path */
  strokeWidthProfileFlipped?: boolean;
  /** Ellipse arc start angle in degrees (0° = 3 o'clock, clockwise). */
  arcStartDeg?: number;
  /** Ellipse arc sweep in degrees (360 = full ellipse). */
  arcSweepDeg?: number;
  /** Ellipse inner radius as ratio of outer (0 = pie, >0 = ring / donut). */
  arcInnerRadiusRatio?: number;
  /** Regular polygon side count (path nodes) */
  polygonSides?: number;
  /** Star point count (path nodes) */
  starPoints?: number;
  /** Star inner radius ratio 0–1 (path nodes) */
  starInnerRadius?: number;
  /** Line with arrowhead (line nodes) */
  arrowHead?: boolean;
  /** Arrow layer start cap (arrow nodes). */
  startArrow?: import("@/lib/shapes/arrowGeometry").ArrowHeadKind;
  /** Arrow layer end cap (arrow nodes). */
  endArrow?: import("@/lib/shapes/arrowGeometry").ArrowHeadKind;
  /** Arrowhead size in px (arrow nodes). */
  arrowHeadSize?: number;
  /** Parent-local line start (Figma x1,y1). */
  lineX1?: number;
  lineY1?: number;
  /** Parent-local line end (Figma x2,y2). */
  lineX2?: number;
  lineY2?: number;
  /** Horizontal alignment */
  textAlign?: "left" | "center" | "right" | "justify";
  /** Underline / strikethrough (visual only; content unchanged). */
  textDecoration?: import("@/lib/text/textAdvancedStyle").TextDecorationMode;
  /** Text transform for display (content in store stays raw). */
  textCase?: import("@/lib/text/textAdvancedStyle").TextCaseMode;
  /** Trim ascender/descender padding from line boxes. */
  verticalTrim?: import("@/lib/text/textAdvancedStyle").TextVerticalTrim;
  /** Bulleted or numbered list prefixes per paragraph. */
  listStyle?: import("@/lib/text/textAdvancedStyle").TextListStyle;
  /** Extra space between paragraphs (px). */
  paragraphSpacing?: number;
  /** Truncate overflowing lines with ellipsis (fixed-height boxes). */
  textTruncate?: import("@/lib/text/textAdvancedStyle").TextTruncateMode;
  /** Vertical alignment within the text box */
  verticalAlign?: "top" | "middle" | "bottom";
  /** Figma-style auto-resize label (kept in sync with textResizeMode) */
  autoResize?: import("@/lib/text/autoResizeMode").AutoResizeMode;
  /** How the text box resizes with content */
  textResizeMode?: "auto-width" | "auto-height" | "fixed";

  /** Vector path (Pen tool); points are local to the node's bounds origin. */
  pathPoints?: PathPoint[];
  pathClosed?: boolean;
  /** Bezier handle mirroring when editing vector paths. */
  pathHandleMirroring?: import("@/lib/pathHandles").PathHandleMirroring;

  /** Embedded image layer; pixels come from `imageSrc` (and optionally `assets[assetId]`). */
  assetId?: string;
  imageSrc?: string;
  imageName?: string;
  imageMimeType?: string;
  imageFitMode?: ImageFitMode;

  /** Auto layout (frame/group only). Omitted or `"none"` = manual layout. */
  layoutMode?: LayoutMode;
  layoutGap?: number;
  /** When true, gap is inferred from child spacing (Figma “Auto”). */
  layoutGapAuto?: boolean;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  primaryAxisAlign?: PrimaryAxisAlign;
  counterAxisAlign?: CrossAxisAlign;
  /** Horizontal sizing in parent auto layout (Figma hug/fill/fixed). */
  layoutSizingHorizontal?: LayoutSizingMode;
  /** Vertical sizing in parent auto layout. */
  layoutSizingVertical?: LayoutSizingMode;
  /** Wrap children to new rows (horizontal) or columns (vertical). */
  layoutWrap?: boolean;
  /** In auto-layout parent: `auto` flows with siblings; `absolute` uses manual x/y. */
  layoutPositioning?: LayoutPositioning;
  /** Main-axis flex grow when sizing is fill (default 1). */
  layoutGrow?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Last layout pass (informational; mirrors width/height when hug/fill applied). */
  computedWidth?: number;
  computedHeight?: number;
  /** Set when geometry or layout inputs change; cleared after relayout. */
  layoutDirty?: boolean;
  /** Resizing a non-auto-layout parent can adjust children with these constraints. */
  constraintsHorizontal?: ConstraintHorizontal;
  constraintsVertical?: ConstraintVertical;

  /** Component master (frame/group): reusable definition */
  isComponent?: boolean;
  /** Stable id for this component definition (master + instances share family id) */
  componentId?: string;
  /** Instance root only: master frame/group node id this instance was created from */
  sourceComponentId?: string;
  /** Instance root: keyed by descendant node id → style/content overrides */
  instanceOverrides?: Record<string, Record<string, unknown>>;
  /** Shared by variant masters in the same set */
  variantGroupId?: string;
  /** Variant dimension values (e.g. { State: "Hover" }) */
  variantProperties?: Record<string, string>;

  /** Prototype interactions originating from this node (source = this id). */
  prototypeLinks?: PrototypeLink[];

  /** Linked design tokens (resolved at render; update token to refresh all usages). */
  fillTokenId?: string;
  textStyleTokenId?: string;
  effectTokenId?: string;

  /** Layer opacity 0–1 (default 1). Separate from fill opacity. */
  opacity?: number;
  /** Layer blend mode (Figma Appearance → Blend). */
  blendMode?: import("@/lib/layerBlendMode").LayerBlendMode;
  /** Ordered layer effects (shadows, blurs). */
  effects?: import("@/lib/nodeEffects").NodeEffect[];

  /** Boolean group metadata */
  booleanOperation?: BooleanOperation;
  isBooleanGroup?: boolean;
  /** Mask shape inside a mask group */
  isMask?: boolean;
  /** Mask group: id of the child used as clip mask */
  maskId?: string;
  /** Content node clipped by a mask group */
  maskedBy?: string;
  /** Figma mask mode (OUTLINE ≈ vector clip; LUMINANCE rendered as outline in v1). */
  figMaskType?: string;
  /** Frame clips children to bounds when true (Figma `frameMaskDisabled` inverse). */
  clipChildren?: boolean;
  /** Locked screenshot reference from web import (non-interactive). */
  isImportReference?: boolean;
  /** SVG path `d` for flattened boolean result */
  flattenedPathData?: string;
  /** Fill rule for compound paths (outline stroke rings, booleans). */
  pathFillRule?: "nonzero" | "evenodd";

  /** Design ↔ Code: original JSX tag (e.g. div, Header) for 1:1 React export */
  codeJsxTag?: string;
  /** Design ↔ Code: true for lowercase HTML elements */
  codeJsxIntrinsic?: boolean;
  /** Design ↔ Code: original className for export */
  codeClassName?: string;
}

export type NodeStylePatch = Partial<
  Pick<
    EditorNode,
    | "fill"
    | "fillType"
    | "fillGradient"
    | "fillOpacity"
    | "fillEnabled"
    | "stroke"
    | "strokeColor"
    | "strokeType"
    | "strokeGradient"
    | "strokeWidth"
    | "strokeOpacity"
    | "strokeEnabled"
    | "strokePosition"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokeStartPoint"
    | "strokeEndPoint"
    | "arrowHead"
    | "startArrow"
    | "endArrow"
    | "arrowHeadSize"
    | "strokeStyle"
    | "strokeDashLength"
    | "strokeDashGap"
    | "strokeLinecap"
    | "strokeLinejoin"
    | "strokeMiterAngle"
    | "strokeWidthProfile"
    | "strokeWidthProfileFlipped"
    | "cornerRadius"
    | "cornerRadii"
    | "arcStartDeg"
    | "arcSweepDeg"
    | "arcInnerRadiusRatio"
    | "polygonSides"
    | "starPoints"
    | "starInnerRadius"
    | "pathPoints"
    | "textColor"
    | "fontFamily"
    | "fontSize"
    | "fontWeight"
    | "lineHeight"
    | "letterSpacing"
    | "textAlign"
    | "textDecoration"
    | "textCase"
    | "verticalTrim"
    | "listStyle"
    | "paragraphSpacing"
    | "textTruncate"
    | "verticalAlign"
    | "autoResize"
    | "textResizeMode"
    | "content"
    | "imageFitMode"
    | "opacity"
    | "blendMode"
  >
>;

export interface GuideLine {
  axis: "v" | "h";
  pos: number;
  /** Span along the perpendicular axis (Figma-style segment, not full canvas). */
  from?: number;
  to?: number;
}

/** Persistent layout guide placed from rulers (Figma-style). */
export interface LayoutGuide {
  id: string;
  axis: "v" | "h";
  pos: number;
}

export interface DragMeasurementLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distance: number;
}

export interface EditorState {
  tool: Tool;
  /** Selected device preset for the frame tool (see `lib/framePresets`). */
  framePresetId: string;
  editorMode: EditorMode;
  leftTab: LeftTab;
  /** Right sidebar: layer properties vs live HTML/React code */
  rightPanelTab: RightPanelTab;
  codePanelFormat: CodePanelFormat;
  selectedIds: string[];
  zoom: number;
  pan: { x: number; y: number };
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  assets: Record<string, EditorAsset>;
  designTokens: Record<string, DesignToken>;
  guides: GuideLine[];
  dragMeasurements: DragMeasurementLine[];
  /** Pink-dot swap indicator while dragging one layer over another. */
  swapDragIndicator: {
    sourceId: string;
    targetId: string;
    sourceOrigin: { x: number; y: number };
    targetOrigin: { x: number; y: number };
  } | null;
  /** Insertion line while reordering a child inside auto layout. */
  autoLayoutReorderIndicator: {
    parentId: string;
    insertIndex: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
  layoutGuides: LayoutGuide[];
  layoutGuideDraft: Pick<LayoutGuide, "axis" | "pos"> | null;
  /** Selected violet ruler guide (layout guide line on canvas). */
  selectedLayoutGuideId: string | null;
  fileName: string;
  pages: Record<string, EditorPage>;
  pageOrder: string[];
  activePageId: string;
  showGrid: boolean;
  showRulers: boolean;
  canvasBackgroundColor: string;
  comments: EditorComment[];
  commentsPanelOpen: boolean;
  activeCommentId: string | null;
  isPlacingComment: boolean;
  /** In-progress pen path node id, or null. */
  penDrawingNodeId: string | null;
  /** In-progress freehand (pencil) path node id, or null. */
  pencilDrawingNodeId: string | null;
  /** Brush size for the next freehand stroke (and toolbar preset). */
  pencilStrokeWidth: number;
  /** Point-edit mode for a finished path (Backspace deletes selected anchor). */
  pathEditModeNodeId: string | null;
  /** Parametric shape edit (corner radius, arc, line endpoints, polygon sides, etc.). */
  shapeEditModeNodeId: string | null;
  /** Transient mode while resizing or rotating via selection handles. */
  transformInteractionMode: "none" | "resize" | "rotate";
  /** True while dragging selected object(s) on canvas. */
  isMovingSelection: boolean;
  /** Pointer over a rotate-from-corner hit target. */
  rotateHandleHovered: boolean;
  /** Corner/edge under the pointer for rotate cursor orientation. */
  rotateHandleHoverHandle: import("@/lib/resize").ResizeHandle | "top" | null;
  /** Edit children inside a boolean group (Figma-style). */
  objectEditModeNodeId: string | null;
  selectedPathPointId: string | null;
  editingTextId: string | null;
  textEditSelection: { anchor: number; focus: number } | null;

  prototypeWireDrag: null | {
    sourceNodeId: string;
    pointerId: number;
    curWX: number;
    curWY: number;
  };
  selectedPrototypeLinkId: string | null;
  prototypePreview: null | {
    mainFrameId: string;
    history: string[];
    overlayFrameId: string | null;
  };

  /** Live responsive preview (temporary geometry); Apply commits with one undo step. */
  responsivePreview: null | {
    frameId: string;
    geomBackup: Record<string, { x: number; y: number; width: number; height: number }>;
    draftWidth: number;
    draftHeight: number;
  };

  documentSaveStatus: DocumentSaveStatus;
  /** True until the first local/API document load finishes in the editor shell. */
  documentHydrating: boolean;
  documentHydrationRevision: number;

  /** When set (api mode), document is also saved to `/api/v1/files/:id`. Not serialized in `.paytmcraft.json`. */
  apiFileId: string | undefined;
  apiWorkspaceId: string | undefined;
  isApiBackedFile: boolean;
  /** Mock API comment sync; not persisted in `.paytmcraft.json`. */
  apiCommentsStatus: ApiCommentsStatus;

  /** Version history side panel (API-backed files only). Not persisted. */
  versionHistoryOpen: boolean;
  apiVersionsStatus: ApiVersionsStatus;
  apiFileVersions: ApiFileVersion[];

  historyPast: PersistedEditorSnapshot[];
  historyFuture: PersistedEditorSnapshot[];
  isApplyingHistory: boolean;
  pushHistory: (label?: string) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  setEditingTextId: (id: string | null) => void;
  setTextEditSelection: (anchor: number, focus: number) => void;
  setTool: (t: Tool) => void;
  setFramePresetId: (id: string) => void;
  setEditorMode: (t: EditorMode) => void;
  /** @deprecated Use setEditorMode */
  setRightTab: (t: EditorMode) => void;
  setLeftTab: (t: LeftTab) => void;
  setRightPanelTab: (t: RightPanelTab) => void;
  setCodePanelFormat: (f: CodePanelFormat) => void;

  startPrototypeConnection: (sourceNodeId: string, pointerId: number, curWX: number, curWY: number) => void;
  updatePrototypeWirePointer: (curWX: number, curWY: number) => void;
  finishPrototypeConnection: (targetFrameId: string | null) => void;
  cancelPrototypeConnection: () => void;
  updatePrototypeLink: (linkId: string, patch: Partial<Omit<PrototypeLink, "id" | "sourceNodeId">>) => void;
  deletePrototypeLink: (linkId: string) => void;
  setSelectedPrototypeLinkId: (id: string | null) => void;
  openPrototypePreview: (startFrameId?: string) => void;
  closePrototypePreview: () => void;
  navigatePrototype: (targetFrameId: string, asOverlay?: boolean) => void;
  prototypePreviewBack: () => void;
  select: (id: string | null, additive?: boolean) => void;
  clearSelection: () => void;
  setZoom: (z: number) => void;
  setPan: (p: { x: number; y: number }) => void;
  patchPan: (d: { x: number; y: number }) => void;
  updateNode: (id: string, patch: Partial<EditorNode>, opts?: { skipHistory?: boolean }) => void;
  updateNodes: (patches: Record<string, Partial<EditorNode>>, opts?: { skipHistory?: boolean }) => void;
  updateNodeStyle: (id: string, patch: NodeStylePatch, opts?: { skipHistory?: boolean }) => void;
  /** Apply a solid fill hex on one layer (clears linked fill color token, handles instances/booleans). */
  setNodeFillHex: (nodeId: string, hex: string, opts?: { skipHistory?: boolean }) => void;
  /** Apply text color hex (clears linked color token when used for text). */
  setNodeTextColorHex: (nodeId: string, hex: string, opts?: { skipHistory?: boolean }) => void;
  toggleVisible: (id: string) => void;
  toggleLock: (id: string) => void;
  setNodeVisible: (id: string, visible: boolean) => void;
  setNodeLocked: (id: string, locked: boolean) => void;
  toggleExpanded: (id: string) => void;
  renameNode: (id: string, name: string) => void;
  addRectangle: () => void;
  addText: () => void;
  addRectangleAt: (worldX: number, worldY: number) => void;
  addEllipseAt: (worldX: number, worldY: number) => void;
  addLineAt: (worldX: number, worldY: number) => void;
  addTriangleAt: (worldX: number, worldY: number) => void;
  createShapeFromDrag: (
    shapeType: ShapeType,
    start: { x: number; y: number },
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
    style?: Partial<Pick<EditorNode, "polygonSides" | "starPoints" | "starInnerRadius">>,
  ) => void;
  booleanUnionSelection: () => void;
  createBooleanGroup: (operation: BooleanOperation) => void;
  updateBooleanOperation: (groupId: string, operation: BooleanOperation) => void;
  flattenSelection: () => void;
  outlineStrokeSelection: () => void;
  enterObjectEditMode: (nodeId: string) => void;
  exitObjectEditMode: () => void;
  useSelectionAsMask: () => void;
  releaseMask: (maskGroupId: string) => void;
  setNodeAsMask: (nodeId: string, isMask: boolean) => void;
  addTextAt: (worldX: number, worldY: number) => void;
  createTextBoxFromDrag: (
    start: { x: number; y: number },
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
  ) => void;
  /** Reads file into `assets`, returns new asset id or null on validation/read error (alerts user). */
  importImageAsset: (file: File) => Promise<string | null>;
  /** Places an image node for `assetId`. Uses frame center when `worldX` / `worldY` omitted. */
  addImageNodeAt: (assetId: string, worldX?: number, worldY?: number) => void;
  replaceImageAsset: (nodeId: string, file: File) => Promise<void>;
  deleteAsset: (assetId: string) => void;
  createColorTokenFromSelection: (name?: string) => void;
  createGradientTokenFromSelection: (name?: string) => void;
  createTypographyTokenFromSelection: (name?: string) => void;
  createSpacingToken: (name: string, value: number) => void;
  /** Create a color style in the library (no selection required). */
  createColorToken: (name: string, hex: string, opacity?: number) => string | null;
  /** Add default brand + neutral color palette to the design system. */
  seedDesignSystemColorPalette: () => void;
  updateDesignToken: (id: string, patch: Partial<Omit<DesignToken, "id" | "createdAt">>) => void;
  deleteDesignToken: (id: string) => void;
  applyTokenToSelection: (tokenId: string) => void;
  detachTokenFromSelection: (tokenType: DetachableTokenKind) => void;
  addEffect: (nodeId: string, type: import("@/lib/nodeEffects").NodeEffectType) => void;
  updateEffect: (nodeId: string, effectId: string, patch: Partial<import("@/lib/nodeEffects").NodeEffect>) => void;
  deleteEffect: (nodeId: string, effectId: string) => void;
  toggleEffect: (nodeId: string, effectId: string) => void;
  createEffectTokenFromSelection: (name?: string) => void;
  applyEffectTokenToSelection: (tokenId: string) => void;
  detachEffectTokenFromSelection: () => void;
  createFrameAt: (
    worldX: number,
    worldY: number,
    opts?: { presetId?: string; width?: number; height?: number; name?: string },
  ) => void;
  createFrameWithBounds: (
    x: number,
    y: number,
    width: number,
    height: number,
    opts?: { presetId?: string; name?: string },
  ) => void;
  duplicateSelection: () => void;
  /** Clone current selection in place (no offset); selects clones. Does not push history. */
  cloneSelectionInPlace: () => string[];
  deleteSelection: (opts?: { skipHistory?: boolean }) => void;
  alignSelection: (direction: AlignDirection) => void;
  distributeSelection: (axis: "horizontal" | "vertical") => void;
  selectAllEditable: () => void;
  toggleLockSelection: () => void;
  toggleVisibleSelection: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  pasteSelection: (opts?: { inPlace?: boolean }) => void;
  bringForward: () => void;
  sendBackward: () => void;
  bringToFront: () => void;
  sendToBack: () => void;
  /** Nudge selected layers by delta in parent-local px (design mode). */
  nudgeSelection: (dx: number, dy: number) => void;
  setPencilStrokeWidth: (width: number) => void;
  setSelectionStrokeWidth: (width: number) => void;
  nudgeSelectionStrokeWidth: (delta: number) => void;
  /** Reorder a flow child along the auto-layout primary axis (arrow keys). */
  reorderAutoLayoutChildByArrow: (arrowCode: string) => boolean;
  /** Swap two flow siblings inside the same auto-layout parent. */
  swapAutoLayoutSiblings: (idA: string, idB: string, opts?: { skipHistory?: boolean }) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  /** Figma ⇧A — wrap selection in auto-layout frame or enable on container. */
  addAutoLayoutToSelection: () => void;
  /** Enable auto layout on a frame/group (all direct children). */
  addAutoLayoutToContainer: (containerId: string) => void;
  /** Figma ⌘⌥G — wrap selection in a plain frame. */
  wrapSelectionInFrame: () => void;
  toggleSelectNode: (id: string) => void;
  setSelection: (ids: string[]) => void;
  setGuides: (g: GuideLine[]) => void;
  setSnapOverlay: (guides: GuideLine[], measurements: DragMeasurementLine[]) => void;
  setSwapDragIndicator: (
    indicator: {
      sourceId: string;
      targetId: string;
      sourceOrigin: { x: number; y: number };
      targetOrigin: { x: number; y: number };
    } | null,
  ) => void;
  setAutoLayoutReorderIndicator: (
    indicator: {
      parentId: string;
      insertIndex: number;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    } | null,
  ) => void;
  setLayoutGuideDraft: (draft: Pick<LayoutGuide, "axis" | "pos"> | null) => void;
  cancelLayoutGuideDraft: () => void;
  commitLayoutGuide: () => void;
  selectLayoutGuide: (id: string | null) => void;
  removeLayoutGuide: (id: string) => void;
  updateLayoutGuidePosition: (id: string, pos: number, opts?: { skipHistory?: boolean }) => void;
  toggleGrid: () => void;
  toggleRulers: () => void;
  setCanvasBackgroundColor: (hex: string, opts?: { skipHistory?: boolean }) => void;

  startPlacingComment: () => void;
  cancelPlacingComment: () => void;
  addComment: (point: { x: number; y: number }, parentNodeId?: string) => void;
  updateComment: (id: string, body: string) => void;
  addCommentReply: (commentId: string, body: string) => void;
  resolveComment: (id: string) => void;
  reopenComment: (id: string) => void;
  deleteComment: (id: string, opts?: { skipHistory?: boolean; pendingBody?: string }) => void;
  setActiveCommentId: (id: string | null) => void;
  toggleCommentsPanel: () => void;
  focusComment: (id: string) => void;
  startPathAt: (point: { x: number; y: number }) => void;
  addPathPoint: (point: { x: number; y: number }) => void;
  /** Figma-style click-drag: anchor at click, symmetric handles from drag vector. */
  addPathPointDrag: (anchorWorld: { x: number; y: number }, dragWorld: { x: number; y: number }) => void;
  /** Finish pen drawing. `true` = close path (click on first point); `false`/omit = open path. */
  finishPath: (asClosed?: boolean) => void;
  cancelPath: () => void;
  startPencilStroke: (point: { x: number; y: number }) => void;
  extendPencilStroke: (point: { x: number; y: number }) => void;
  /** Append multiple freehand samples in one store update (smooth pencil drag). */
  extendPencilStrokeCoalesced: (points: { x: number; y: number }[]) => void;
  finishPencilStroke: () => void;
  cancelPencilStroke: () => void;
  updatePathPoint: (
    nodeId: string,
    pointId: string,
    patch: Partial<PathPoint>,
    opts?: { skipHistory?: boolean },
  ) => void;
  deletePathPoint: (nodeId: string, pointId: string) => void;
  togglePathClosed: (nodeId: string) => void;
  setPathEditMode: (nodeId: string | null) => void;
  enterShapeEditMode: (nodeId?: string) => void;
  exitShapeEditMode: () => void;
  exitAllEditModes: () => void;
  toggleEditMode: (nodeId?: string) => void;
  setTransformInteractionMode: (mode: "none" | "resize" | "rotate") => void;
  setIsMovingSelection: (active: boolean) => void;
  setRotateHandleHovered: (
    hovered: boolean,
    handle?: import("@/lib/resize").ResizeHandle | "top",
  ) => void;
  enterVectorEditMode: (nodeId?: string) => void;
  setPathHandleMirroring: (mode: import("@/lib/pathHandles").PathHandleMirroring) => void;
  setSelectedPathPointId: (id: string | null) => void;
  resizeNode: (
    id: string,
    handle: ResizeHandle,
    startBounds: Bounds,
    currentPoint: { x: number; y: number },
    modifiers: ResizeModifiers,
    opts?: { skipHistory?: boolean; fixedWorld?: { x: number; y: number } | null },
  ) => void;
  resizeFrameWithConstraints: (
    frameId: string,
    newBounds: { x?: number; y?: number; width: number; height: number },
    opts?: { skipHistory?: boolean; skipParentRelayout?: boolean },
  ) => void;

  openResponsivePreview: (frameId: string) => void;
  updateResponsivePreviewBounds: (width: number, height: number) => void;
  resetResponsivePreview: () => void;
  cancelResponsivePreview: () => void;
  applyResponsivePreview: () => void;

  reorderNode: (id: string, targetParentId: string, targetIndex: number) => void;
  moveNodeToParent: (id: string, newParentId: string, index: number) => void;
  updateLayout: (id: string, patch: LayoutPatch) => void;
  updateLayoutSizing: (
    id: string,
    axis: "horizontal" | "vertical",
    mode: LayoutSizingMode,
  ) => void;
  updateLayoutPositioning: (id: string, positioning: LayoutPositioning) => void;
  updateConstraints: (id: string, patch: ConstraintsPatch) => void;
  applyAutoLayout: (parentId: string) => void;

  hoveredCanvasId: string | null;
  setHoveredCanvasId: (id: string | null) => void;

  contextMenu: null | { clientX: number; clientY: number; nodeId: string };
  openContextMenu: (nodeId: string, clientX: number, clientY: number) => void;
  closeContextMenu: () => void;

  layerRenameId: string | null;
  setLayerRenameId: (id: string | null) => void;

  saveToLocal: () => void;
  setApiFileSession: (fileId: string, workspaceId?: string) => void;
  clearApiFileSession: () => void;
  saveCurrentDocumentAsApiFile: () => Promise<void>;
  loadApiComments: () => Promise<void>;
  syncCommentToApi: (commentId: string) => void;
  deleteApiComment: (commentId: string) => void;
  openVersionHistory: () => void;
  closeVersionHistory: () => void;
  /** Close the highest-priority open overlay (modals, menus). Returns true if one was closed. */
  closeTopmostOverlay: () => boolean;
  openHelpDemoChecklist: () => void;
  loadApiFileVersions: () => Promise<void>;
  createApiFileVersion: (name?: string) => Promise<void>;
  restoreApiFileVersion: (versionId: string) => Promise<void>;
  loadFromLocal: () => Promise<boolean>;
  /** Fills the sample exploration document when the workspace is still empty (first visit). */
  applySampleDocumentIfEmpty: () => void;
  /** Clears loading/import overlays if hydration or .fig import did not finish. */
  resetEditorBlockingState: () => void;
  /** Apply storage document when tab is clean (saved) and content differs; used for cross-tab sync. */
  applyPersistedDocumentIfClean: (doc: PaytmCraftDocument | null) => boolean;
  exportDocument: () => void;
  importDocument: (file: File) => Promise<void>;
  /** Import a Figma `.fig` archive into the editor. */
  importFigmaFile: (file: File) => Promise<void>;
  /** Import from Figma REST API (link, file key, or frame URL). */
  importFigmaFromLink: (opts: {
    url?: string;
    fileKey?: string;
    nodeId?: string;
    accessToken?: string;
  }) => Promise<void>;
  /** Import `.paytmcraft.json` or `.fig` based on file extension. */
  importWorkspaceFile: (file: File) => Promise<void>;
  resetDocument: () => void;
  setDocumentName: (name: string) => void;
  setActivePage: (pageId: string) => void;
  addPage: () => void;
  duplicatePage: (pageId?: string) => void;
  deletePage: (pageId: string) => void;
  renamePage: (pageId: string, name: string) => void;
  cycleActivePage: (delta: -1 | 1) => void;
  /** Replace editor document from a persist slice (dashboard templates, imports, blank). Writes localStorage. */
  loadWorkspaceFromPersist: (
    slice: EditorPersistSlice,
    apiSession?: { apiFileId: string; apiWorkspaceId?: string },
  ) => Promise<void>;

  duplicateSingle: (id: string) => void;
  deleteSingle: (id: string) => void;

  placingComponentMasterId: string | null;
  setPlacingComponentMasterId: (id: string | null) => void;
  createComponentFromSelection: () => void;
  createInstance: (componentKey: string, worldX: number, worldY: number) => void;
  detachInstance: (instanceRootId: string) => void;
  updateInstanceOverride: (
    instanceRootId: string,
    targetNodeId: string,
    patch: InstanceOverridePatch,
  ) => void;
  createVariantFromComponent: (componentKey: string) => void;
  updateVariantProperties: (componentKey: string, properties: Record<string, string>) => void;

  presenceUsers: PresenceUser[];
  showPresence: boolean;
  presenceActivityLog: PresenceActivityEntry[];
  togglePresence: () => void;
  updateMockPresence: (users: PresenceUser[]) => void;
  setPresenceUsers: (users: PresenceUser[]) => void;
  clearPresence: () => void;
  appendPresenceActivity: (text: string) => void;

  commandMenuOpen: boolean;
  shortcutOverlayOpen: boolean;
  /** Left/right panels, top toolbar, and footer (Figma-style hide UI). */
  uiChromeVisible: boolean;
  setCommandMenuOpen: (open: boolean) => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  toggleUiChrome: () => void;
  setUiChromeVisible: (visible: boolean) => void;

  aiModalOpen: boolean;
  aiModalSource: "dashboard" | "editor" | null;
  openAIModal: (source: "dashboard" | "editor") => void;
  closeAIModal: () => void;

  importHubOpen: boolean;
  importWebModalOpen: boolean;
  importFigmaModalOpen: boolean;
  /** True while a .fig file is being parsed. */
  figImportInProgress: boolean;
  /** Human-readable stage for the import overlay. */
  figImportStatus: string | null;
  /** Brief success/warning message after import completes (cleared automatically). */
  figImportToast: string | null;
  setFigImportToast: (message: string | null) => void;
  codeRoundTripOpen: boolean;
  codeRoundTripTab: "export" | "import";
  /** Import lines preserved from uploaded React for 1:1 export */
  codeRoundTripSourceHeader: string | null;
  setCodeRoundTripSourceHeader: (header: string | null) => void;
  openImportHub: () => void;
  closeImportHub: () => void;
  openImportWebModal: () => void;
  closeImportWebModal: () => void;
  openImportFigmaModal: () => void;
  closeImportFigmaModal: () => void;
  openCodeRoundTrip: (tab?: "export" | "import") => void;
  closeCodeRoundTrip: () => void;

  applyGeneratedDesign: (
    slice: EditorPersistSlice,
    mode: "replace" | "append",
    opts?: { recordHistory?: boolean; zoomToFit?: boolean },
  ) => Promise<void>;

  pluginMarketplaceOpen: boolean;
  installedPluginIds: string[];
  activePluginId: string | undefined;
  /** Mock SaaS share dialog (local only). */
  shareModalOpen: boolean;
  openShareModal: () => void;
  closeShareModal: () => void;
  /** Mock workspace switcher from the editor (localStorage-backed). */
  workspacePickerOpen: boolean;
  openWorkspacePicker: () => void;
  closeWorkspacePicker: () => void;
  /** Mock invite teammate dialog (local only). */
  teamInviteModalOpen: boolean;
  openTeamInviteModal: () => void;
  closeTeamInviteModal: () => void;
  openPluginMarketplace: () => void;
  closePluginMarketplace: () => void;
  installPlugin: (id: string) => void;
  uninstallPlugin: (id: string) => void;
  runPlugin: (id: string) => void;
  closeActivePlugin: () => void;
  applyPluginLoremIpsumToSelection: () => void;
  applyPluginRenameSelection: () => void;
  applyPluginIconInSelection: () => void;
}

export const ROOT = EDITOR_ROOT_KEY;

function remapNodeTreeIds(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  selectedIds: string[],
): Pick<EditorPersistSlice, "nodes" | "childOrder" | "selectedIds"> {
  const prefix = `gen-${Date.now().toString(36)}-`;
  const oldIds = Object.keys(nodes);
  const idMap = new Map(oldIds.map((id, i) => [id, `${prefix}${i}`]));
  const remappedNodes: Record<string, EditorNode> = {};
  for (const oid of oldIds) {
    const n = nodes[oid]!;
    const nid = idMap.get(oid)!;
    const pid = n.parentId ? idMap.get(n.parentId) ?? null : null;
    remappedNodes[nid] = { ...n, id: nid, parentId: pid };
  }
  const remappedChildOrder: Record<string, string[]> = {};
  for (const [k, arr] of Object.entries(childOrder)) {
    const nk = k === ROOT ? ROOT : idMap.get(k) ?? k;
    remappedChildOrder[nk] = arr.map((cid) => idMap.get(cid) ?? cid);
  }
  const newRoots = (childOrder[ROOT] ?? []).map((cid) => idMap.get(cid)!);
  const remappedSelectedIds = selectedIds
    .map((cid) => idMap.get(cid) ?? cid)
    .filter((cid) => remappedNodes[cid]);
  return {
    nodes: remappedNodes,
    childOrder: remappedChildOrder,
    selectedIds: remappedSelectedIds.length > 0 ? remappedSelectedIds : newRoots,
  };
}

function remapPersistSliceIds(slice: EditorPersistSlice): EditorPersistSlice {
  const activeRemapped = remapNodeTreeIds(slice.nodes, slice.childOrder, slice.selectedIds);
  const pages: Record<string, EditorPage> = {};
  for (const pageId of slice.pageOrder) {
    const page = slice.pages[pageId]!;
    if (pageId === slice.activePageId) {
      pages[pageId] = {
        ...page,
        nodes: activeRemapped.nodes,
        childOrder: activeRemapped.childOrder,
        selectedIds: activeRemapped.selectedIds,
      };
      continue;
    }
    const remapped = remapNodeTreeIds(page.nodes, page.childOrder, page.selectedIds);
    pages[pageId] = {
      ...page,
      nodes: remapped.nodes,
      childOrder: remapped.childOrder,
      selectedIds: remapped.selectedIds,
    };
  }
  return {
    ...slice,
    ...activeRemapped,
    pages,
  };
}

function syncActivePageRecord(
  state: Pick<
    EditorState,
    | "pages"
    | "pageOrder"
    | "activePageId"
    | "nodes"
    | "childOrder"
    | "zoom"
    | "pan"
    | "showGrid"
    | "showRulers"
    | "canvasBackgroundColor"
    | "selectedIds"
    | "layoutGuides"
  >,
): Pick<EditorState, "pages"> {
  const active = captureActivePage(state);
  return { pages: { ...state.pages, [state.activePageId]: active } };
}

function clonePageCanvas(page: EditorPage): Pick<EditorPage, "nodes" | "childOrder" | "selectedIds"> {
  return remapNodeTreeIds(page.nodes, page.childOrder, page.selectedIds);
}

function applyMoveNodeToParent(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  newParentKey: string,
  insertBeforeIndex: number,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;
  const oldKey = n.parentId ?? ROOT;
  if (newParentKey !== ROOT) {
    const p = s.nodes[newParentKey];
    if (!p || (p.type !== "frame" && p.type !== "group")) return null;
  }
  if (id === newParentKey) return null;
  if (newParentKey !== ROOT && isAncestorOf(s.nodes, id, newParentKey)) return null;

  const origin = getRenderedWorldTopLeft(id, s.nodes, s.childOrder);
  const co: Record<string, string[]> = { ...s.childOrder };
  const oldList = [...(co[oldKey] ?? [])];
  const oldIdx = oldList.indexOf(id);
  if (oldIdx < 0) return null;
  oldList.splice(oldIdx, 1);
  co[oldKey] = oldList;

  const newList = [...(co[newParentKey] ?? [])].filter((x) => x !== id);
  let insert = insertBeforeIndex;
  if (oldKey === newParentKey && oldIdx >= 0 && oldIdx < insertBeforeIndex) {
    insert -= 1;
  }
  insert = Math.max(0, Math.min(insert, newList.length));
  newList.splice(insert, 0, id);
  co[newParentKey] = newList;

  const newParentNodeId = newParentKey === ROOT ? null : newParentKey;
  const parentChanged = (n.parentId ?? ROOT) !== newParentKey;

  const nodes: Record<string, EditorNode> = { ...s.nodes };
  const next: EditorNode = { ...n, parentId: newParentNodeId };

  if (parentChanged) {
    if (newParentNodeId) {
      const local = worldPointToParentLocalFromChildOrder(
        origin.x,
        origin.y,
        newParentNodeId,
        nodes,
        co,
      );
      next.x = local.x;
      next.y = local.y;
    } else {
      next.x = origin.x;
      next.y = origin.y;
    }
  }

  if (newParentNodeId) {
    const parentNode = nodes[newParentNodeId];
    const pMode = parentNode?.layoutMode ?? "none";
    if (pMode === "horizontal" || pMode === "vertical") {
      next.layoutPositioning = "auto";
      next.layoutDirty = true;
    }
  }

  nodes[id] = next;
  const repaired = repairNodeHierarchy(nodes, co);
  return { nodes: repaired.nodes, childOrder: repaired.childOrder };
}

function buildMock(): Pick<EditorState, "nodes" | "childOrder"> {
  const nodes: Record<string, EditorNode> = {};
  const childOrder: Record<string, string[]> = { [ROOT]: ["ab-mobile", "ab-web", "ab-dash"] };

  const mk = (n: EditorNode) => {
    nodes[n.id] = n;
  };

  mk({
    id: "ab-mobile",
    parentId: null,
    type: "frame",
    name: "Mobile — Paytm",
    x: 80,
    y: 80,
    width: 390,
    height: 844,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    strokeColor: "#e5e5e5",
    strokeWidth: 1,
    cornerRadius: 32,
  });
  childOrder["ab-mobile"] = ["m-status", "m-header", "m-hero", "m-card1", "m-nav"];

  mk({
    id: "m-status",
    parentId: "ab-mobile",
    type: "rectangle",
    name: "Status bar",
    x: 0,
    y: 0,
    width: 390,
    height: 44,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#0f172a",
    cornerRadius: 32,
  });
  mk({
    id: "m-header",
    parentId: "ab-mobile",
    type: "group",
    name: "Header",
    x: 20,
    y: 60,
    width: 350,
    height: 48,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  });
  childOrder["m-header"] = ["m-logo", "m-title"];
  mk({
    id: "m-logo",
    parentId: "m-header",
    type: "rectangle",
    name: "Logo mark",
    x: 0,
    y: 6,
    width: 36,
    height: 36,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#0d99ff",
    cornerRadius: 8,
  });
  mk({
    id: "m-title",
    parentId: "m-header",
    type: "text",
    name: "Title",
    x: 48,
    y: 10,
    width: 200,
    height: 28,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Paytm Craft",
    fill: "#0f172a",
  });

  mk({
    id: "m-hero",
    parentId: "ab-mobile",
    type: "rectangle",
    name: "Hero",
    x: 20,
    y: 130,
    width: 350,
    height: 180,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#e0f2fe",
    cornerRadius: 16,
  });
  mk({
    id: "m-card1",
    parentId: "ab-mobile",
    type: "rectangle",
    name: "Primary card",
    x: 20,
    y: 330,
    width: 350,
    height: 120,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    strokeColor: "#e2e8f0",
    strokeWidth: 1,
    cornerRadius: 12,
  });
  mk({
    id: "m-nav",
    parentId: "ab-mobile",
    type: "rectangle",
    name: "Tab bar",
    x: 0,
    y: 760,
    width: 390,
    height: 84,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#fafafa",
    strokeColor: "#e5e5e5",
    strokeWidth: 1,
    cornerRadius: 0,
  });

  mk({
    id: "ab-web",
    parentId: null,
    type: "frame",
    name: "Marketing site",
    x: 520,
    y: 80,
    width: 1280,
    height: 720,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    strokeColor: "#e5e5e5",
    strokeWidth: 1,
    cornerRadius: 0,
  });
  childOrder["ab-web"] = ["w-nav", "w-hero", "w-grid"];

  mk({
    id: "w-nav",
    parentId: "ab-web",
    type: "rectangle",
    name: "Nav bar",
    x: 0,
    y: 0,
    width: 1280,
    height: 72,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    strokeColor: "#e5e5e5",
    strokeWidth: 1,
    cornerRadius: 0,
  });
  mk({
    id: "w-hero",
    parentId: "ab-web",
    type: "group",
    name: "Hero section",
    x: 80,
    y: 120,
    width: 1120,
    height: 280,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  });
  childOrder["w-hero"] = ["w-hero-copy", "w-hero-visual"];
  mk({
    id: "w-hero-copy",
    parentId: "w-hero",
    type: "text",
    name: "Headline",
    x: 0,
    y: 40,
    width: 520,
    height: 120,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Design systems, shipped.",
    fill: "#0f172a",
  });
  mk({
    id: "w-hero-visual",
    parentId: "w-hero",
    type: "rectangle",
    name: "Hero visual",
    x: 560,
    y: 0,
    width: 560,
    height: 280,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#f1f5f9",
    cornerRadius: 12,
  });

  mk({
    id: "w-grid",
    parentId: "ab-web",
    type: "group",
    name: "Feature cards",
    x: 80,
    y: 440,
    width: 1120,
    height: 220,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  });
  childOrder["w-grid"] = ["w-c1", "w-c2", "w-c3"];
  for (let i = 0; i < 3; i++) {
    const id = `w-c${i + 1}`;
    mk({
      id,
      parentId: "w-grid",
      type: "rectangle",
      name: `Card ${i + 1}`,
      x: i * 380,
      y: 0,
      width: 360,
      height: 200,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: "#fafafa",
      strokeColor: "#e2e8f0",
      strokeWidth: 1,
      cornerRadius: 8,
    });
  }

  mk({
    id: "ab-dash",
    parentId: null,
    type: "frame",
    name: "Dashboard card",
    x: 1900,
    y: 120,
    width: 480,
    height: 600,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#f8fafc",
    strokeColor: "#e2e8f0",
    strokeWidth: 1,
    cornerRadius: 12,
  });
  childOrder["ab-dash"] = ["d-title", "d-chart", "d-rows"];
  mk({
    id: "d-title",
    parentId: "ab-dash",
    type: "text",
    name: "Card title",
    x: 24,
    y: 24,
    width: 300,
    height: 28,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content: "Weekly revenue",
    fill: "#0f172a",
  });
  mk({
    id: "d-chart",
    parentId: "ab-dash",
    type: "rectangle",
    name: "Chart area",
    x: 24,
    y: 72,
    width: 432,
    height: 200,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    strokeColor: "#e2e8f0",
    strokeWidth: 1,
    cornerRadius: 8,
  });
  mk({
    id: "d-rows",
    parentId: "ab-dash",
    type: "group",
    name: "Metric rows",
    x: 24,
    y: 300,
    width: 432,
    height: 260,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
  });
  childOrder["d-rows"] = ["d-r1", "d-r2", "d-r3"];
  [0, 1, 2].forEach((i) => {
    mk({
      id: `d-r${i + 1}`,
      parentId: "d-rows",
      type: "rectangle",
      name: `Row ${i + 1}`,
      x: 0,
      y: i * 84,
      width: 432,
      height: 72,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: i % 2 === 0 ? "#ffffff" : "#f1f5f9",
      strokeColor: "#e2e8f0",
      strokeWidth: 1,
      cornerRadius: 6,
    });
  });

  return { nodes, childOrder };
}

function resolveFrameParentForPlugin(state: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">): string | null {
  for (const sid of state.selectedIds) {
    const n = state.nodes[sid];
    if (n?.type === "frame" && !n.locked && n.visible) return sid;
  }
  for (const sid of state.selectedIds) {
    let walk: string | null = sid;
    const seen = new Set<string>();
    while (walk && !seen.has(walk)) {
      seen.add(walk);
      const node: EditorNode | undefined = state.nodes[walk];
      if (!node) break;
      if (node.type === "frame" && !node.locked && node.visible) return walk;
      walk = node.parentId;
    }
  }
  const pid = targetFrameForInsert(state);
  const p = state.nodes[pid];
  if (p?.type === "frame" && !p.locked && p.visible) return pid;
  return null;
}

function insertParentFrame(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldX: number,
  worldY: number,
): { pid: string; frame: EditorNode } | null {
  const pid = targetFrameForInsert(s, { x: worldX, y: worldY });
  const p = s.nodes[pid];
  if (!p || p.type !== "frame" || p.locked || !p.visible) return null;
  return { pid, frame: p };
}

/** Ensures a frame exists to insert into; creates a root artboard at the click when none exist. */
function ensureInsertParentFrame(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldX: number,
  worldY: number,
): {
  nodes: Record<string, EditorNode>;
  childOrder: Record<string, string[]>;
  parent: { pid: string; frame: EditorNode };
} | null {
  const direct = insertParentFrame(s, worldX, worldY);
  if (direct) return { nodes: s.nodes, childOrder: s.childOrder, parent: direct };

  const roots = s.childOrder[ROOT] ?? [];
  const hasFrame = roots.some((id) => s.nodes[id]?.type === "frame");
  if (hasFrame) return null;

  const id = `frame-${Date.now()}`;
  const W = 390;
  const H = 844;
  const node: EditorNode = {
    id,
    parentId: null,
    type: "frame",
    name: nextFrameName(s.nodes),
    x: worldX - W / 2,
    y: worldY - H / 2,
    width: W,
    height: H,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    fillEnabled: true,
    fillOpacity: 1,
    strokePosition: "center",
  };
  const nodes = { ...s.nodes, [id]: node };
  const childOrder = { ...s.childOrder, [ROOT]: [...roots, id], [id]: [] };
  const parent = insertParentFrame({ nodes, childOrder, selectedIds: s.selectedIds }, worldX, worldY);
  if (!parent) return null;
  return { nodes, childOrder, parent };
}

function parentListKey(parentId: string | null): string {
  return parentId ?? ROOT;
}

function editableTopLevelSelection(
  s: Pick<EditorState, "selectedIds" | "nodes">,
): string[] {
  return topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
}

function cloneTopLevelSelectionState(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  offset: number,
): Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "tool" | "editingTextId"> | null {
  const tops = editableTopLevelSelection(s);
  if (tops.length === 0) return null;

  const nodes: Record<string, EditorNode> = { ...s.nodes };
  const childOrder: Record<string, string[]> = { ...s.childOrder };
  const newRoots: string[] = [];
    const parentOf = buildParentMapFromChildOrder(s.childOrder);

  for (const rootId of tops) {
    const rootOld = s.nodes[rootId];
    if (!rootOld) continue;
    const nameForRoot =
      rootOld.type === "text"
        ? duplicatedTextLayerName(rootOld.content)
        : nextDuplicatedLayerName(nodes, rootOld.name);
    const idMap = new Map<string, string>();
    const renderParent = parentOf.get(rootId) ?? null;
    const inAutoLayout = parentUsesAutoLayout(renderParent, s.nodes);
    const rootOffset = inAutoLayout ? 0 : offset;

    const cloneRecursive = (oldId: string, newParent: string | null): string => {
      const old = s.nodes[oldId];
      if (!old) return "";
      const newId = `${old.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      idMap.set(oldId, newId);
      const pos = clonedNodePosition(
        oldId,
        oldId === rootId,
        rootOffset,
        s.nodes,
        s.childOrder,
        newParent,
        old,
      );
      const base: EditorNode = {
        ...old,
        id: newId,
        parentId: newParent,
        name:
          old.type === "text"
            ? duplicatedTextLayerName(old.content)
            : oldId === rootId
              ? nameForRoot
              : old.name,
        x: pos.x,
        y: pos.y,
      };
      let next: EditorNode =
        old.type === "path" && old.pathPoints?.length
          ? { ...base, pathPoints: rekeyPathPoints(old.pathPoints) }
          : base;
      if (old.effects?.length) {
        next = { ...next, effects: old.effects.map((e) => ({ ...e, id: newNodeEffectId() })) };
      }
      nodes[newId] = next;
      const newKids: string[] = [];
      for (const k of s.childOrder[oldId] ?? []) {
        newKids.push(cloneRecursive(k, newId));
      }
      childOrder[newId] = newKids;
      return newId;
    };

    const newRootId = cloneRecursive(rootId, renderParent);
    for (const nid of collectSubtreeIds(newRootId, childOrder)) {
      const n = nodes[nid]!;
      if (!n.prototypeLinks?.length) continue;
      nodes[nid] = {
        ...n,
        prototypeLinks: n.prototypeLinks.map((l) => ({
          ...l,
          id: newPrototypeLinkId(),
          sourceNodeId: idMap.get(l.sourceNodeId) ?? l.sourceNodeId,
          targetFrameId:
            l.targetFrameId && idMap.has(l.targetFrameId) ? idMap.get(l.targetFrameId)! : l.targetFrameId,
        })),
      };
    }
    const P = parentListKey(renderParent);
    const list = [...(childOrder[P] ?? [])];
    const curIdx = list.indexOf(rootId);
    const insertAt = curIdx >= 0 ? curIdx + 1 : list.length;
    list.splice(insertAt, 0, newRootId);
    childOrder[P] = list;
    newRoots.push(newRootId);
  }

  let nodesOut = nodes;
  const relayoutKeys = new Set<string>();
  for (const rootId of tops) {
    const pid = parentOf.get(rootId) ?? null;
    if (parentUsesAutoLayout(pid, nodesOut)) {
      relayoutKeys.add(parentListKey(pid));
    }
  }
  if (relayoutKeys.size > 0) {
    nodesOut = relayoutParentsWithAutoLayout(nodesOut, childOrder, relayoutKeys);
  }

  const co = dedupeChildOrderLists(nodesOut, childOrder);
  const nodesSynced = syncParentIdsFromChildOrder(nodesOut, co);
  const repaired = repairNodeHierarchyIfNeeded(nodesSynced, co);

  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    selectedIds: newRoots,
    tool: "move",
    editingTextId: null,
  };
}

function removeNodeAndDescendants(
  s: Pick<EditorState, "nodes" | "childOrder">,
  rootId: string,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  const toRemove = new Set(collectSubtreeIds(rootId, s.childOrder));
  const nodes = { ...s.nodes };
  const childOrder: Record<string, string[]> = {};
  for (const [k, arr] of Object.entries(s.childOrder)) {
    childOrder[k] = arr.filter((id) => !toRemove.has(id));
  }
  for (const id of toRemove) {
    delete nodes[id];
    delete childOrder[id];
  }
  return { nodes, childOrder };
}

const LAYOUT_FIELD_KEYS = new Set<string>([
  "layoutMode",
  "layoutGap",
  "layoutGapAuto",
  "layoutWrap",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "primaryAxisAlign",
  "counterAxisAlign",
  "layoutSizingHorizontal",
  "layoutSizingVertical",
  "layoutPositioning",
  "layoutGrow",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
]);
const GEOM_KEYS = new Set<string>(["x", "y", "width", "height", "lineX1", "lineY1", "lineX2", "lineY2"]);
const INSTANCE_STYLE_KEYS = new Set<string>([
  "fill",
  "fillType",
  "fillGradient",
  "fillOpacity",
  "fillEnabled",
  "stroke",
  "strokeColor",
  "strokeWidth",
  "strokePosition",
  "strokeSides",
  "strokeSidesCustom",
  "cornerRadius",
  "cornerRadii",
  "textColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
  "content",
  "opacity",
  "blendMode",
  "arcStartDeg",
  "arcSweepDeg",
  "arcInnerRadiusRatio",
  "effects",
  "fillTokenId",
  "textStyleTokenId",
  "effectTokenId",
]);

function toLayoutNode(n: EditorNode): LayoutNode {
  return {
    id: n.id,
    type: n.type,
    parentId: n.parentId,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height,
    visible: n.visible,
    locked: n.locked,
    layoutMode: n.layoutMode,
    layoutGap: n.layoutGap,
    layoutGapAuto: n.layoutGapAuto,
    layoutWrap: n.layoutWrap,
    paddingTop: n.paddingTop,
    paddingRight: n.paddingRight,
    paddingBottom: n.paddingBottom,
    paddingLeft: n.paddingLeft,
    primaryAxisAlign: n.primaryAxisAlign,
    counterAxisAlign: n.counterAxisAlign,
    constraintsHorizontal: n.constraintsHorizontal,
    constraintsVertical: n.constraintsVertical,
    layoutSizingHorizontal: n.layoutSizingHorizontal,
    layoutSizingVertical: n.layoutSizingVertical,
    layoutPositioning: n.layoutPositioning,
    minWidth: n.minWidth,
    minHeight: n.minHeight,
    maxWidth: n.maxWidth,
    maxHeight: n.maxHeight,
    computedWidth: n.computedWidth,
    computedHeight: n.computedHeight,
    layoutDirty: n.layoutDirty,
    clipChildren: n.clipChildren,
    content: n.content,
    fontFamily: n.fontFamily,
    fontSize: n.fontSize,
    fontWeight: n.fontWeight,
    lineHeight: n.lineHeight,
    letterSpacing: n.letterSpacing,
    textResizeMode: n.textResizeMode,
  };
}

function toLayoutMap(nodes: Record<string, EditorNode>): Record<string, LayoutNode> {
  const m: Record<string, LayoutNode> = {};
  for (const id of Object.keys(nodes)) {
    m[id] = toLayoutNode(nodes[id]!);
  }
  return m;
}

function applyAutoLayoutMerge(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): Record<string, EditorNode> {
  const result = computeAutoLayout(parentId, toLayoutMap(nodes), childOrder);
  const next = { ...nodes };
  if (result.parent) {
    const pn = next[parentId];
    if (pn) {
      const parentPatch = { ...result.parent };
      const mode = pn.layoutMode ?? "none";
      if (mode === "horizontal") {
        if ((pn.layoutSizingHorizontal ?? "fixed") === "fixed") delete parentPatch.width;
        if ((pn.layoutSizingVertical ?? "fixed") === "fixed") delete parentPatch.height;
      } else if (mode === "vertical") {
        if ((pn.layoutSizingVertical ?? "fixed") === "fixed") delete parentPatch.height;
        if ((pn.layoutSizingHorizontal ?? "fixed") === "fixed") delete parentPatch.width;
      }
      next[parentId] = { ...pn, ...parentPatch };
    }
  }
  for (const [cid, p] of Object.entries(result.children)) {
    const cn = next[cid];
    if (!cn || cn.locked) continue;
    next[cid] = { ...cn, ...p };
  }
  return next;
}

function deepAutoLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentId: string,
): Record<string, EditorNode> {
  let next = applyAutoLayoutMerge(nodes, childOrder, parentId);
  const p = next[parentId];
  if (!p || (p.layoutMode ?? "none") === "none") return next;
  for (const cid of childOrder[parentId] ?? []) {
    const c = next[cid];
    if (c && (c.type === "frame" || c.type === "group") && (c.layoutMode ?? "none") !== "none") {
      next = deepAutoLayout(next, childOrder, cid);
    }
  }
  return next;
}

function mergeLayoutMapIntoNodes(
  nodes: Record<string, EditorNode>,
  layoutMap: Record<string, LayoutNode>,
): Record<string, EditorNode> {
  const next = { ...nodes };
  for (const id of Object.keys(layoutMap)) {
    const l = layoutMap[id]!;
    const e = next[id];
    if (!e) continue;
    next[id] = {
      ...e,
      x: l.x,
      y: l.y,
      width: l.width,
      height: l.height,
      computedWidth: l.computedWidth,
      computedHeight: l.computedHeight,
      layoutDirty: l.layoutDirty,
    };
  }
  return next;
}

function relayoutParentsWithAutoLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentKeys: Iterable<string>,
): Record<string, EditorNode> {
  let layoutMap = toLayoutMap(nodes);
  for (const pk of parentKeys) {
    if (pk === ROOT) continue;
    layoutMap = markLayoutDirty(layoutMap, pk);
  }
  layoutMap = relayoutDirtyTree(layoutMap, childOrder, parentKeys);
  return mergeLayoutMapIntoNodes(nodes, layoutMap);
}

function textStyleFromSelection(
  s: Pick<EditorState, "nodes" | "selectedIds" | "canvasBackgroundColor">,
) {
  for (const id of s.selectedIds) {
    const n = s.nodes[id];
    if (n?.type === "text") {
      return {
        fontFamily: n.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
        fontSize: n.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
        fontWeight: n.fontWeight ?? 500,
        lineHeight: n.lineHeight ?? 1.25,
        letterSpacing: n.letterSpacing ?? 0,
        fill: n.fill ?? "#0f172a",
        textColor: n.textColor ?? n.fill ?? "#0f172a",
      };
    }
  }
  const { defaultText } = canvasChromeForeground(s.canvasBackgroundColor);
  return {
    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
    fontSize: DEFAULT_TEXT_FONT_SIZE,
    fontWeight: 500,
    lineHeight: 1.25,
    letterSpacing: 0,
    fill: defaultText,
    textColor: defaultText,
  };
}

/** Document fields written to `.paytmcraft.json` / API — excludes UI overlays, modals, history, and transient tool state. */
export function toPersistSlice(s: EditorState): EditorPersistSlice {
  const { pages, pageOrder } = pagesWithActiveCaptured(s);
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    assets: s.assets,
    designTokens: s.designTokens,
    fileName: s.fileName,
    selectedIds: s.selectedIds,
    zoom: s.zoom,
    pan: s.pan,
    showGrid: s.showGrid,
    showRulers: s.showRulers,
    canvasBackgroundColor: s.canvasBackgroundColor,
    comments: s.comments,
    pages,
    pageOrder,
    activePageId: s.activePageId,
  };
}

function editorStateAfterDocumentImport(
  doc: PaytmCraftDocument,
  s: EditorState,
  opts?: { skipHierarchyRepair?: boolean },
): Partial<EditorState> {
  return {
    ...documentToEditorPatch(doc, opts),
    guides: [],
    layoutGuideDraft: null,
    selectedLayoutGuideId: null,
    editingTextId: null,
    hoveredCanvasId: null,
    contextMenu: null,
    layerRenameId: null,
    placingComponentMasterId: null,
    prototypeWireDrag: null,
    selectedPrototypeLinkId: null,
    prototypePreview: null,
    responsivePreview: null,
    activeCommentId: null,
    isPlacingComment: false,
    commentsPanelOpen: false,
    penDrawingNodeId: null,
    pencilDrawingNodeId: null,
    pathEditModeNodeId: null,
    shapeEditModeNodeId: null,
    transformInteractionMode: "none",
    isMovingSelection: false,
    rotateHandleHovered: false,
    rotateHandleHoverHandle: null,
    objectEditModeNodeId: null,
    selectedPathPointId: null,
    presenceUsers: [],
    showPresence: false,
    presenceActivityLog: [],
    commandMenuOpen: false,
    shortcutOverlayOpen: false,
    aiModalOpen: false,
    aiModalSource: null,
    pluginMarketplaceOpen: false,
    activePluginId: undefined,
    shareModalOpen: false,
    workspacePickerOpen: false,
    teamInviteModalOpen: false,
    apiFileId: undefined,
    apiWorkspaceId: undefined,
    isApiBackedFile: false,
    apiCommentsStatus: "idle" as ApiCommentsStatus,
    versionHistoryOpen: false,
    apiVersionsStatus: "idle" as ApiVersionsStatus,
    apiFileVersions: [],
    editorMode: "design",
    tool: "move",
    leftTab: "layers",
    documentSaveStatus: "saved",
    documentHydrating: false,
    documentHydrationRevision: s.documentHydrationRevision + 1,
    historyPast: [],
    historyFuture: [],
  };
}

function editorPartialFromPaytmCraftDocument(doc: PaytmCraftDocument, s: EditorState): Partial<EditorState> {
  const patch = documentToEditorPatch(doc);
  return {
    ...patch,
    guides: [],
    layoutGuideDraft: null,
    editingTextId: null,
    hoveredCanvasId: null,
    contextMenu: null,
    layerRenameId: null,
    placingComponentMasterId: null,
    prototypeWireDrag: null,
    selectedPrototypeLinkId: null,
    prototypePreview: null,
    responsivePreview: null,
    activeCommentId: null,
    isPlacingComment: false,
    commentsPanelOpen: false,
    penDrawingNodeId: null,
    pencilDrawingNodeId: null,
    pathEditModeNodeId: null,
    shapeEditModeNodeId: null,
    transformInteractionMode: "none",
    isMovingSelection: false,
    rotateHandleHovered: false,
    rotateHandleHoverHandle: null,
    objectEditModeNodeId: null,
    selectedPathPointId: null,
    presenceUsers: [],
    showPresence: false,
    presenceActivityLog: [],
    commandMenuOpen: false,
    shortcutOverlayOpen: false,
    aiModalOpen: false,
    aiModalSource: null,
    pluginMarketplaceOpen: false,
    activePluginId: undefined,
    shareModalOpen: false,
    workspacePickerOpen: false,
    teamInviteModalOpen: false,
    apiFileId: s.apiFileId,
    apiWorkspaceId: s.apiWorkspaceId,
    isApiBackedFile: s.isApiBackedFile,
    apiCommentsStatus: s.apiCommentsStatus,
    versionHistoryOpen: false,
    apiVersionsStatus: "idle" as ApiVersionsStatus,
    apiFileVersions: [],
    documentSaveStatus: "saved",
    documentHydrationRevision: s.documentHydrationRevision + 1,
    historyPast: [],
    historyFuture: [],
  };
}

function buildClipboardPayloadFromState(
  s: Pick<EditorState, "nodes" | "childOrder" | "assets">,
  tops: string[],
): EditorClipboardPayloadV1 | null {
  if (!tops.length) return null;
  const nodeIds = new Set<string>();
  for (const r of tops) {
    for (const id of collectSubtreeIds(r, s.childOrder)) nodeIds.add(id);
  }
  const nodes: Record<string, EditorNode> = {};
  const childOrder: Record<string, string[]> = {};
  for (const id of nodeIds) {
    const n = s.nodes[id];
    if (!n) continue;
    nodes[id] = JSON.parse(JSON.stringify(n)) as EditorNode;
    childOrder[id] = [...(s.childOrder[id] ?? [])];
  }
  const assets: Record<string, EditorAsset> = {};
  for (const id of nodeIds) {
    const n = s.nodes[id];
    if (n?.type === "image" && n.assetId) {
      const a = s.assets[n.assetId];
      if (a) assets[n.assetId] = JSON.parse(JSON.stringify(a)) as EditorAsset;
    }
  }
  return {
    version: 1,
    rootIds: tops,
    nodes,
    childOrder,
    assets: Object.keys(assets).length ? assets : undefined,
  };
}

function firstVisibleUnlockedRootFrameId(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
): string | null {
  for (const id of childOrder[ROOT] ?? []) {
    const n = nodes[id];
    if (n?.type === "frame" && n.visible && !n.locked) return id;
  }
  return null;
}

/** Single selected frame → paste inside it; otherwise canvas root. */
function resolvePasteParentId(s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">): string | null {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length === 1) {
    const n = s.nodes[tops[0]!];
    if (n?.type === "frame") return tops[0]!;
  }
  return null;
}

function pageSwitchUiReset(): Partial<EditorState> {
  return {
    guides: [],
    layoutGuideDraft: null,
    editingTextId: null,
    hoveredCanvasId: null,
    contextMenu: null,
    layerRenameId: null,
    placingComponentMasterId: null,
    prototypeWireDrag: null,
    selectedPrototypeLinkId: null,
    prototypePreview: null,
    responsivePreview: null,
    activeCommentId: null,
    isPlacingComment: false,
    penDrawingNodeId: null,
    pencilDrawingNodeId: null,
    pathEditModeNodeId: null,
  objectEditModeNodeId: null,
    selectedPathPointId: null,
    historyPast: [],
    historyFuture: [],
  };
}

export const useEditorStore = create<EditorState>((set, get) => {
  // Always seed empty on first paint so SSR and client markup match; local doc loads in EditorDocumentPersistence.
  const initialDoc = createEmptyDocumentFields();

  return {
  tool: "move",
  framePresetId: DEFAULT_FRAME_PRESET_ID,
  editorMode: "design",
  leftTab: "layers",
  rightPanelTab: "design",
  codePanelFormat: "html",
  selectedIds: initialDoc.selectedIds,
  zoom: initialDoc.zoom,
  pan: initialDoc.pan,
  nodes: initialDoc.nodes,
  childOrder: initialDoc.childOrder,
  pages: initialDoc.pages,
  pageOrder: initialDoc.pageOrder,
  activePageId: initialDoc.activePageId,
  assets: initialDoc.assets,
  designTokens: initialDoc.designTokens,
  guides: [],
  dragMeasurements: [],
  swapDragIndicator: null,
  autoLayoutReorderIndicator: null,
  layoutGuides: initialDoc.pages[initialDoc.activePageId]?.layoutGuides ?? [],
  layoutGuideDraft: null,
  selectedLayoutGuideId: null,
  fileName: initialDoc.fileName,
  showGrid: initialDoc.showGrid,
  showRulers: initialDoc.showRulers ?? true,
  canvasBackgroundColor: initialDoc.canvasBackgroundColor,
  comments: initialDoc.comments,
  commentsPanelOpen: false,
  activeCommentId: null,
  isPlacingComment: false,
  penDrawingNodeId: null,
  pencilDrawingNodeId: null,
  pencilStrokeWidth: 2,
  pathEditModeNodeId: null,
  shapeEditModeNodeId: null,
  transformInteractionMode: "none",
  isMovingSelection: false,
  rotateHandleHovered: false,
  rotateHandleHoverHandle: null,
  objectEditModeNodeId: null,
  selectedPathPointId: null,
  editingTextId: null,
  textEditSelection: null,
  hoveredCanvasId: null,
  contextMenu: null,
  layerRenameId: null,
  placingComponentMasterId: null,
  prototypeWireDrag: null,
  selectedPrototypeLinkId: null,
  prototypePreview: null,
  responsivePreview: null,
  documentSaveStatus: "saved",
  documentHydrating: false,
  documentHydrationRevision: 0,
  apiFileId: undefined,
  apiWorkspaceId: undefined,
  isApiBackedFile: false,
  apiCommentsStatus: "idle" as ApiCommentsStatus,
  versionHistoryOpen: false,
  apiVersionsStatus: "idle" as ApiVersionsStatus,
  apiFileVersions: [],
  historyPast: [],
  historyFuture: [],
  isApplyingHistory: false,

  presenceUsers: [],
  showPresence: false,
  presenceActivityLog: [],

  togglePresence: () =>
    set((s) => {
      const next = !s.showPresence;
      if (next) {
        return { showPresence: true, presenceUsers: [], presenceActivityLog: [] };
      }
      return { showPresence: false, presenceUsers: [], presenceActivityLog: [] };
    }),

  updateMockPresence: (users) => set({ presenceUsers: users }),

  setPresenceUsers: (users) => set({ presenceUsers: users }),

  clearPresence: () => set({ presenceUsers: [], presenceActivityLog: [] }),

  appendPresenceActivity: (text) =>
    set((s) => ({
      presenceActivityLog: [
        {
          id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text,
          at: new Date().toISOString(),
        },
        ...s.presenceActivityLog,
      ].slice(0, 48),
    })),

  commandMenuOpen: false,
  shortcutOverlayOpen: false,
  uiChromeVisible: true,
  setCommandMenuOpen: (open) =>
    set(() => ({
      commandMenuOpen: open,
      ...(open
        ? {
            shortcutOverlayOpen: false,
            pluginMarketplaceOpen: false,
            activePluginId: undefined,
            shareModalOpen: false,
            workspacePickerOpen: false,
            teamInviteModalOpen: false,
          }
        : {}),
    })),
  setShortcutOverlayOpen: (open) =>
    set(() => ({
      shortcutOverlayOpen: open,
      ...(open
        ? {
            commandMenuOpen: false,
            pluginMarketplaceOpen: false,
            activePluginId: undefined,
            shareModalOpen: false,
            workspacePickerOpen: false,
            teamInviteModalOpen: false,
          }
        : {}),
    })),

  toggleUiChrome: () => set((s) => ({ uiChromeVisible: !s.uiChromeVisible })),
  setUiChromeVisible: (visible) => set({ uiChromeVisible: visible }),

  aiModalOpen: false,
  aiModalSource: null,
  openAIModal: (source) =>
    set(() => ({
      aiModalOpen: true,
      aiModalSource: source,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
    })),
  closeAIModal: () => set({ aiModalOpen: false, aiModalSource: null }),

  importHubOpen: false,
  importWebModalOpen: false,
  importFigmaModalOpen: false,
  figImportInProgress: false,
  figImportStatus: null,
  figImportToast: null,
  setFigImportToast: (message) => set({ figImportToast: message }),
  codeRoundTripOpen: false,
  codeRoundTripTab: "export",
  codeRoundTripSourceHeader: null,
  setCodeRoundTripSourceHeader: (header) => set({ codeRoundTripSourceHeader: header }),
  openImportHub: () =>
    set(() => ({
      importHubOpen: true,
      importWebModalOpen: false,
      importFigmaModalOpen: false,
      codeRoundTripOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
    })),
  closeImportHub: () => set({ importHubOpen: false }),
  openImportWebModal: () =>
    set(() => ({
      importHubOpen: false,
      importWebModalOpen: true,
      importFigmaModalOpen: false,
      codeRoundTripOpen: false,
    })),
  closeImportWebModal: () => set({ importWebModalOpen: false }),
  openImportFigmaModal: () =>
    set(() => ({
      importHubOpen: false,
      importWebModalOpen: false,
      importFigmaModalOpen: true,
      codeRoundTripOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
    })),
  closeImportFigmaModal: () => set({ importFigmaModalOpen: false }),
  openCodeRoundTrip: (tab = "export") =>
    set(() => ({
      codeRoundTripOpen: true,
      codeRoundTripTab: tab,
      importHubOpen: false,
      importWebModalOpen: false,
      importFigmaModalOpen: false,
      commandMenuOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
    })),
  closeCodeRoundTrip: () => set({ codeRoundTripOpen: false }),

  pluginMarketplaceOpen: false,
  installedPluginIds: readInstalledPluginIds(),
  activePluginId: undefined,
  shareModalOpen: false,
  workspacePickerOpen: false,
  teamInviteModalOpen: false,

  openShareModal: () =>
    set(() => ({
      shareModalOpen: true,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
    })),
  closeShareModal: () => set({ shareModalOpen: false }),

  openWorkspacePicker: () =>
    set(() => ({
      workspacePickerOpen: true,
      shareModalOpen: false,
      teamInviteModalOpen: false,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
    })),
  closeWorkspacePicker: () => set({ workspacePickerOpen: false }),

  openTeamInviteModal: () =>
    set(() => ({
      teamInviteModalOpen: true,
      shareModalOpen: false,
      workspacePickerOpen: false,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
    })),
  closeTeamInviteModal: () => set({ teamInviteModalOpen: false }),

  openPluginMarketplace: () =>
    set(() => ({
      pluginMarketplaceOpen: true,
      activePluginId: undefined,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
    })),
  closePluginMarketplace: () => set({ pluginMarketplaceOpen: false }),

  installPlugin: (id) => {
    if (!getPluginById(id)) return;
    set((s) => {
      if (s.installedPluginIds.includes(id)) return s;
      const next = [...s.installedPluginIds, id];
      writeInstalledPluginIds(next);
      return { installedPluginIds: next };
    });
  },

  uninstallPlugin: (id) => {
    set((s) => {
      const next = s.installedPluginIds.filter((x) => x !== id);
      writeInstalledPluginIds(next);
      return {
        installedPluginIds: next,
        activePluginId: s.activePluginId === id ? undefined : s.activePluginId,
      };
    });
  },

  runPlugin: (id) => {
    const s = get();
    if (!s.installedPluginIds.includes(id) || !getPluginById(id)) return;
    set({
      activePluginId: id,
      pluginMarketplaceOpen: false,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
    });
  },

  closeActivePlugin: () => set({ activePluginId: undefined }),

  applyPluginLoremIpsumToSelection: () => {
    const s0 = get();
    const textIds = s0.selectedIds.filter((id) => {
      const n = s0.nodes[id];
      return n?.type === "text" && !n.locked;
    });
    if (textIds.length === 0) return;
    const lorem =
      "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.";
    get().pushHistory();
    set((s) => {
      const nodes = { ...s.nodes };
      for (const id of textIds) {
        const n = nodes[id];
        if (!n || n.type !== "text" || n.locked) continue;
        nodes[id] = { ...n, content: lorem };
      }
      return { nodes };
    });
  },

  applyPluginRenameSelection: () => {
    const s0 = get();
    const tops = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked;
    });
    if (tops.length === 0) return;
    const label: Record<NodeKind, string> = {
      frame: "Screen",
      group: "Group",
      rectangle: "Card",
      ellipse: "Badge",
      line: "Divider",
      arrow: "Arrow",
      polygon: "Polygon",
      path: "Vector",
      text: "Label",
      image: "Image",
    };
    get().pushHistory();
    set((s) => {
      const tops2 = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked;
      });
      if (tops2.length === 0) return s;
      const counts = new Map<NodeKind, number>();
      const nodes = { ...s.nodes };
      for (const id of tops2) {
        const n = nodes[id];
        if (!n) continue;
        const c = (counts.get(n.type) ?? 0) + 1;
        counts.set(n.type, c);
        const base = label[n.type] ?? "Layer";
        const name = c > 1 ? `${base} ${c}` : base;
        nodes[id] = { ...n, name };
      }
      return { nodes };
    });
  },

  applyPluginIconInSelection: () => {
    const s0 = get();
    const frameId = resolveFrameParentForPlugin(s0);
    if (!frameId) return;
    const frame = s0.nodes[frameId];
    if (!frame || frame.locked) return;
    get().pushHistory();
    set((s) => {
      const frameId2 = resolveFrameParentForPlugin(s);
      if (!frameId2) return s;
      const frame2 = s.nodes[frameId2];
      if (!frame2 || frame2.locked) return s;
      const gid = `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const pathId = `path-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const pts: PathPoint[] = [
        { id: newPathPointId(), x: 32, y: 4 },
        { id: newPathPointId(), x: 56, y: 56 },
        { id: newPathPointId(), x: 32, y: 40 },
        { id: newPathPointId(), x: 8, y: 56 },
      ];
      let pathNode: EditorNode = {
        id: pathId,
        parentId: gid,
        type: "path",
        name: "Mark",
        x: 0,
        y: 0,
        width: 64,
        height: 64,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        pathPoints: pts,
        pathClosed: true,
        fill: DEFAULT_SHAPE_FILL,
        fillEnabled: true,
        fillOpacity: 1,
        strokeColor: DEFAULT_SHAPE_STROKE,
        strokeWidth: 1.5,
        strokePosition: "center",
      };
      pathNode = normalizePathNode(pathNode);
      const nodes: Record<string, EditorNode> = { ...s.nodes };
      nodes[pathId] = pathNode;
      nodes[gid] = {
        id: gid,
        parentId: frameId2,
        type: "group",
        name: "Plugin icon",
        x: 88,
        y: 140,
        width: pathNode.width,
        height: pathNode.height,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      };
      const childOrder = { ...s.childOrder, [gid]: [pathId] };
      const order = [...(childOrder[frameId2] ?? [])];
      order.push(gid);
      childOrder[frameId2] = order;
      let nodesOut = nodes;
      nodesOut = relayoutParentsWithAutoLayout(nodesOut, childOrder, [frameId2]);
      return {
        nodes: nodesOut,
        childOrder,
        selectedIds: [gid],
        tool: "move",
        editingTextId: null,
      };
    });
  },

  clearHistory: () => set({ historyPast: [], historyFuture: [] }),

  pushHistory: (_label) => {
    const s = get();
    if (s.isApplyingHistory) return;
    const snap = editorStateToHistorySnapshot({
      fileName: s.fileName,
      nodes: s.nodes,
      childOrder: s.childOrder,
      assets: s.assets,
      designTokens: s.designTokens,
      selectedIds: s.selectedIds,
      zoom: s.zoom,
      pan: s.pan,
      showGrid: s.showGrid,
      showRulers: s.showRulers,
      canvasBackgroundColor: s.canvasBackgroundColor,
      comments: s.comments,
      layoutGuides: s.layoutGuides,
    });
    const MAX = 150;
    const nextPast = [...s.historyPast, snap];
    const trimmed = nextPast.length > MAX ? nextPast.slice(nextPast.length - MAX) : nextPast;
    set({ historyPast: trimmed, historyFuture: [] });
  },

  undo: () => {
    const s = get();
    if (s.isApplyingHistory || s.historyPast.length === 0) return;
    const prevSnap = s.historyPast[s.historyPast.length - 1]!;
    const currentSnap = editorStateToHistorySnapshot({
      fileName: s.fileName,
      nodes: s.nodes,
      childOrder: s.childOrder,
      assets: s.assets,
      designTokens: s.designTokens,
      selectedIds: s.selectedIds,
      zoom: s.zoom,
      pan: s.pan,
      showGrid: s.showGrid,
      showRulers: s.showRulers,
      canvasBackgroundColor: s.canvasBackgroundColor,
      comments: s.comments,
      layoutGuides: s.layoutGuides,
    });
    const patch = historySnapshotToEditorPatch(prevSnap);
    set((s) => {
      const merged = {
        isApplyingHistory: true,
        ...patch,
        historyPast: s.historyPast.slice(0, -1),
        historyFuture: [clonePersistedEditorSnapshot(currentSnap), ...s.historyFuture],
        contextMenu: null,
        editingTextId: null,
        layerRenameId: null,
        hoveredCanvasId: null,
        prototypeWireDrag: null,
        placingComponentMasterId: null,
        selectedPrototypeLinkId: null,
        guides: [],
        activeCommentId: null,
        isPlacingComment: false,
        penDrawingNodeId: null,
        pencilDrawingNodeId: null,
        pathEditModeNodeId: null,
  objectEditModeNodeId: null,
        selectedPathPointId: null,
        responsivePreview: null,
      };
      return {
        ...merged,
        ...syncActivePageRecord({ ...s, ...merged }),
      };
    });
    set({ isApplyingHistory: false });
  },

  redo: () => {
    const s = get();
    if (s.isApplyingHistory || s.historyFuture.length === 0) return;
    const nextSnap = s.historyFuture[0]!;
    const currentSnap = editorStateToHistorySnapshot({
      fileName: s.fileName,
      nodes: s.nodes,
      childOrder: s.childOrder,
      assets: s.assets,
      designTokens: s.designTokens,
      selectedIds: s.selectedIds,
      zoom: s.zoom,
      pan: s.pan,
      showGrid: s.showGrid,
      showRulers: s.showRulers,
      canvasBackgroundColor: s.canvasBackgroundColor,
      comments: s.comments,
      layoutGuides: s.layoutGuides,
    });
    const patch = historySnapshotToEditorPatch(nextSnap);
    set((s) => {
      const merged = {
        isApplyingHistory: true,
        ...patch,
        historyFuture: s.historyFuture.slice(1),
        historyPast: [...s.historyPast, clonePersistedEditorSnapshot(currentSnap)],
        contextMenu: null,
        editingTextId: null,
        layerRenameId: null,
        hoveredCanvasId: null,
        prototypeWireDrag: null,
        placingComponentMasterId: null,
        selectedPrototypeLinkId: null,
        guides: [],
        activeCommentId: null,
        isPlacingComment: false,
        penDrawingNodeId: null,
        pencilDrawingNodeId: null,
        pathEditModeNodeId: null,
  objectEditModeNodeId: null,
        selectedPathPointId: null,
        responsivePreview: null,
      };
      return {
        ...merged,
        ...syncActivePageRecord({ ...s, ...merged }),
      };
    });
    set({ isApplyingHistory: false });
  },

  setEditingTextId: (editingTextId) => {
    const prev = get().editingTextId;
    if (editingTextId && !prev) get().pushHistory();
    set((s) => {
      if (!editingTextId) {
        return { editingTextId: null, textEditSelection: null };
      }
      const node = s.nodes[editingTextId];
      const len = node?.type === "text" ? (node.content?.length ?? 0) : 0;
      return {
        editingTextId,
        textEditSelection: { anchor: len, focus: len },
      };
    });
  },

  setTextEditSelection: (anchor, focus) => set({ textEditSelection: { anchor, focus } }),
  setHoveredCanvasId: (hoveredCanvasId) => set({ hoveredCanvasId }),
  setPlacingComponentMasterId: (placingComponentMasterId) => set({ placingComponentMasterId }),
  openContextMenu: (nodeId, clientX, clientY) =>
    set((s) => {
      const nextSel = s.selectedIds.includes(nodeId) ? s.selectedIds : [nodeId];
      return {
        contextMenu: { nodeId, clientX, clientY },
        selectedIds: nextSel,
        layerRenameId: null,
      };
    }),
  closeContextMenu: () => set({ contextMenu: null }),
  setLayerRenameId: (layerRenameId) => set({ layerRenameId }),

  setTool: (tool) => {
    const before = get();
    clearPostCreationPointerSuppress();
    if (before.tool === "pen" && tool !== "pen" && before.penDrawingNodeId) {
      get().cancelPath();
    }
    if (before.pencilDrawingNodeId && tool !== "pencil") {
      get().cancelPencilStroke();
    }
    if (tool === "pencil") {
      clearPostCreationPointerSuppress();
    }
    const enteringCreation =
      before.editorMode === "design" &&
      isCanvasBgCreationTool(tool, before.editorMode, {
        isPlacingComment: tool === "comment",
      });
    set((s) => {
      if (s.editorMode === "inspect" && tool !== "move" && tool !== "hand") return s;
      if (tool === "comment") {
        return {
          tool: "comment",
          placingComponentMasterId: null,
          isPlacingComment: true,
          activeCommentId: null,
          rotateHandleHovered: false,
          rotateHandleHoverHandle: null,
          ...(enteringCreation ? { shapeEditModeNodeId: null, pathEditModeNodeId: null } : {}),
        };
      }
      return {
        tool,
        placingComponentMasterId: tool === "move" ? s.placingComponentMasterId : null,
        isPlacingComment: false,
        activeCommentId: null,
        rotateHandleHovered: false,
        rotateHandleHoverHandle: null,
        ...(enteringCreation ? { shapeEditModeNodeId: null, pathEditModeNodeId: null } : {}),
      };
    });
  },
  setFramePresetId: (framePresetId) => set({ framePresetId }),
  setEditorMode: (editorMode) =>
    set((s) => ({
      editorMode,
      tool: editorMode === "prototype" || editorMode === "inspect" ? "move" : s.tool,
      placingComponentMasterId:
        editorMode === "prototype" || editorMode === "inspect" ? null : s.placingComponentMasterId,
      selectedPrototypeLinkId: editorMode === "prototype" ? s.selectedPrototypeLinkId : null,
      isPlacingComment: false,
      activeCommentId: null,
      penDrawingNodeId:
        editorMode === "prototype" || editorMode === "inspect" ? null : s.penDrawingNodeId,
      pencilDrawingNodeId:
        editorMode === "prototype" || editorMode === "inspect" ? null : s.pencilDrawingNodeId,
      pathEditModeNodeId:
        editorMode === "prototype" || editorMode === "inspect" ? null : s.pathEditModeNodeId,
      selectedPathPointId:
        editorMode === "prototype" || editorMode === "inspect" ? null : s.selectedPathPointId,
      commentsPanelOpen:
        editorMode === "prototype" || editorMode === "inspect" ? false : s.commentsPanelOpen,
    })),
  setRightTab: (editorMode) => set({ editorMode }),
  setLeftTab: (leftTab) => set({ leftTab }),
  setRightPanelTab: (rightPanelTab) => set({ rightPanelTab }),
  setCodePanelFormat: (codePanelFormat) => set({ codePanelFormat }),

  startPrototypeConnection: (sourceNodeId, pointerId, curWX, curWY) =>
    set({ prototypeWireDrag: { sourceNodeId, pointerId, curWX, curWY }, selectedPrototypeLinkId: null }),

  updatePrototypeWirePointer: (curWX, curWY) =>
    set((s) => {
      const w = s.prototypeWireDrag;
      if (!w) return s;
      return { prototypeWireDrag: { ...w, curWX, curWY } };
    }),

  finishPrototypeConnection: (targetFrameId) => {
    const s0 = get();
    const w = s0.prototypeWireDrag;
    if (!w) return;
    if (!targetFrameId) {
      set({ prototypeWireDrag: null });
      return;
    }
    const src = s0.nodes[w.sourceNodeId];
    const tgt = s0.nodes[targetFrameId];
    if (!src || !tgt || tgt.type !== "frame") {
      set({ prototypeWireDrag: null });
      return;
    }
    if (isAncestorOf(s0.nodes, w.sourceNodeId, targetFrameId)) {
      set({ prototypeWireDrag: null });
      return;
    }
    get().pushHistory();
    set((s) => {
      const w2 = s.prototypeWireDrag;
      if (!w2) return { prototypeWireDrag: null };
      const link = defaultPrototypeLink(w2.sourceNodeId, targetFrameId);
      const srcNode = s.nodes[w2.sourceNodeId];
      if (!srcNode) return { prototypeWireDrag: null };
      const prevLinks = srcNode.prototypeLinks ?? [];
      const nodes = {
        ...s.nodes,
        [w2.sourceNodeId]: { ...srcNode, prototypeLinks: [...prevLinks, link] },
      };
      return {
        nodes,
        prototypeWireDrag: null,
        selectedPrototypeLinkId: link.id,
        selectedIds: [w2.sourceNodeId],
      };
    });
  },

  cancelPrototypeConnection: () => set({ prototypeWireDrag: null }),

  updatePrototypeLink: (linkId, patch) => {
    const s0 = get();
    const own = findPrototypeLinkOwner(s0.nodes, linkId);
    if (!own) return;
    get().pushHistory();
    set((s) => {
      const own2 = findPrototypeLinkOwner(s.nodes, linkId);
      if (!own2) return s;
      const node = s.nodes[own2.ownerId]!;
      const arr = [...(node.prototypeLinks ?? [])];
      const cur = arr[own2.index]!;
      const next: PrototypeLink = { ...cur, ...patch, id: cur.id, sourceNodeId: cur.sourceNodeId };
      arr[own2.index] = next;
      return { nodes: { ...s.nodes, [own2.ownerId]: { ...node, prototypeLinks: arr } } };
    });
  },

  deletePrototypeLink: (linkId) => {
    const s0 = get();
    const own = findPrototypeLinkOwner(s0.nodes, linkId);
    if (!own) return;
    get().pushHistory();
    set((s) => {
      const own2 = findPrototypeLinkOwner(s.nodes, linkId);
      if (!own2) return s;
      const node = s.nodes[own2.ownerId]!;
      const arr = (node.prototypeLinks ?? []).filter((l) => l.id !== linkId);
      const nextNode: EditorNode = { ...node, prototypeLinks: arr.length ? arr : undefined };
      return {
        nodes: { ...s.nodes, [own2.ownerId]: nextNode },
        selectedPrototypeLinkId: s.selectedPrototypeLinkId === linkId ? null : s.selectedPrototypeLinkId,
      };
    });
  },

  setSelectedPrototypeLinkId: (selectedPrototypeLinkId) => set({ selectedPrototypeLinkId }),

  openPrototypePreview: (startFrameId) =>
    set((s) => {
      let fid =
        startFrameId && s.nodes[startFrameId]?.type === "frame" && s.nodes[startFrameId]?.visible
          ? startFrameId
          : null;
      if (!fid && s.selectedIds.length) {
        const sel = s.selectedIds.find((id) => s.nodes[id]?.type === "frame" && s.nodes[id]?.visible);
        if (sel) fid = sel;
      }
      if (!fid) {
        const roots = s.childOrder[ROOT] ?? [];
        fid =
          roots.map((id) => s.nodes[id]).find((n) => n?.type === "frame" && n.visible)?.id ?? null;
      }
      if (!fid) return s;
      return {
        prototypePreview: { mainFrameId: fid, history: [], overlayFrameId: null },
      };
    }),

  closePrototypePreview: () => set({ prototypePreview: null }),

  navigatePrototype: (targetFrameId, asOverlay) =>
    set((s) => {
      const pv = s.prototypePreview;
      if (!pv || !s.nodes[targetFrameId] || s.nodes[targetFrameId]!.type !== "frame") return s;
      if (asOverlay) {
        return {
          prototypePreview: {
            ...pv,
            overlayFrameId: targetFrameId,
          },
        };
      }
      return {
        prototypePreview: {
          mainFrameId: targetFrameId,
          history: [...pv.history, pv.mainFrameId],
          overlayFrameId: null,
        },
      };
    }),

  prototypePreviewBack: () =>
    set((s) => {
      const pv = s.prototypePreview;
      if (!pv) return s;
      if (pv.overlayFrameId) {
        return { prototypePreview: { ...pv, overlayFrameId: null } };
      }
      const hist = [...pv.history];
      const prev = hist.pop();
      if (prev == null) return s;
      return {
        prototypePreview: {
          ...pv,
          mainFrameId: prev,
          history: hist,
        },
      };
    }),

  select: (id, additive) =>
    set((s) => {
      if (!id)
        return {
          selectedIds: [],
          selectedLayoutGuideId: null,
          selectedPrototypeLinkId: null,
          pathEditModeNodeId: null,
          shapeEditModeNodeId: null,
          objectEditModeNodeId: null,
          selectedPathPointId: null,
        };
      if (additive) {
        const has = s.selectedIds.includes(id);
        return {
          selectedIds: has ? s.selectedIds.filter((x) => x !== id) : [...s.selectedIds, id],
          selectedLayoutGuideId: null,
          selectedPrototypeLinkId: null,
          pathEditModeNodeId: null,
          shapeEditModeNodeId: null,
          objectEditModeNodeId: null,
          selectedPathPointId: null,
        };
      }
      const preserveObjectEdit =
        Boolean(
          s.objectEditModeNodeId &&
            id &&
            isAncestorOf(s.nodes, s.objectEditModeNodeId, id),
        );
      return {
        selectedIds: [id],
        selectedLayoutGuideId: null,
        selectedPrototypeLinkId: null,
        pathEditModeNodeId: null,
        shapeEditModeNodeId: null,
        objectEditModeNodeId: preserveObjectEdit ? s.objectEditModeNodeId : null,
        selectedPathPointId: null,
      };
    }),

  clearSelection: () =>
    set((s) => {
      const next = {
        selectedIds: [] as string[],
        selectedLayoutGuideId: null,
        editingTextId: null,
        hoveredCanvasId: null,
        contextMenu: null,
        layerRenameId: null,
        placingComponentMasterId: null,
        selectedPrototypeLinkId: null,
        pathEditModeNodeId: null,
        shapeEditModeNodeId: null,
        objectEditModeNodeId: null,
        selectedPathPointId: null,
        prototypeWireDrag: null,
      };
      return { ...next, ...syncActivePageRecord({ ...s, ...next }) };
    }),

  selectLayoutGuide: (id) =>
    set({
      selectedLayoutGuideId: id,
      selectedIds: [],
      editingTextId: null,
      hoveredCanvasId: null,
      contextMenu: null,
      selectedPrototypeLinkId: null,
      pathEditModeNodeId: null,
      objectEditModeNodeId: null,
      selectedPathPointId: null,
      prototypeWireDrag: null,
    }),

  removeLayoutGuide: (id) => {
    get().pushHistory();
    set((state) => {
      const layoutGuides = state.layoutGuides.filter((g) => g.id !== id);
      const next = {
        ...state,
        layoutGuides,
        selectedLayoutGuideId:
          state.selectedLayoutGuideId === id ? null : state.selectedLayoutGuideId,
      };
      return { layoutGuides, selectedLayoutGuideId: next.selectedLayoutGuideId, ...syncActivePageRecord(next) };
    });
  },

  updateLayoutGuidePosition: (id, pos, opts) => {
    if (!opts?.skipHistory) get().pushHistory();
    set((state) => {
      const layoutGuides = state.layoutGuides.map((g) =>
        g.id === id ? { ...g, pos } : g,
      );
      const next = { ...state, layoutGuides };
      return { layoutGuides, ...syncActivePageRecord(next) };
    });
  },

  setZoom: (zoom) => set({ zoom: clampCanvasZoom(zoom) }),
  setPan: (pan) => set({ pan }),
  patchPan: (d) => set((s) => ({ pan: { x: s.pan.x + d.x, y: s.pan.y + d.y } })),

  updateNode: (id, patch, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const pre = get();
      const n0 = pre.nodes[id];
      if (n0 && !n0.locked) get().pushHistory();
    }
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked) return s;
      const patchForApply =
        s.transformInteractionMode === "rotate" && patch.rotation != null
          ? { rotation: patch.rotation }
          : patch;
      const instRoot = findInstanceRoot(s.nodes, id);
      let nodes = { ...s.nodes };
      const stylePart: Partial<EditorNode> = {};
      const directPart: Partial<EditorNode> = {};

      const layoutBase =
        n.type === "text" && instRoot && instRoot !== id
          ? mergeInstanceOverrides(n, s.nodes)
          : n;
      const layoutAwarePatch =
        n.type === "text" ? withTextLayoutPatch(layoutBase, patchForApply) : patchForApply;

      if (instRoot && instRoot !== id) {
        for (const k of Object.keys(layoutAwarePatch)) {
          const v = layoutAwarePatch[k as keyof typeof layoutAwarePatch];
          if (INSTANCE_STYLE_KEYS.has(k)) {
            (stylePart as Record<string, unknown>)[k] = v;
          } else {
            (directPart as Record<string, unknown>)[k] = v;
          }
        }
        if (Object.keys(stylePart).length > 0) {
          const root = nodes[instRoot]!;
          const io: Record<string, Record<string, unknown>> = { ...(root.instanceOverrides ?? {}) };
          const prev =
            io[id] && typeof io[id] === "object" && !Array.isArray(io[id])
              ? { ...(io[id] as Record<string, unknown>) }
              : {};
          io[id] = { ...prev, ...stylePart };
          nodes[instRoot] = { ...root, instanceOverrides: io };
        }
      } else {
        Object.assign(directPart, layoutAwarePatch);
      }

      if (Object.keys(directPart).length > 0) {
        nodes[id] = { ...n, ...directPart };
      }

      let merged = nodes[id]!;
      if (merged.type === "line" || merged.type === "arrow") {
        const endpointTouched =
          layoutAwarePatch.lineX1 != null ||
          layoutAwarePatch.lineY1 != null ||
          layoutAwarePatch.lineX2 != null ||
          layoutAwarePatch.lineY2 != null;
        const boxTouched =
          layoutAwarePatch.x != null ||
          layoutAwarePatch.y != null ||
          layoutAwarePatch.width != null ||
          layoutAwarePatch.height != null ||
          layoutAwarePatch.rotation != null;
        if (endpointTouched) {
          const ep = lineEndpointsFromNode(merged);
          nodes[id] = { ...merged, ...linePatchFromEndpoints(ep.x1, ep.y1, ep.x2, ep.y2, merged) };
        } else if (boxTouched) {
          nodes[id] = { ...merged, ...lineEndpointsPatchFromLayout(merged) };
        }
        merged = nodes[id]!;
      }
      if (merged.type === "polygon") {
        const touchesSides =
          layoutAwarePatch.polygonSides != null || layoutAwarePatch.cornerRadius != null;
        const touchesBox =
          layoutAwarePatch.width != null ||
          layoutAwarePatch.height != null ||
          layoutAwarePatch.x != null ||
          layoutAwarePatch.y != null;
        if (touchesSides || touchesBox) {
          nodes[id] = {
            ...merged,
            ...polygonGeometryPatch(merged, {
              polygonSides: layoutAwarePatch.polygonSides ?? merged.polygonSides,
              cornerRadius: layoutAwarePatch.cornerRadius ?? merged.cornerRadius,
            }),
          };
          merged = nodes[id]!;
        }
      }
      const keys = Object.keys(layoutAwarePatch);
      const layoutSelf =
        (merged.type === "frame" || merged.type === "group") &&
        keys.some((k) => LAYOUT_FIELD_KEYS.has(k));
      const positionGeom = keys.some((k) => GEOM_KEYS.has(k));
      const rotationOnly =
        layoutAwarePatch.rotation != null &&
        keys.every((k) => k === "rotation" || k === "x" || k === "y");
      const geom = positionGeom || layoutAwarePatch.rotation != null;
      const refresh = new Set<string>();
      if (layoutSelf) refresh.add(id);
      if (positionGeom && !rotationOnly) {
        if (merged.parentId) refresh.add(merged.parentId);
        if ((merged.type === "frame" || merged.type === "group") && (merged.layoutMode ?? "none") !== "none") {
          refresh.add(id);
        }
      }
      if (
        n.type === "text" &&
        patchAffectsTextLayout(patch) &&
        (layoutAwarePatch.width != null || layoutAwarePatch.height != null) &&
        n.parentId
      ) {
        refresh.add(n.parentId);
      }
      if (positionGeom && !rotationOnly) {
        const parent = merged.parentId ? nodes[merged.parentId] : undefined;
        if (parent && (isMaskGroup(parent) || isBooleanGroup(parent))) {
          nodes = syncGroupFrameToVisible(parent.id, nodes, s.childOrder);
        } else if (
          (isMaskGroup(merged) && merged.maskId) ||
          isBooleanGroup(merged)
        ) {
          nodes = syncGroupFrameToVisible(id, nodes, s.childOrder);
        }
      }
      if (!rotationOnly) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, refresh);
      }
      if (geom) {
        warnInvalidNodeGeometry("updateNode", id, nodes[id] ?? merged, nodes);
      }
      return { nodes };
    });
  },

  updateNodes: (patches, opts) => {
    const ids = Object.keys(patches);
    if (ids.length === 0) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const pre = get();
      if (ids.some((id) => pre.nodes[id] && !pre.nodes[id]!.locked)) get().pushHistory();
    }
    set((s) => {
      let nodes = { ...s.nodes };
      const refresh = new Set<string>();
      let changed = false;
      let rotationOnlyBatch = true;
      for (const id of ids) {
        const n = nodes[id];
        const patch = patches[id];
        if (!n || !patch || n.locked) continue;
        const patchForApply =
          s.transformInteractionMode === "rotate" && patch.rotation != null
            ? { rotation: patch.rotation }
            : patch;
        const layoutAwarePatch = n.type === "text" ? withTextLayoutPatch(n, patchForApply) : patchForApply;
        nodes[id] = { ...n, ...layoutAwarePatch };
        changed = true;
        const keys = Object.keys(layoutAwarePatch);
        const rotationOnly =
          layoutAwarePatch.rotation != null &&
          keys.every((k) => k === "rotation" || k === "x" || k === "y");
        if (!rotationOnly) rotationOnlyBatch = false;
        const layoutSelf =
          (n.type === "frame" || n.type === "group") &&
          keys.some((k) => LAYOUT_FIELD_KEYS.has(k));
        const positionGeom = keys.some((k) => GEOM_KEYS.has(k));
        if (layoutSelf) refresh.add(id);
        if (positionGeom && !rotationOnly) {
          if (n.parentId) refresh.add(n.parentId);
          if ((n.type === "frame" || n.type === "group") && (n.layoutMode ?? "none") !== "none") {
            refresh.add(id);
          }
        }
        if (
          n.type === "text" &&
          patchAffectsTextLayout(patch) &&
          (layoutAwarePatch.width != null || layoutAwarePatch.height != null) &&
          n.parentId
        ) {
          refresh.add(n.parentId);
        }
      }
      if (!changed) return s;
      if (!rotationOnlyBatch) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, refresh);
      }
      for (const id of ids) {
        const merged = nodes[id];
        if (merged && patches[id]) {
          const geom = Object.keys(patches[id]!).some(
            (k) => GEOM_KEYS.has(k) || k === "rotation",
          );
          if (geom) warnInvalidNodeGeometry("updateNodes", id, merged, nodes);
        }
      }
      return { nodes };
    });
  },

  updateNodeStyle: (id, patch, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const pre = get();
      const n0 = pre.nodes[id];
      if (n0 && !n0.locked) get().pushHistory();
    }
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked) return s;
      const instRoot = findInstanceRoot(s.nodes, id);
      const layoutBase =
        n.type === "text" && instRoot && instRoot !== id
          ? mergeInstanceOverrides(n, s.nodes)
          : n;
      const strokeKeys = [
        "stroke",
        "strokeColor",
        "strokeType",
        "strokeGradient",
        "strokeWidth",
        "strokeOpacity",
        "strokeEnabled",
        "strokePosition",
        "strokeStyle",
        "strokeDashLength",
        "strokeDashGap",
        "strokeLinecap",
        "strokeLinejoin",
      ] as const;
      const touchesStroke = strokeKeys.some((k) => k in patch);
      const mergedPatch = touchesStroke
        ? { ...patch, ...mergeStrokeIntoNode(layoutBase, patch) }
        : patch;
      let finalPatch: Partial<EditorNode> =
        n.type === "text" ? withTextLayoutPatch(layoutBase, mergedPatch) : mergedPatch;
      if (n.type === "text" && "content" in mergedPatch) {
        finalPatch = {
          ...finalPatch,
          name: layerNameFromTextContent(
            (mergedPatch as { content?: string }).content ?? n.content,
          ),
        };
      }

      let nodes: Record<string, EditorNode>;
      if (instRoot && instRoot !== id) {
        const rn = s.nodes[instRoot]!;
        const io: Record<string, Record<string, unknown>> = { ...(rn.instanceOverrides ?? {}) };
        const prev =
          io[id] && typeof io[id] === "object" && !Array.isArray(io[id])
            ? { ...(io[id] as Record<string, unknown>) }
            : {};
        io[id] = { ...prev, ...finalPatch };
        nodes = { ...s.nodes, [instRoot]: { ...rn, instanceOverrides: io } };
      } else {
        const expanded = expandBooleanFillStylePatches(id, finalPatch, s.nodes, s.childOrder);
        if (expanded) {
          nodes = { ...s.nodes };
          for (const [nid, p] of Object.entries(expanded)) {
            const cur = nodes[nid];
            if (cur && !cur.locked) nodes[nid] = { ...cur, ...p };
          }
        } else {
          nodes = { ...s.nodes, [id]: { ...n, ...finalPatch } };
        }
      }

      const fp = finalPatch as Partial<EditorNode>;
      if (
        n.parentId &&
        (fp.width != null || fp.height != null) &&
        (n.type === "text" ? patchAffectsTextLayout(patch) : true)
      ) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId]);
      }
      return { nodes };
    });
  },

  setNodeFillHex: (nodeId, hex, opts) => {
    const normalized = normalizeHex(hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`);
    if (!normalized) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const n0 = get().nodes[nodeId];
      if (n0 && !n0.locked) get().pushHistory();
    }
    set((s) => {
      const n = s.nodes[nodeId];
      if (!n || n.locked) return s;
      const stylePatch: NodeStylePatch = { fill: normalized, fillType: "solid" };
      const instRoot = findInstanceRoot(s.nodes, nodeId);
      let nodes = { ...s.nodes };

      const applyFill = (targetId: string, base: EditorNode) => {
        const expanded = expandBooleanFillStylePatches(targetId, stylePatch, nodes, s.childOrder);
        if (expanded) {
          for (const [nid, p] of Object.entries(expanded)) {
            const cur = nodes[nid];
            if (cur && !cur.locked) {
              nodes[nid] = { ...cur, ...p, fillTokenId: undefined };
            }
          }
          return;
        }
        nodes[targetId] = { ...base, ...stylePatch, fillTokenId: undefined };
      };

      if (instRoot && instRoot !== nodeId) {
        nodes[nodeId] = { ...nodes[nodeId]!, fillTokenId: undefined };
        const rn = nodes[instRoot]!;
        const io: Record<string, Record<string, unknown>> = { ...(rn.instanceOverrides ?? {}) };
        const prev =
          io[nodeId] && typeof io[nodeId] === "object" && !Array.isArray(io[nodeId])
            ? { ...(io[nodeId] as Record<string, unknown>) }
            : {};
        const nextOv: Record<string, unknown> = { ...prev, ...stylePatch };
        delete nextOv.fillTokenId;
        io[nodeId] = nextOv;
        nodes[instRoot] = { ...rn, instanceOverrides: io };
      } else {
        applyFill(nodeId, n);
      }
      return { nodes };
    });
  },

  setNodeTextColorHex: (nodeId, hex, opts) => {
    const normalized = normalizeHex(hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`);
    if (!normalized) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const n0 = get().nodes[nodeId];
      if (n0 && !n0.locked) get().pushHistory();
    }
    set((s) => {
      const n = s.nodes[nodeId];
      if (!n || n.locked) return s;
      const stylePatch: NodeStylePatch = { textColor: normalized };
      const instRoot = findInstanceRoot(s.nodes, nodeId);
      let nodes = { ...s.nodes };

      if (instRoot && instRoot !== nodeId) {
        nodes[nodeId] = { ...nodes[nodeId]!, fillTokenId: undefined };
        const rn = nodes[instRoot]!;
        const io: Record<string, Record<string, unknown>> = { ...(rn.instanceOverrides ?? {}) };
        const prev =
          io[nodeId] && typeof io[nodeId] === "object" && !Array.isArray(io[nodeId])
            ? { ...(io[nodeId] as Record<string, unknown>) }
            : {};
        const nextOv: Record<string, unknown> = { ...prev, ...stylePatch };
        delete nextOv.fillTokenId;
        io[nodeId] = nextOv;
        nodes[instRoot] = { ...rn, instanceOverrides: io };
      } else {
        nodes[nodeId] = { ...n, ...stylePatch, fillTokenId: undefined };
      }
      return { nodes };
    });
  },

  setNodeVisible: (id, visible) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n) return s;
      let nodes = { ...s.nodes, [id]: { ...n, visible } };
      const par = nodes[id]!.parentId;
      if (par) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
      }
      return { nodes };
    });
  },

  setNodeLocked: (id, locked) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n) return s;
      let nodes = { ...s.nodes, [id]: { ...n, locked } };
      const par = nodes[id]!.parentId;
      if (par) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
      }
      return { nodes };
    });
  },

  toggleVisible: (id) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n) return s;
      const visible = !n.visible;
      let nodes = { ...s.nodes, [id]: { ...n, visible } };
      const par = nodes[id]!.parentId;
      if (par) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
      }
      return { nodes };
    });
  },

  toggleLock: (id) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n) return s;
      const locked = !n.locked;
      let nodes = { ...s.nodes, [id]: { ...n, locked } };
      const par = nodes[id]!.parentId;
      if (par) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
      }
      return { nodes };
    });
  },

  toggleExpanded: (id) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n) return s;
      return { nodes: { ...s.nodes, [id]: { ...n, expanded: !n.expanded } } };
    });
  },

  renameNode: (id, name) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n) return s;
      return { nodes: { ...s.nodes, [id]: { ...n, name } } };
    });
  },

  addRectangle: () => {
    get().pushHistory();
    set((s) => {
      const id = `rect-${Date.now()}`;
      const roots = [...(s.childOrder[ROOT] ?? [])];
      roots.push(id);
      const node: EditorNode = {
        id,
        parentId: null,
        type: "rectangle",
        name: nextNumberedLayerName(s.nodes, "Rectangle"),
        x: 120,
        y: 120,
        width: 160,
        height: 100,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: DEFAULT_SHAPE_FILL,
        cornerRadius: 8,
        fillEnabled: true,
        fillOpacity: 1,
        strokePosition: "center",
      };
      return {
        nodes: { ...s.nodes, [id]: node },
        childOrder: { ...s.childOrder, [ROOT]: roots },
        selectedIds: [id],
      };
    });
  },

  addText: () => {
    get().pushHistory();
    set((s) => {
      const ts = textStyleFromSelection(s);
      const typo = resolveTextTypo(ts);
      const content = "New text";
      const { width: tw, height: th } = computeTextBoxSize(
        content,
        typo,
        "auto-width",
        MIN_TEXT_BOX,
        MIN_TEXT_BOX,
      );
      const id = `text-${Date.now()}`;
      const roots = [...(s.childOrder[ROOT] ?? [])];
      roots.push(id);
      const node: EditorNode = {
        id,
        parentId: null,
        type: "text",
        name: layerNameFromTextContent(content),
        x: 120,
        y: 200,
        width: tw,
        height: th,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        content,
        textResizeMode: "auto-width",
        ...ts,
        fillEnabled: true,
        fillOpacity: 1,
      };
      return {
        nodes: { ...s.nodes, [id]: node },
        childOrder: { ...s.childOrder, [ROOT]: roots },
        selectedIds: [id],
      };
    });
  },

  addRectangleAt: (worldX, worldY) => {
    get().pushHistory();
    set((s) => {
      const w = 120;
      const h = 80;
      const { x, y } = worldCenteredRootPoint(worldX, worldY, w, h);
      const id = `rect-${Date.now()}`;
      const node: EditorNode = {
        id,
        parentId: null,
        type: "rectangle",
        name: nextNumberedLayerName(s.nodes, "Rectangle"),
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: DEFAULT_SHAPE_FILL,
        cornerRadius: 8,
        fillEnabled: true,
        fillOpacity: 1,
        strokePosition: "center",
      };
      const inserted = insertNodeWithFrameParenting(
        node,
        { x, y, width: w, height: h },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move",
        editingTextId: null,
      };
    });
  },

  addTextAt: (worldX, worldY) => {
    get().pushHistory();
    set((s) => {
      const ts = textStyleFromSelection(s);
      const typo = resolveTextTypo(ts);
      const { width: tw, height: th } = computeTextBoxSize(
        "",
        typo,
        "auto-width",
        MIN_TEXT_BOX,
        MIN_TEXT_BOX,
      );
      const boxW = Math.max(tw, EMPTY_TEXT_PLACEHOLDER_WIDTH);
      const { x, y } = worldCenteredRootPoint(worldX, worldY, boxW, th);
      const id = `text-${Date.now()}`;
      const { node: base } = createPointTextAt(x, y, boxW, th, ts);
      const node: EditorNode = {
        ...base,
        id,
        parentId: null,
        name: layerNameFromTextContent(base.content),
        ...textResizePatch("auto-width"),
      };
      const inserted = insertNodeWithFrameParenting(
        node,
        { x, y, width: node.width, height: node.height },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move",
        editingTextId: id,
        textEditSelection: { anchor: 0, focus: 0 },
      };
    });
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-text-editor="${get().editingTextId}"]`);
      el?.focus();
    });
  },

  createTextBoxFromDrag: (start, end, modifiers) => {
    get().pushHistory();
    set((s) => {
      const ts = textStyleFromSelection(s);
      const { x, y, width, height, node: base } = createTextBoxFromDrag(start, end, modifiers, ts);
      const id = `text-${Date.now()}`;
      const node: EditorNode = {
        ...base,
        id,
        parentId: null,
        name: layerNameFromTextContent(base.content),
        ...textResizePatch(base.textResizeMode ?? "auto-height"),
      };
      const inserted = insertNodeWithFrameParenting(
        node,
        { x, y, width, height },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move",
        editingTextId: id,
        textEditSelection: { anchor: 0, focus: 0 },
      };
    });
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-text-editor="${get().editingTextId}"]`);
      el?.focus();
    });
  },

  importImageAsset: async (file) => {
    const msg = validateImageImportFile(file);
    if (msg) {
      window.alert(msg);
      return null;
    }
    try {
      const asset = await buildEditorAssetFromFile(file);
      get().pushHistory();
      set((s) => ({
        assets: { ...s.assets, [asset.id]: asset },
      }));
      return asset.id;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not import image.");
      return null;
    }
  },

  addImageNodeAt: (assetId, worldX, worldY) => {
    get().pushHistory();
    set((s) => {
      const asset = s.assets[assetId];
      if (!asset) return s;
      const iw = asset.width && asset.width > 0 ? asset.width : 200;
      const ih = asset.height && asset.height > 0 ? asset.height : 150;
      const scale = Math.min(1, 480 / iw, 480 / ih);
      const w = Math.max(16, Math.round(iw * scale));
      const h = Math.max(16, Math.round(ih * scale));
      const cx = worldX ?? 200;
      const cy = worldY ?? 200;
      const { x, y } = worldCenteredRootPoint(cx, cy, w, h);
      const id = `image-${Date.now()}`;
      const baseName = (asset.name || "Image").replace(/\.[^.]+$/, "") || "Image";
      const node: EditorNode = {
        id,
        parentId: null,
        type: "image",
        name: baseName,
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        assetId,
        imageSrc: asset.dataUrl,
        imageName: asset.name,
        imageMimeType: asset.mimeType,
        imageFitMode: "fill",
        fillOpacity: 1,
        fillEnabled: true,
      };
      const inserted = insertNodeWithFrameParenting(
        node,
        { x, y, width: w, height: h },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move" as Tool,
      };
    });
  },

  replaceImageAsset: async (nodeId, file) => {
    const msg = validateImageImportFile(file);
    if (msg) {
      window.alert(msg);
      return;
    }
    const n0 = get().nodes[nodeId];
    if (!n0 || n0.type !== "image") return;
    try {
      const asset = await buildEditorAssetFromFile(file);
      get().pushHistory();
      set((s) => {
        const n = s.nodes[nodeId];
        if (!n || n.type !== "image") return s;
        const baseName = (asset.name || "Image").replace(/\.[^.]+$/, "") || "Image";
        return {
          assets: { ...s.assets, [asset.id]: asset },
          nodes: {
            ...s.nodes,
            [nodeId]: {
              ...n,
              assetId: asset.id,
              imageSrc: asset.dataUrl,
              imageName: asset.name,
              imageMimeType: asset.mimeType,
              name: baseName,
            },
          },
        };
      });
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not replace image.");
    }
  },

  deleteAsset: (assetId) => {
    get().pushHistory();
    set((s) => {
      if (!s.assets[assetId]) return s;
      const { [assetId]: _removed, ...rest } = s.assets;
      const nodes = { ...s.nodes };
      for (const nid of Object.keys(nodes)) {
        const n = nodes[nid];
        if (n?.type === "image" && n.assetId === assetId) {
          nodes[nid] = { ...n, assetId: undefined };
        }
      }
      return { assets: rest, nodes };
    });
  },

  createColorTokenFromSelection: (name) => {
    const s0 = get();
    const colorTypes = new Set<NodeKind>(["frame", "rectangle", "ellipse", "path", "text"]);
    let picked: EditorNode | null = null;
    for (const id of s0.selectedIds) {
      const raw = s0.nodes[id];
      if (!raw || raw.locked || !raw.visible) continue;
      if (!colorTypes.has(raw.type)) continue;
      const merged = mergeInstanceOverrides(raw, s0.nodes);
      const n = resolveNodeWithDesignTokens(merged, s0.designTokens);
      if (effectiveFillType(n) === "gradient") continue;
      const h = n.type === "text" ? (n.textColor ?? n.fill) : n.fill;
      if (!h) continue;
      picked = n;
      break;
    }
    if (!picked) return;
    const hex = picked.type === "text" ? (picked.textColor ?? picked.fill) : picked.fill;
    if (!hex) return;
    get().pushHistory();
    set((s) => {
      const colorCount = Object.values(s.designTokens).filter((t) => t.type === "color").length;
      const tid = newDesignTokenId("color");
      const nm =
        name?.trim() ||
        `Color / ${picked!.name || "Selection"}${colorCount > 0 ? ` ${colorCount + 1}` : ""}`;
      const token: DesignToken = {
        id: tid,
        name: nm.slice(0, 64),
        type: "color",
        value: { hex, opacity: picked!.fillOpacity ?? 1 },
        createdAt: designTokenTimestamp(),
        updatedAt: designTokenTimestamp(),
      };
      return { designTokens: { ...s.designTokens, [tid]: token } };
    });
  },

  createGradientTokenFromSelection: (name) => {
    const s0 = get();
    const shapeTypes = new Set<NodeKind>(["frame", "rectangle", "ellipse", "path"]);
    let picked: EditorNode | null = null;
    for (const id of s0.selectedIds) {
      const raw = s0.nodes[id];
      if (!raw || raw.locked || !raw.visible) continue;
      if (!shapeTypes.has(raw.type)) continue;
      const merged = mergeInstanceOverrides(raw, s0.nodes);
      const n = resolveNodeWithDesignTokens(merged, s0.designTokens);
      if (effectiveFillType(n) !== "gradient") continue;
      picked = n;
      break;
    }
    if (!picked) return;
    const gradient = normalizeFillGradient(picked.fillGradient, picked.fill);
    get().pushHistory();
    set((s) => {
      const gradCount = Object.values(s.designTokens).filter((t) => t.type === "gradient").length;
      const tid = newDesignTokenId("grad");
      const nm =
        name?.trim() ||
        `Gradient / ${picked!.name || "Selection"}${gradCount > 0 ? ` ${gradCount + 1}` : ""}`;
      const token: DesignToken = {
        id: tid,
        name: nm.slice(0, 64),
        type: "gradient",
        value: gradient,
        createdAt: designTokenTimestamp(),
        updatedAt: designTokenTimestamp(),
      };
      return { designTokens: { ...s.designTokens, [tid]: token } };
    });
  },

  createTypographyTokenFromSelection: (name) => {
    const s0 = get();
    let picked: EditorNode | null = null;
    for (const id of s0.selectedIds) {
      const raw = s0.nodes[id];
      if (!raw || raw.locked || !raw.visible || raw.type !== "text") continue;
      const merged = mergeInstanceOverrides(raw, s0.nodes);
      picked = resolveNodeWithDesignTokens(merged, s0.designTokens);
      break;
    }
    if (!picked) return;
    get().pushHistory();
    set((s) => {
      const typoCount = Object.values(s.designTokens).filter((t) => t.type === "typography").length;
      const tid = newDesignTokenId("type");
      const nm =
        name?.trim() ||
        `Typography / ${picked!.name || "Text"}${typoCount > 0 ? ` ${typoCount + 1}` : ""}`;
      const token: DesignToken = {
        id: tid,
        name: nm.slice(0, 64),
        type: "typography",
        value: {
          fontFamily: picked!.fontFamily ?? "Inter, system-ui, sans-serif",
          fontSize: picked!.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
          fontWeight: picked!.fontWeight ?? 500,
          lineHeight: picked!.lineHeight ?? 1.25,
          letterSpacing: picked!.letterSpacing ?? 0,
        },
        createdAt: designTokenTimestamp(),
        updatedAt: designTokenTimestamp(),
      };
      return { designTokens: { ...s.designTokens, [tid]: token } };
    });
  },

  createSpacingToken: (name, value) => {
    if (!Number.isFinite(value)) return;
    get().pushHistory();
    set((s) => {
      const tid = newDesignTokenId("space");
      const token: DesignToken = {
        id: tid,
        name: name.trim() || "Spacing",
        type: "spacing",
        value: { value },
        createdAt: designTokenTimestamp(),
        updatedAt: designTokenTimestamp(),
      };
      return { designTokens: { ...s.designTokens, [tid]: token } };
    });
  },

  createColorToken: (name, hex, opacity = 1) => {
    const h = normalizeHex(hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`);
    if (!h) return null;
    get().pushHistory();
    let createdId: string | null = null;
    set((s) => {
      const token = createColorDesignToken(
        name,
        { hex: h, opacity: Math.min(1, Math.max(0, opacity)) },
        s.designTokens,
      );
      createdId = token.id;
      return { designTokens: { ...s.designTokens, [token.id]: token } };
    });
    return createdId;
  },

  seedDesignSystemColorPalette: () => {
    get().pushHistory();
    set((s) => ({
      designTokens: buildPaletteTokens(DEFAULT_COLOR_PALETTE, s.designTokens),
    }));
  },

  updateDesignToken: (id, patch) => {
    get().pushHistory();
    set((s) => {
      const t = s.designTokens[id];
      if (!t) return s;
      const next: DesignToken = {
        ...t,
        ...patch,
        id: t.id,
        createdAt: t.createdAt,
        type: patch.type ?? t.type,
        value: patch.value !== undefined ? (patch.value as DesignToken["value"]) : t.value,
        updatedAt: designTokenTimestamp(),
      };
      return { designTokens: { ...s.designTokens, [id]: next } };
    });
  },

  deleteDesignToken: (id) => {
    get().pushHistory();
    set((s) => {
      if (!s.designTokens[id]) return s;
      const { [id]: _removed, ...rest } = s.designTokens;
      const nodes = { ...s.nodes };
      for (const nid of Object.keys(nodes)) {
        const n = nodes[nid];
        if (!n) continue;
        let next = n;
        if (n.fillTokenId === id) next = { ...next, fillTokenId: undefined };
        if (n.textStyleTokenId === id) next = { ...next, textStyleTokenId: undefined };
        if (n.effectTokenId === id) next = { ...next, effectTokenId: undefined };
        nodes[nid] = next;
      }
      return { designTokens: rest, nodes };
    });
  },

  applyTokenToSelection: (tokenId) => {
    const tok = get().designTokens[tokenId];
    if (!tok) return;
    get().pushHistory();
    set((s) => {
      const t = s.designTokens[tokenId];
      if (!t) return s;
      const nodes = { ...s.nodes };
      for (const id of s.selectedIds) {
        const raw = nodes[id];
        if (!raw || raw.locked) continue;
        if (t.type === "color") {
          if (["frame", "rectangle", "ellipse", "path", "text"].includes(raw.type)) {
            nodes[id] = {
              ...raw,
              fillTokenId: tokenId,
              fillType: "solid",
              fillEnabled: true,
            };
          }
        } else if (t.type === "gradient") {
          if (["frame", "rectangle", "ellipse", "path"].includes(raw.type)) {
            nodes[id] = { ...raw, fillTokenId: tokenId, fillType: "gradient" };
          }
        } else if (t.type === "typography") {
          if (raw.type === "text") nodes[id] = { ...raw, textStyleTokenId: tokenId };
        } else if (t.type === "effect") {
          nodes[id] = { ...raw, effectTokenId: tokenId };
        } else if (t.type === "spacing" && isSpacingValue(t.value)) {
          const v = Math.max(0, t.value.value);
          if (raw.type === "frame" || raw.type === "group") {
            nodes[id] = {
              ...raw,
              paddingTop: v,
              paddingRight: v,
              paddingBottom: v,
              paddingLeft: v,
              layoutGap: v,
            };
          }
        }
      }
      return { nodes };
    });
  },

  detachTokenFromSelection: (tokenType) => {
    get().pushHistory();
    set((s) => {
      const nodes = { ...s.nodes };
      for (const id of s.selectedIds) {
        const raw = nodes[id];
        if (!raw) continue;
        if ((tokenType === "color" || tokenType === "gradient") && raw.fillTokenId) {
          nodes[id] = { ...raw, fillTokenId: undefined };
        } else if (tokenType === "typography" && raw.textStyleTokenId) {
          nodes[id] = { ...raw, textStyleTokenId: undefined };
        } else if (tokenType === "effect" && raw.effectTokenId) {
          nodes[id] = { ...raw, effectTokenId: undefined };
        }
      }
      return { nodes };
    });
  },

  addEffect: (nodeId, type) => {
    const s0 = get();
    const n0 = s0.nodes[nodeId];
    if (!n0 || n0.locked) return;
    const tokId = n0.effectTokenId;
    if (tokId && s0.designTokens[tokId]?.type === "effect") {
      const tok = s0.designTokens[tokId]!;
      if (!isEffectValue(tok.value)) return;
      const v = tok.value as EffectTokenValue;
      const ne = defaultNodeEffect(type);
      const list = [...(v.effects ?? []), ne];
      get().updateDesignToken(tokId, { value: { ...v, effects: list } });
      return;
    }
    get().pushHistory();
    set((s) => {
      const n = s.nodes[nodeId];
      if (!n || n.locked) return s;
      const ne = defaultNodeEffect(type);
      const list = [...(n.effects ?? []), ne];
      return { nodes: { ...s.nodes, [nodeId]: { ...n, effects: list } } };
    });
  },

  updateEffect: (nodeId, effectId, patch) => {
    const s0 = get();
    const n = s0.nodes[nodeId];
    if (!n || n.locked) return;
    const tokId = n.effectTokenId;
    if (tokId && s0.designTokens[tokId]?.type === "effect") {
      const tok = s0.designTokens[tokId]!;
      if (!isEffectValue(tok.value)) return;
      const v = tok.value as EffectTokenValue;
      const effs = (v.effects ?? []).map((e) =>
        e.id === effectId ? mergeNodeEffectPatch(e, patch) : e,
      );
      get().updateDesignToken(tokId, { value: { ...v, effects: effs } });
      return;
    }
    get().pushHistory();
    set((s) => {
      const nn = s.nodes[nodeId];
      if (!nn || nn.locked) return s;
      const list = (nn.effects ?? []).map((e) =>
        e.id === effectId ? mergeNodeEffectPatch(e, patch) : e,
      );
      return { nodes: { ...s.nodes, [nodeId]: { ...nn, effects: list } } };
    });
  },

  deleteEffect: (nodeId, effectId) => {
    const s0 = get();
    const n = s0.nodes[nodeId];
    if (!n || n.locked) return;
    const tokId = n.effectTokenId;
    if (tokId && s0.designTokens[tokId]?.type === "effect") {
      const tok = s0.designTokens[tokId]!;
      if (!isEffectValue(tok.value)) return;
      const v = tok.value as EffectTokenValue;
      const effs = (v.effects ?? []).filter((e) => e.id !== effectId);
      get().updateDesignToken(tokId, { value: { ...v, effects: effs } });
      return;
    }
    get().pushHistory();
    set((s) => {
      const nn = s.nodes[nodeId];
      if (!nn || nn.locked) return s;
      const list = (nn.effects ?? []).filter((e) => e.id !== effectId);
      return { nodes: { ...s.nodes, [nodeId]: { ...nn, effects: list.length ? list : undefined } } };
    });
  },

  toggleEffect: (nodeId, effectId) => {
    const s0 = get();
    const n = s0.nodes[nodeId];
    if (!n || n.locked) return;
    const tokId = n.effectTokenId;
    if (tokId && s0.designTokens[tokId]?.type === "effect") {
      const tok = s0.designTokens[tokId]!;
      if (!isEffectValue(tok.value)) return;
      const v = tok.value as EffectTokenValue;
      const effs = (v.effects ?? []).map((e) => (e.id === effectId ? { ...e, visible: !e.visible } : e));
      get().updateDesignToken(tokId, { value: { ...v, effects: effs } });
      return;
    }
    get().pushHistory();
    set((s) => {
      const nn = s.nodes[nodeId];
      if (!nn || nn.locked) return s;
      const list = (nn.effects ?? []).map((e) => (e.id === effectId ? { ...e, visible: !e.visible } : e));
      return { nodes: { ...s.nodes, [nodeId]: { ...nn, effects: list } } };
    });
  },

  createEffectTokenFromSelection: (name) => {
    const s0 = get();
    let pickedId: string | null = null;
    for (const id of s0.selectedIds) {
      const raw = s0.nodes[id];
      if (!raw || raw.locked || !raw.visible) continue;
      pickedId = id;
      break;
    }
    if (!pickedId) return;
    const merged = mergeInstanceOverrides(s0.nodes[pickedId]!, s0.nodes);
    const resolved = resolveNodeWithDesignTokens(merged, s0.designTokens);
    const effList = resolved.effects?.length ? resolved.effects.map((e) => ({ ...e, id: newNodeEffectId() })) : undefined;
    const value: EffectTokenValue =
      effList && effList.length > 0
        ? { effects: effList }
        : { shadow: "0 4px 12px rgba(15, 23, 42, 0.2)", blur: 0 };
    get().pushHistory();
    set((s) => {
      const n = s.nodes[pickedId!];
      if (!n) return s;
      const effectCount = Object.values(s.designTokens).filter((t) => t.type === "effect").length;
      const tid = newDesignTokenId("effect");
      const nm =
        name?.trim() ||
        `Effect / ${n.name || "Selection"}${effectCount > 0 ? ` ${effectCount + 1}` : ""}`;
      const token: DesignToken = {
        id: tid,
        name: nm.slice(0, 64),
        type: "effect",
        value,
        createdAt: designTokenTimestamp(),
        updatedAt: designTokenTimestamp(),
      };
      return { designTokens: { ...s.designTokens, [tid]: token } };
    });
  },

  applyEffectTokenToSelection: (tokenId) => {
    get().applyTokenToSelection(tokenId);
  },

  detachEffectTokenFromSelection: () => {
    get().detachTokenFromSelection("effect");
  },

  createFrameAt: (worldX, worldY, opts) => {
    const presetId = opts?.presetId ?? get().framePresetId;
    const resolved = resolveFramePresetSize(presetId);
    const W = opts?.width ?? resolved.width;
    const H = opts?.height ?? resolved.height;
    const name = opts?.name ?? (presetId !== "custom" ? resolved.label : undefined);
    get().createFrameWithBounds(worldX - W / 2, worldY - H / 2, W, H, { presetId, name });
  },

  createFrameWithBounds: (x, y, width, height, opts) => {
    get().pushHistory();
    set((s) => {
      const id = `frame-${Date.now()}`;
      const name = opts?.name ?? nextFrameName(s.nodes);
      const W = Math.max(RESIZE_MIN_DIMENSION, Math.round(width));
      const H = Math.max(RESIZE_MIN_DIMENSION, Math.round(height));
      const bx = Math.round(x);
      const by = Math.round(y);
      const node: EditorNode = {
        id,
        parentId: null,
        type: "frame",
        name,
        x: bx,
        y: by,
        width: W,
        height: H,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: DEFAULT_FRAME_FILL,
        fillEnabled: true,
        fillOpacity: 1,
        strokePosition: "center",
      };
      const inserted = insertNodeWithFrameParenting(
        node,
        { x: bx, y: by, width: W, height: H },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      const childOrder = {
        ...inserted.childOrder,
        [id]: inserted.childOrder[id] ?? [],
      };
      return {
        nodes: inserted.nodes,
        childOrder,
        selectedIds: [id],
        tool: "move",
        editingTextId: null,
      };
    });
    get().setTool("move");
  },

  addEllipseAt: (worldX, worldY) => {
    get().pushHistory();
    set((s) => {
      const w = 120;
      const h = 80;
      const { x, y } = worldCenteredRootPoint(worldX, worldY, w, h);
      const id = `ellipse-${Date.now()}`;
      const node: EditorNode = {
        id,
        parentId: null,
        type: "ellipse",
        name: nextNumberedLayerName(s.nodes, "Ellipse"),
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: DEFAULT_SHAPE_FILL,
        cornerRadius: 0,
        fillEnabled: true,
        fillOpacity: 1,
        strokePosition: "center",
      };
      const inserted = insertNodeWithFrameParenting(
        node,
        { x, y, width: w, height: h },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move",
      };
    });
  },

  addLineAt: (worldX, worldY) => {
    get().pushHistory();
    set((s) => {
      const w = 120;
      const h = 8;
      const { x, y } = worldCenteredRootPoint(worldX, worldY, w, h);
      const id = `line-${Date.now()}`;
      const node: EditorNode = {
        id,
        parentId: null,
        type: "line",
        name: nextNumberedLayerName(s.nodes, "Line"),
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        fill: "transparent",
        fillEnabled: false,
        fillOpacity: 0,
        strokeColor: DEFAULT_SHAPE_STROKE,
        strokeWidth: 3,
        strokePosition: "center",
      };
      const inserted = insertNodeWithFrameParenting(
        node,
        { x, y, width: w, height: h },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move",
      };
    });
  },

  addTriangleAt: (worldX, worldY) => {
    get().pushHistory();
    set((s) => {
      const w = 120;
      const h = 104;
      const { x, y } = worldCenteredRootPoint(worldX, worldY, w, h);
      const id = `tri-${Date.now()}`;
      const pts: PathPoint[] = [
        { id: newPathPointId(), x: w / 2, y: 0 },
        { id: newPathPointId(), x: w, y: h },
        { id: newPathPointId(), x: 0, y: h },
      ];
      let node: EditorNode = {
        id,
        parentId: null,
        type: "path",
        name: nextNumberedLayerName(s.nodes, "Triangle"),
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        pathPoints: pts,
        pathClosed: true,
        fill: DEFAULT_SHAPE_FILL,
        fillEnabled: true,
        fillOpacity: 1,
        strokeColor: DEFAULT_SHAPE_STROKE,
        strokeWidth: 0,
        strokePosition: "center",
      };
      node = normalizePathNode(node);
      const inserted = insertNodeWithFrameParenting(
        node,
        { x, y, width: node.width, height: node.height },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move",
      };
    });
  },

  createShapeFromDrag: (shapeType, start, end, modifiers, style) => {
    get().pushHistory();
    set((s) => {
      const draft = createShapeNode(shapeType, start, end, modifiers, style);
      const id = `${draft.type}-${Date.now()}`;
      const name = nextNumberedLayerName(s.nodes, draft.name);
      const node: EditorNode = { ...draft, id, name };
      const bounds = { x: node.x, y: node.y, width: node.width, height: node.height };
      const inserted = insertNodeWithFrameParenting(
        node,
        bounds,
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      const frameId = inserted.nodes[id]?.parentId;
      const nodesOut = frameId
        ? relayoutParentsWithAutoLayout(inserted.nodes, inserted.childOrder, [frameId])
        : inserted.nodes;

      return {
        nodes: nodesOut,
        childOrder: inserted.childOrder,
        selectedIds: [id],
        tool: "move",
      };
    });
    get().setTool("move");
  },

  booleanUnionSelection: () => {
    get().createBooleanGroup("union");
  },

  createBooleanGroup: (operation) => {
    const s0 = get();
    const tops0 = getBooleanEligibleSelection(s0.selectedIds, s0.nodes);
    if (tops0.length < 2) {
      window.alert("Select at least two unlocked shape layers to apply a boolean operation.");
      return;
    }
    const parentId0 = s0.nodes[tops0[0]!]!.parentId;
    if (!tops0.every((id) => s0.nodes[id]!.parentId === parentId0)) {
      window.alert("Boolean operations require shapes on the same level.");
      return;
    }
    get().pushHistory();
    set((s) => {
      const tops = getBooleanEligibleSelection(s.selectedIds, s.nodes);
      if (tops.length < 2) return s;
      const parentId = s.nodes[tops[0]!]!.parentId;
      if (!tops.every((id) => s.nodes[id]!.parentId === parentId)) return s;
      const P = parentListKey(parentId);
      const list = s.childOrder[P] ?? [];
      let ordered = [...tops].sort((a, b) => list.indexOf(a) - list.indexOf(b));
      if (operation === "subtract") {
        const top = topmostAmongSiblings(tops, s.nodes, s.childOrder);
        ordered = ordered.filter((id) => id !== top).concat(top);
      }
      const pw = parentId ? worldRect(parentId, s.nodes) : { x: 0, y: 0, width: 0, height: 0 };
      const visible = boundsForBooleanChildren(operation, ordered, s.nodes);
      const minX = visible.x;
      const minY = visible.y;
      const maxX = visible.x + visible.width;
      const maxY = visible.y + visible.height;
      const gw = visible.width;
      const gh = visible.height;
      const gx = minX - pw.x;
      const gy = minY - pw.y;
      const gid = `group-bool-${Date.now()}`;
      const nodes = { ...s.nodes };
      const childOrder = { ...s.childOrder };
      const fillSource = nodes[ordered[0]!];
      nodes[gid] = {
        id: gid,
        parentId,
        type: "group",
        name: BOOLEAN_OPERATION_LABELS[operation],
        x: gx,
        y: gy,
        width: gw,
        height: gh,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        isBooleanGroup: true,
        booleanOperation: operation,
        fill: fillSource?.fill,
        fillEnabled: fillSource?.fillEnabled ?? true,
        fillOpacity: fillSource?.fillOpacity ?? 1,
        fillType: fillSource?.fillType,
        fillGradient: fillSource?.fillGradient,
      };
      for (const id of ordered) {
        const o = getNodeWorldOrigin(id, nodes);
        const n = nodes[id]!;
        nodes[id] = {
          ...n,
          parentId: gid,
          x: o.x - minX,
          y: o.y - minY,
        };
      }
      const parentList = [...(childOrder[P] ?? [])];
      const ixs = ordered.map((id) => parentList.indexOf(id)).sort((a, b) => a - b);
      const insertAt = ixs[0]!;
      const newList = parentList.filter((id) => !ordered.includes(id));
      newList.splice(insertAt, 0, gid);
      childOrder[P] = newList;
      childOrder[gid] = ordered;
      const nodesOut = relayoutParentsWithAutoLayout(nodes, childOrder, [P]);
      return {
        nodes: nodesOut,
        childOrder,
        selectedIds: [gid],
        tool: "move",
        editingTextId: null,
        objectEditModeNodeId: null,
      };
    });
  },

  updateBooleanOperation: (groupId, operation) => {
    const g = get().nodes[groupId];
    if (!g?.isBooleanGroup || g.locked) return;
    get().pushHistory();
    set((s) => {
      const node = s.nodes[groupId];
      if (!node?.isBooleanGroup) return s;
      let nodes = {
        ...s.nodes,
        [groupId]: {
          ...node,
          booleanOperation: operation,
          name: BOOLEAN_OPERATION_LABELS[operation],
          flattenedPathData: undefined,
        },
      };
      nodes = syncGroupFrameToVisible(groupId, nodes, s.childOrder);
      return { nodes };
    });
  },

  flattenSelection: () => {
    const s0 = get();
    if (s0.selectedIds.length !== 1) {
      window.alert("Select a boolean group to flatten.");
      return;
    }
    const gid = s0.selectedIds[0]!;
    const group = s0.nodes[gid];
    if (!group?.isBooleanGroup || group.locked) {
      window.alert("Select a boolean group to flatten.");
      return;
    }
    const kids = s0.childOrder[gid] ?? [];
    const result = flattenBooleanGroup(group, kids, s0.nodes);
    if (!result) {
      window.alert("Could not flatten this boolean group.");
      return;
    }
    get().pushHistory();
    set((s) => {
      const g2 = s.nodes[gid];
      if (!g2?.isBooleanGroup) return s;
      const parentId = g2.parentId;
      const P = parentListKey(parentId);
      const pw = parentId ? worldRect(parentId, s.nodes) : { x: 0, y: 0, width: 0, height: 0 };
      const pathNode = booleanResultToPathNode(result, g2, parentId);
      pathNode.x = result.x - pw.x;
      pathNode.y = result.y - pw.y;
      const nodes = { ...s.nodes, [pathNode.id]: pathNode };
      const childOrder = { ...s.childOrder };
      for (const cid of kids) {
        delete nodes[cid];
        delete childOrder[cid];
      }
      delete nodes[gid];
      delete childOrder[gid];
      const list = (childOrder[P] ?? []).filter((id) => id !== gid);
      const idx = (s.childOrder[P] ?? []).indexOf(gid);
      list.splice(Math.max(0, idx), 0, pathNode.id);
      childOrder[P] = list;
      return { nodes, childOrder, selectedIds: [pathNode.id], tool: "move" };
    });
  },

  outlineStrokeSelection: () => {
    const s0 = get();
    if (s0.editorMode !== "design" || s0.selectedIds.length !== 1) {
      window.alert("Select one shape with a visible stroke to outline.");
      return;
    }
    const id = s0.selectedIds[0]!;
    const node = s0.nodes[id];
    if (!node) return;
    if (!canOutlineStroke(node)) {
      window.alert("Select a layer with a visible stroke to outline.");
      return;
    }
    const ctx = { childOrder: s0.childOrder, nodes: s0.nodes };
    const converted = convertStrokeToVector(node, ctx);
    if (!converted) {
      window.alert("Could not outline this stroke.");
      return;
    }
    const removeKids = booleanGroupChildrenToRemove(node, ctx);
    get().pushHistory();
    set((s) => {
      const current = s.nodes[id];
      if (!current) return s;
      const next = { ...converted, id, name: current.name, parentId: current.parentId };
      const nodes = { ...s.nodes, [id]: next };
      const childOrder = { ...s.childOrder };
      for (const cid of removeKids) {
        delete nodes[cid];
        delete childOrder[cid];
      }
      if (removeKids.length > 0) {
        delete childOrder[id];
      }
      const parentRef = current.parentId;
      const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
      return {
        nodes: nodes2,
        childOrder,
        pathEditModeNodeId: id,
        shapeEditModeNodeId: null,
        objectEditModeNodeId: null,
        selectedPathPointId: null,
        selectedIds: [id],
        tool: "move",
      };
    });
  },

  enterObjectEditMode: (nodeId) => {
    const s = get();
    const n = s.nodes[nodeId];
    if (!n || n.locked) return;
    const kids = s.childOrder[nodeId] ?? [];
    const canEdit =
      (n.isBooleanGroup && !n.maskId) ||
      n.type === "group" ||
      (n.type === "frame" && kids.some((cid) => s.nodes[cid]?.visible));
    if (!canEdit) return;
    set({
      objectEditModeNodeId: nodeId,
      selectedIds: [nodeId],
      pathEditModeNodeId: null,
      shapeEditModeNodeId: null,
    });
  },

  exitObjectEditMode: () => set({ objectEditModeNodeId: null }),

  useSelectionAsMask: () => {
    const s0 = get();
    const tops0 = getBooleanEligibleSelection(s0.selectedIds, s0.nodes);
    if (tops0.length < 2) {
      window.alert("Select at least two shapes — the topmost becomes the mask.");
      return;
    }
    const parentId0 = s0.nodes[tops0[0]!]!.parentId;
    if (!tops0.every((id) => s0.nodes[id]!.parentId === parentId0)) {
      window.alert("Mask requires shapes on the same level.");
      return;
    }
    get().pushHistory();
    set((s) => {
      const tops = getBooleanEligibleSelection(s.selectedIds, s.nodes);
      if (tops.length < 2) return s;
      const parentId = s.nodes[tops[0]!]!.parentId;
      const P = parentListKey(parentId);
      const maskId = topmostAmongSiblings(tops, s.nodes, s.childOrder);
      const contentIds = tops.filter((id) => id !== maskId);
      const allIds = [...contentIds, maskId];
      const pw = parentId ? worldRect(parentId, s.nodes) : { x: 0, y: 0, width: 0, height: 0 };
      const visible = boundsForMaskAndContent(maskId, contentIds, s.nodes, s.childOrder);
      const minX = visible.x;
      const minY = visible.y;
      const maxX = visible.x + visible.width;
      const maxY = visible.y + visible.height;
      const gid = `group-mask-${Date.now()}`;
      const nodes = { ...s.nodes };
      const childOrder = { ...s.childOrder };
      nodes[gid] = {
        id: gid,
        parentId,
        type: "group",
        name: "Mask group",
        x: minX - pw.x,
        y: minY - pw.y,
        width: maxX - minX,
        height: maxY - minY,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        maskId,
      };
      for (const id of contentIds) {
        const o = getNodeWorldOrigin(id, nodes);
        nodes[id] = {
          ...nodes[id]!,
          parentId: gid,
          x: o.x - minX,
          y: o.y - minY,
          maskedBy: gid,
          isMask: false,
        };
      }
      const mo = getNodeWorldOrigin(maskId, nodes);
      nodes[maskId] = {
        ...nodes[maskId]!,
        parentId: gid,
        x: mo.x - minX,
        y: mo.y - minY,
        isMask: true,
        name: "Mask",
        maskedBy: undefined,
      };
      const parentList = [...(childOrder[P] ?? [])];
      const insertAt = Math.min(...allIds.map((id) => parentList.indexOf(id)).filter((i) => i >= 0));
      childOrder[P] = parentList.filter((id) => !allIds.includes(id));
      childOrder[P]!.splice(Math.max(0, insertAt), 0, gid);
      childOrder[gid] = [...contentIds, maskId];
      const firstContent = contentIds[0];
      return {
        nodes: relayoutParentsWithAutoLayout(nodes, childOrder, [P]),
        childOrder,
        selectedIds: firstContent ? [firstContent] : [gid],
        tool: "move",
      };
    });
  },

  releaseMask: (maskGroupId) => {
    const g0 = get().nodes[maskGroupId];
    if (!g0 || !isMaskGroup(g0) || g0.locked) return;
    get().pushHistory();
    set((s) => {
      const g = s.nodes[maskGroupId];
      if (!g || !isMaskGroup(g)) return s;
      const parentId = g.parentId;
      const P = parentListKey(parentId);
      const kids = [...(s.childOrder[maskGroupId] ?? [])];
      const nodes = { ...s.nodes };
      const childOrder = { ...s.childOrder };
      const gw = worldRect(maskGroupId, s.nodes);
      for (const kid of kids) {
        const kn = nodes[kid];
        if (!kn) continue;
        const kw = worldRect(kid, s.nodes);
        nodes[kid] = {
          ...kn,
          parentId,
          x: kw.x - (parentId ? worldRect(parentId, s.nodes).x : 0),
          y: kw.y - (parentId ? worldRect(parentId, s.nodes).y : 0),
          isMask: undefined,
          maskedBy: undefined,
        };
      }
      const list = [...(childOrder[P] ?? [])];
      const gi = list.indexOf(maskGroupId);
      list.splice(gi, 1, ...kids);
      childOrder[P] = list;
      delete nodes[maskGroupId];
      delete childOrder[maskGroupId];
      return { nodes, childOrder, selectedIds: kids, tool: "move" };
    });
  },

  setNodeAsMask: (nodeId, isMask) => {
    const n = get().nodes[nodeId];
    if (!n || n.locked) return;
    get().pushHistory();
    set((s) => ({
      nodes: {
        ...s.nodes,
        [nodeId]: {
          ...s.nodes[nodeId]!,
          isMask,
          name: isMask ? "Mask" : s.nodes[nodeId]!.name,
        },
      },
    }));
  },

  duplicateSelection: () => {
    if (editableTopLevelSelection(get()).length === 0) return;
    get().pushHistory();
    const zoom = get().zoom;
    const offset = 10 / Math.max(zoom, 0.01);
    set((s) => cloneTopLevelSelectionState(s, offset) ?? s);
  },

  cloneSelectionInPlace: () => {
    if (editableTopLevelSelection(get()).length === 0) return [];
    set((s) => cloneTopLevelSelectionState(s, 0) ?? s);
    return get().selectedIds;
  },

  alignSelection: (direction) => {
    const s0 = get();
    const tops0 = alignableSelectionIds(s0.selectedIds, s0.nodes);
    if (tops0.length < 2) return;
    get().pushHistory();
    set((s) => {
      const tops = alignableSelectionIds(s.selectedIds, s.nodes);
      if (tops.length < 2) return s;
      let nodes = alignNodesInDocument(s.nodes, s.childOrder, tops, direction);
      const relayoutKeys = relayoutParentKeysAfterManualPosition(
        nodes,
        s.childOrder,
        tops,
        parentListKey,
      );
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, relayoutKeys);
      return { nodes };
    });
  },

  distributeSelection: (axis) => {
    const s0 = get();
    const tops0 = alignableSelectionIds(s0.selectedIds, s0.nodes);
    if (tops0.length < 3) return;
    get().pushHistory();
    set((s) => {
      const tops = alignableSelectionIds(s.selectedIds, s.nodes);
      if (tops.length < 3) return s;
      let nodes = distributeNodesInDocument(s.nodes, s.childOrder, tops, axis);
      const relayoutKeys = relayoutParentKeysAfterManualPosition(
        nodes,
        s.childOrder,
        tops,
        parentListKey,
      );
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, relayoutKeys);
      return { nodes };
    });
  },

  selectAllEditable: () =>
    set((s) => {
      if (s.editorMode !== "design") return s;
      const ids: string[] = [];
      const walk = (parentKey: string) => {
        for (const id of s.childOrder[parentKey] ?? []) {
          const n = s.nodes[id];
          if (n?.visible && !n.locked) ids.push(id);
          walk(id);
        }
      };
      walk(ROOT);
      return {
        selectedIds: ids,
        editingTextId: null,
        contextMenu: null,
        selectedPrototypeLinkId: null,
        pathEditModeNodeId: null,
  objectEditModeNodeId: null,
        selectedPathPointId: null,
      };
    }),

  toggleLockSelection: () => {
    const s0 = get();
    if (!s0.selectedIds.length) return;
    get().pushHistory();
    set((s) => {
      const nodes = { ...s.nodes };
      for (const id of s.selectedIds) {
        const n = nodes[id];
        if (!n) continue;
        nodes[id] = { ...n, locked: !n.locked };
      }
      return { nodes };
    });
  },

  toggleVisibleSelection: () => {
    const s0 = get();
    if (!s0.selectedIds.length) return;
    get().pushHistory();
    set((s) => {
      const nodes = { ...s.nodes };
      for (const id of s.selectedIds) {
        const n = nodes[id];
        if (!n) continue;
        nodes[id] = { ...n, visible: !n.visible };
      }
      return { nodes };
    });
  },

  copySelection: () => {
    const s = get();
    const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
      const n = s.nodes[id];
      return n && !n.locked && n.visible;
    });
    const payload = buildClipboardPayloadFromState(s, tops);
    if (!payload) return;
    setEditorClipboardJson(JSON.stringify(payload));
  },

  cutSelection: () => {
    const s0 = get();
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length === 0) return;
    const payload = buildClipboardPayloadFromState(s0, tops0);
    if (!payload) return;
    setEditorClipboardJson(JSON.stringify(payload));
    get().pushHistory();
    get().deleteSelection({ skipHistory: true });
  },

  pasteSelection: (opts) => {
    if (get().editorMode !== "design") return;
    const raw = getEditorClipboardJson();
    const payload = raw ? parseEditorClipboardPayload(raw) : null;
    if (!payload?.rootIds?.length) return;
    const OFFSET = opts?.inPlace ? 0 : 24;
    get().pushHistory();
    set((s) => {
      const idMap = new Map<string, string>();
      const newAssetIds = new Map<string, string>();
      if (payload.assets) {
        for (const aid of Object.keys(payload.assets)) {
          newAssetIds.set(aid, `asset-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
        }
      }
      let nodes: Record<string, EditorNode> = { ...s.nodes };
      let childOrder: Record<string, string[]> = { ...s.childOrder };
      const assets: Record<string, EditorAsset> = { ...s.assets };
      if (payload.assets) {
        for (const [oldAid, ast] of Object.entries(payload.assets)) {
          const nid = newAssetIds.get(oldAid)!;
          assets[nid] = { ...ast, id: nid };
        }
      }

      const newRoots: string[] = [];
      const pasteParentId = resolvePasteParentId(s);

      for (const rootId of payload.rootIds) {
        const rootOld = payload.nodes[rootId];
        if (!rootOld) continue;
        const rootLabel =
          rootOld.type === "text"
            ? duplicatedTextLayerName(rootOld.content)
            : nextDuplicatedLayerName(nodes, rootOld.name);

        const cloneRecursive = (oldId: string, newParent: string | null, treeRootOldId: string): string => {
          const old = payload.nodes[oldId];
          if (!old) return "";
          const newId = `${old.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          idMap.set(oldId, newId);
          const isTreeRoot = oldId === treeRootOldId;
          const worldR = worldRect(oldId, payload.nodes);
          const wx = worldR.x + (isTreeRoot ? OFFSET : 0);
          const wy = worldR.y + (isTreeRoot ? OFFSET : 0);
          const pos = isTreeRoot
            ? worldPointToParentLocal(wx, wy, newParent, s.nodes)
            : { x: old.x, y: old.y };

          let base: EditorNode = {
            ...JSON.parse(JSON.stringify(old)) as EditorNode,
            id: newId,
            parentId: newParent,
            name:
              old.type === "text"
                ? duplicatedTextLayerName(old.content)
                : oldId === rootId
                  ? rootLabel
                  : old.name,
            x: pos.x,
            y: pos.y,
          };
          if (base.type === "path" && base.pathPoints?.length) {
            base = { ...base, pathPoints: rekeyPathPoints(base.pathPoints) };
          }
          if (old.effects?.length) {
            base = { ...base, effects: old.effects.map((e) => ({ ...e, id: newNodeEffectId() })) };
          }
          if (base.type === "image" && base.assetId && newAssetIds.has(base.assetId)) {
            const na = newAssetIds.get(base.assetId)!;
            const assetRow = assets[na];
            base = {
              ...base,
              assetId: na,
              imageSrc: assetRow?.dataUrl ?? base.imageSrc,
            };
          }
          nodes[newId] = base;
          const newKids: string[] = [];
          for (const k of payload.childOrder[oldId] ?? []) {
            newKids.push(cloneRecursive(k, newId, treeRootOldId));
          }
          childOrder[newId] = newKids;
          return newId;
        };

        const newRootId = cloneRecursive(rootId, pasteParentId, rootId);
        newRoots.push(newRootId);
        for (const nid of collectSubtreeIds(newRootId, childOrder)) {
          const n = nodes[nid]!;
          if (!n.prototypeLinks?.length) continue;
          nodes[nid] = {
            ...n,
            prototypeLinks: n.prototypeLinks.map((l) => ({
              ...l,
              id: newPrototypeLinkId(),
              sourceNodeId: idMap.get(l.sourceNodeId) ?? l.sourceNodeId,
              targetFrameId:
                l.targetFrameId && idMap.has(l.targetFrameId) ? idMap.get(l.targetFrameId)! : l.targetFrameId,
            })),
          };
        }
      }

      for (const newId of idMap.values()) {
        const n = nodes[newId];
        if (!n?.instanceOverrides) continue;
        const io: Record<string, Record<string, unknown>> = {};
        for (const [k, v] of Object.entries(n.instanceOverrides)) {
          const nk = idMap.has(k) ? (idMap.get(k) as string) : k;
          io[nk] = v as Record<string, unknown>;
        }
        nodes[newId] = { ...n, instanceOverrides: io };
      }

      const topsSel = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      const anchor = topsSel.length ? topsSel[topsSel.length - 1]! : null;
      const byParent = new Map<string, string[]>();
      for (const newR of newRoots) {
        const pk = parentListKey(nodes[newR]!.parentId);
        if (!byParent.has(pk)) byParent.set(pk, []);
        byParent.get(pk)!.push(newR);
      }
      for (const [pk, group] of byParent) {
        let list = [...(childOrder[pk] ?? [])].filter((id) => !group.includes(id));
        let ins = list.length;
        if (anchor) {
          const apk = parentListKey(s.nodes[anchor]!.parentId);
          if (apk === pk) {
            const idx = list.indexOf(anchor);
            ins = idx >= 0 ? idx + 1 : list.length;
          }
        }
        list = [...list.slice(0, ins), ...group, ...list.slice(ins)];
        childOrder[pk] = list;
      }

      let nodesOut = nodes;
      const relayoutKeys = new Set<string>();
      for (const nr of newRoots) relayoutKeys.add(parentListKey(nodes[nr]!.parentId));
      nodesOut = relayoutParentsWithAutoLayout(nodesOut, childOrder, relayoutKeys);

      return {
        nodes: nodesOut,
        childOrder,
        assets,
        selectedIds: newRoots,
        tool: "move" as Tool,
        editingTextId: null,
        contextMenu: null,
      };
    });
  },

  deleteSelection: (opts) => {
    const s0 = get();
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length === 0) return;
    if (!opts?.skipHistory) get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      if (tops.length === 0) return s;
      const parentsToRelayout = new Set<string>();
      for (const root of tops) {
        parentsToRelayout.add(parentListKey(s.nodes[root]!.parentId));
      }
      const toRemove = new Set<string>();
      for (const root of tops) {
        for (const id of collectSubtreeIds(root, s.childOrder)) {
          toRemove.add(id);
        }
      }
      let nodes = { ...s.nodes };
      const childOrder: Record<string, string[]> = {};
      for (const [k, arr] of Object.entries(s.childOrder)) {
        childOrder[k] = arr.filter((id) => !toRemove.has(id));
      }
      for (const id of toRemove) {
        delete nodes[id];
        delete childOrder[id];
      }
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, parentsToRelayout);
      return { nodes, childOrder, selectedIds: [], editingTextId: null, pathEditModeNodeId: null, selectedPathPointId: null };
    });
  },

  bringForward: () => {
    const s0 = get();
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length === 0) return;
    get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      if (tops.length === 0) return s;
      const childOrder = { ...s.childOrder };
      const byParent = new Map<string, string[]>();
      for (const id of tops) {
        const P = parentListKey(s.nodes[id]!.parentId);
        if (!byParent.has(P)) byParent.set(P, []);
        byParent.get(P)!.push(id);
      }
      for (const [P, ids] of byParent) {
        const list = [...(childOrder[P] ?? [])];
        const idxs = ids
          .map((id) => list.indexOf(id))
          .filter((i) => i >= 0)
          .sort((a, b) => b - a);
        for (const i of idxs) {
          if (i < list.length - 1) {
            const t = list[i + 1];
            list[i + 1] = list[i]!;
            list[i] = t!;
          }
        }
        childOrder[P] = list;
      }
      let nodes = { ...s.nodes };
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, byParent.keys());
      return { childOrder, nodes };
    });
  },

  sendBackward: () => {
    const s0 = get();
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length === 0) return;
    get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      if (tops.length === 0) return s;
      const childOrder = { ...s.childOrder };
      const byParent = new Map<string, string[]>();
      for (const id of tops) {
        const P = parentListKey(s.nodes[id]!.parentId);
        if (!byParent.has(P)) byParent.set(P, []);
        byParent.get(P)!.push(id);
      }
      for (const [P, ids] of byParent) {
        const list = [...(childOrder[P] ?? [])];
        const idxs = ids
          .map((id) => list.indexOf(id))
          .filter((i) => i >= 0)
          .sort((a, b) => a - b);
        for (const i of idxs) {
          if (i > 0) {
            const t = list[i - 1];
            list[i - 1] = list[i]!;
            list[i] = t!;
          }
        }
        childOrder[P] = list;
      }
      let nodes = { ...s.nodes };
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, byParent.keys());
      return { childOrder, nodes };
    });
  },

  bringToFront: () => {
    const s0 = get();
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length === 0) return;
    get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      if (tops.length === 0) return s;
      const childOrder = { ...s.childOrder };
      const byParent = new Map<string, string[]>();
      for (const id of tops) {
        const P = parentListKey(s.nodes[id]!.parentId);
        if (!byParent.has(P)) byParent.set(P, []);
        byParent.get(P)!.push(id);
      }
      for (const [P, ids] of byParent) {
        const list = [...(childOrder[P] ?? [])];
        const set = new Set(ids);
        const rest = list.filter((id) => !set.has(id));
        const stable = [...ids].sort((a, b) => list.indexOf(a) - list.indexOf(b));
        childOrder[P] = [...rest, ...stable];
      }
      let nodes = { ...s.nodes };
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, byParent.keys());
      return { childOrder, nodes };
    });
  },

  sendToBack: () => {
    const s0 = get();
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length === 0) return;
    get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      if (tops.length === 0) return s;
      const childOrder = { ...s.childOrder };
      const byParent = new Map<string, string[]>();
      for (const id of tops) {
        const P = parentListKey(s.nodes[id]!.parentId);
        if (!byParent.has(P)) byParent.set(P, []);
        byParent.get(P)!.push(id);
      }
      for (const [P, ids] of byParent) {
        const list = [...(childOrder[P] ?? [])];
        const set = new Set(ids);
        const rest = list.filter((id) => !set.has(id));
        const stable = [...ids].sort((a, b) => list.indexOf(a) - list.indexOf(b));
        childOrder[P] = [...stable, ...rest];
      }
      let nodes = { ...s.nodes };
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, byParent.keys());
      return { childOrder, nodes };
    });
  },

  nudgeSelection: (dx, dy) => {
    if (dx === 0 && dy === 0) return;
    const s0 = get();
    if (s0.editorMode !== "design") return;
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length === 0) return;
    get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      if (tops.length === 0) return s;
      let nodes = { ...s.nodes };
      const refresh = new Set<string>();
      for (const id of tops) {
        const n = nodes[id]!;
        nodes[id] = { ...n, x: n.x + dx, y: n.y + dy };
        if (n.parentId) refresh.add(n.parentId);
        if ((n.type === "frame" || n.type === "group") && (n.layoutMode ?? "none") !== "none") {
          refresh.add(id);
        }
      }
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, refresh);
      return { nodes };
    });
  },

  setPencilStrokeWidth: (width) => {
    set({ pencilStrokeWidth: clampStrokeWidth(width) });
  },

  setSelectionStrokeWidth: (width) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    const next = clampStrokeWidth(width);
    const tops = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible && nodeSupportsStrokeWidth(n);
    });
    if (tops.length === 0) return;
    get().pushHistory();
    set((s) => {
      let nodes = { ...s.nodes };
      for (const id of tops) {
        const n = nodes[id];
        if (!n || n.locked || !nodeSupportsStrokeWidth(n)) continue;
        nodes[id] = {
          ...n,
          strokeWidth: next,
          strokeEnabled: next > 0 ? true : n.strokeEnabled,
        };
      }
      return { nodes, pencilStrokeWidth: next };
    });
  },

  nudgeSelectionStrokeWidth: (delta) => {
    if (delta === 0) return;
    const s0 = get();
    if (s0.editorMode !== "design") return;
    const tops = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible && nodeSupportsStrokeWidth(n);
    });
    if (tops.length === 0) {
      const next = clampStrokeWidth(s0.pencilStrokeWidth + delta);
      if (next === s0.pencilStrokeWidth) return;
      set({ pencilStrokeWidth: next });
      return;
    }
    get().pushHistory();
    set((s) => {
      let nodes = { ...s.nodes };
      let preset = s.pencilStrokeWidth;
      for (const id of tops) {
        const n = nodes[id];
        if (!n || n.locked || !nodeSupportsStrokeWidth(n)) continue;
        const next = clampStrokeWidth((n.strokeWidth ?? 0) + delta);
        preset = next;
        nodes[id] = {
          ...n,
          strokeWidth: next,
          strokeEnabled: next > 0 ? true : n.strokeEnabled,
        };
      }
      return { nodes, pencilStrokeWidth: preset };
    });
  },

  reorderAutoLayoutChildByArrow: (arrowCode) => {
    const s0 = get();
    if (s0.editorMode !== "design") return false;
    const tops = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    const ctx = getAutoLayoutArrowReorderContext(tops, s0.nodes, s0.childOrder);
    if (!ctx) return false;
    const targetIndex = computeAutoLayoutArrowReorderIndex(
      ctx,
      arrowCode,
      s0.nodes,
      s0.childOrder,
    );
    if (targetIndex == null) return false;
    get().pushHistory();
    get().reorderNode(ctx.childId, ctx.parentId, targetIndex);
    return true;
  },

  swapAutoLayoutSiblings: (idA, idB, opts) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    const a = s0.nodes[idA];
    const b = s0.nodes[idB];
    if (!a?.parentId || a.parentId !== b?.parentId) return;
    const parentId = a.parentId;
    if (!opts?.skipHistory) get().pushHistory();
    set((s) => {
      const nextOrder = swapAutoLayoutSiblingOrder(parentId, idA, idB, s.childOrder);
      if (!nextOrder) return s;
      let nodes = relayoutParentsWithAutoLayout(s.nodes, nextOrder, [parentId]);
      return { nodes, childOrder: nextOrder };
    });
  },

  groupSelection: () => {
    const s0 = get();
    const tops0 = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible;
    });
    if (tops0.length < 2) return;
    const parentId0 = s0.nodes[tops0[0]!]!.parentId;
    if (!tops0.every((id) => s0.nodes[id]!.parentId === parentId0)) return;
    get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
        const n = s.nodes[id];
        return n && !n.locked && n.visible;
      });
      if (tops.length < 2) return s;
      const parentId = s.nodes[tops[0]!]!.parentId;
      if (!tops.every((id) => s.nodes[id]!.parentId === parentId)) return s;
      const P = parentListKey(parentId);
      const pw = parentId ? worldRect(parentId, s.nodes) : { x: 0, y: 0, width: 0, height: 0 };
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const id of tops) {
        const w = worldRect(id, s.nodes);
        minX = Math.min(minX, w.x);
        minY = Math.min(minY, w.y);
        maxX = Math.max(maxX, w.x + w.width);
        maxY = Math.max(maxY, w.y + w.height);
      }
      const gw = maxX - minX;
      const gh = maxY - minY;
      const gx = minX - pw.x;
      const gy = minY - pw.y;
      const gid = `group-${Date.now()}`;
      const nodes = { ...s.nodes };
      const childOrder = { ...s.childOrder };
      nodes[gid] = {
        id: gid,
        parentId,
        type: "group",
        name: "Group",
        x: gx,
        y: gy,
        width: gw,
        height: gh,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
      };
      for (const id of tops) {
        const w = worldRect(id, s.nodes);
        const n = nodes[id]!;
        nodes[id] = {
          ...n,
          parentId: gid,
          x: w.x - minX,
          y: w.y - minY,
        };
      }
      const list = [...(childOrder[P] ?? [])];
      const ixs = tops.map((id) => list.indexOf(id)).sort((a, b) => a - b);
      const insertAt = ixs[0]!;
      const newList = list.filter((id) => !tops.includes(id));
      newList.splice(insertAt, 0, gid);
      childOrder[P] = newList;
      childOrder[gid] = tops;
      let nodesOut = nodes;
      nodesOut = relayoutParentsWithAutoLayout(nodesOut, childOrder, [P]);
      return {
        nodes: nodesOut,
        childOrder,
        selectedIds: [gid],
        tool: "move",
        editingTextId: null,
      };
    });
  },

  addAutoLayoutToSelection: () => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    if (!canAddAutoLayoutToSelection(s0.selectedIds, s0.nodes)) return;
    const result = applyAutoLayoutToSelection(s0.nodes, s0.childOrder, s0.selectedIds);
    if (!result) return;
    get().pushHistory();
    set({
      nodes: result.nodes,
      childOrder: result.childOrder,
      selectedIds: result.selectedIds,
      tool: "move",
      editingTextId: null,
    });
  },

  addAutoLayoutToContainer: (containerId) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    const n = s0.nodes[containerId];
    if (!n || n.locked || !n.visible || (n.type !== "frame" && n.type !== "group")) return;
    const result = applyAutoLayoutToContainer(s0.nodes, s0.childOrder, containerId);
    if (!result) return;
    get().pushHistory();
    set({
      nodes: result.nodes,
      childOrder: result.childOrder,
      selectedIds: result.selectedIds,
      tool: "move",
      editingTextId: null,
    });
  },

  wrapSelectionInFrame: () => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    if (!canAddAutoLayoutToSelection(s0.selectedIds, s0.nodes)) return;
    const result = applyWrapSelectionInFrame(s0.nodes, s0.childOrder, s0.selectedIds);
    if (!result) return;
    get().pushHistory();
    set({
      nodes: result.nodes,
      childOrder: result.childOrder,
      selectedIds: result.selectedIds,
      tool: "move",
      editingTextId: null,
    });
  },

  ungroupSelection: () => {
    const s0 = get();
    if (s0.selectedIds.length !== 1) return;
    const gid0 = s0.selectedIds[0]!;
    const g0 = s0.nodes[gid0];
    if (!g0 || g0.type !== "group" || g0.locked || !g0.visible) return;
    const kids0 = [...(s0.childOrder[gid0] ?? [])];
    if (kids0.length === 0) return;
    get().pushHistory();
    set((s) => {
      if (s.selectedIds.length !== 1) return s;
      const gid = s.selectedIds[0]!;
      const g = s.nodes[gid];
      if (!g || g.type !== "group" || g.locked || !g.visible) return s;
      const kids = [...(s.childOrder[gid] ?? [])];
      if (kids.length === 0) return s;
      const parentId = g.parentId;
      const P = parentListKey(parentId);
      const pg = worldRect(gid, s.nodes);
      const pp = parentId ? worldRect(parentId, s.nodes) : { x: 0, y: 0, width: 0, height: 0 };
      const nodes = { ...s.nodes };
      const childOrder = { ...s.childOrder };
      for (const id of kids) {
        const n = nodes[id]!;
        nodes[id] = {
          ...n,
          parentId: parentId ?? null,
          x: n.x + (pg.x - pp.x),
          y: n.y + (pg.y - pp.y),
        };
      }
      const list = [...(childOrder[P] ?? [])];
      const ix = list.indexOf(gid);
      const newList = list.filter((id) => id !== gid);
      newList.splice(ix >= 0 ? ix : newList.length, 0, ...kids);
      childOrder[P] = newList;
      delete nodes[gid];
      delete childOrder[gid];
      let nodesOut = nodes;
      nodesOut = relayoutParentsWithAutoLayout(nodesOut, childOrder, [P]);
      return {
        nodes: nodesOut,
        childOrder,
        selectedIds: kids,
        tool: "move",
        editingTextId: null,
      };
    });
  },

  toggleSelectNode: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    })),

  setSelection: (ids) =>
    set({
      selectedIds: ids,
      selectedLayoutGuideId: null,
      editingTextId: null,
      contextMenu: null,
      selectedPrototypeLinkId: null,
      pathEditModeNodeId: null,
  objectEditModeNodeId: null,
      selectedPathPointId: null,
    }),

  setGuides: (guides) => set({ guides, dragMeasurements: [] }),
  setSnapOverlay: (guides, dragMeasurements) => set({ guides, dragMeasurements }),
  setSwapDragIndicator: (swapDragIndicator) => set({ swapDragIndicator }),
  setAutoLayoutReorderIndicator: (autoLayoutReorderIndicator) =>
    set({ autoLayoutReorderIndicator }),
  setLayoutGuideDraft: (layoutGuideDraft) => set({ layoutGuideDraft }),
  cancelLayoutGuideDraft: () => set({ layoutGuideDraft: null }),
  commitLayoutGuide: () => {
    const s = get();
    if (!s.layoutGuideDraft) return;
    const guide: LayoutGuide = {
      id: `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      axis: s.layoutGuideDraft.axis,
      pos: s.layoutGuideDraft.pos,
    };
    get().pushHistory();
    set((state) => {
      const layoutGuides = [...state.layoutGuides, guide];
      const next = { ...state, layoutGuides, layoutGuideDraft: null };
      return { layoutGuides, layoutGuideDraft: null, ...syncActivePageRecord(next) };
    });
  },

  reorderNode: (id, targetParentId, targetIndex) =>
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked) return s;
      if ((n.parentId ?? ROOT) !== targetParentId) return s;
      const res = applyMoveNodeToParent(s, id, targetParentId, targetIndex);
      if (!res) return s;
      let { nodes, childOrder } = res;
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [targetParentId]);
      return { nodes, childOrder };
    }),

  moveNodeToParent: (id, newParentId, index) =>
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked) return s;
      const newKey = newParentId === ROOT ? ROOT : newParentId;
      const oldKey = parentListKey(n.parentId);

      let stateForMove = s;
      if (newKey !== ROOT) {
        const parent = s.nodes[newKey];
        const gapPatch = freezeAutoLayoutGapBeforeChildInsert(
          parent,
          s.nodes,
          s.childOrder,
          id,
        );
        if (gapPatch && parent) {
          stateForMove = {
            ...s,
            nodes: {
              ...s.nodes,
              [newKey]: { ...parent, ...gapPatch, layoutDirty: true },
            },
          };
        }
      }

      const res = applyMoveNodeToParent(stateForMove, id, newKey, index);
      if (!res) return s;
      let { nodes, childOrder } = res;
      const refresh = new Set<string>();
      if (oldKey !== newKey) {
        if (oldKey !== ROOT) refresh.add(oldKey);
        if (newKey !== ROOT) refresh.add(newKey);
      } else {
        refresh.add(oldKey);
      }
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);
      return { nodes, childOrder };
    }),

  updateLayout: (id, patch) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked || (n0.type !== "frame" && n0.type !== "group")) return;
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked || (n.type !== "frame" && n.type !== "group")) return s;
      const nodes = applyLayoutPatchWithAutoLayout(
        s.nodes,
        s.childOrder,
        id,
        patch,
      ) as EditorState["nodes"];
      return { nodes };
    });
  },

  updateLayoutSizing: (id, axis, mode) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked) return;
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked) return s;
      const patch =
        axis === "horizontal"
          ? { layoutSizingHorizontal: mode }
          : { layoutSizingVertical: mode };
      let nodes = { ...s.nodes, [id]: { ...n, ...patch, layoutDirty: true } };
      const refresh = new Set<string>();
      if (n.parentId) refresh.add(n.parentId);
      if ((n.type === "frame" || n.type === "group") && (n.layoutMode ?? "none") !== "none") {
        refresh.add(id);
      }
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, refresh);
      return { nodes };
    });
  },

  updateLayoutPositioning: (id, positioning) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked) return;
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked) return s;
      let nodes = { ...s.nodes, [id]: { ...n, layoutPositioning: positioning, layoutDirty: true } };
      const par = n.parentId;
      if (par) nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
      return { nodes };
    });
  },

  updateConstraints: (id, patch) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked) return;
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.locked) return s;
      return { nodes: { ...s.nodes, [id]: { ...n, ...patch } } };
    });
  },

  applyAutoLayout: (parentId) => {
    const s0 = get();
    const p0 = s0.nodes[parentId];
    if (!p0 || (p0.type !== "frame" && p0.type !== "group")) return;
    get().pushHistory();
    set((s) => {
      const p = s.nodes[parentId];
      if (!p || (p.type !== "frame" && p.type !== "group")) return s;
      const nodes = deepAutoLayout({ ...s.nodes }, s.childOrder, parentId);
      return { nodes };
    });
  },

  createComponentFromSelection: () => {
    const s0 = get();
    if (!canCreateComponentFromSelection(s0.selectedIds, s0.nodes)) return;
    get().pushHistory();
    set((s) => {
      if (!canCreateComponentFromSelection(s.selectedIds, s.nodes)) return s;

      let nodes = { ...s.nodes };
      let childOrder = { ...s.childOrder };
      let tops = topLevelSelectedIds(s.selectedIds, nodes).filter((id) => {
        const n = nodes[id];
        return n && !n.locked && n.visible;
      });

      if (tops.length >= 2) {
        const grouped = groupNodesForComponent(nodes, childOrder, tops);
        if (!grouped) return s;
        nodes = grouped.nodes;
        childOrder = grouped.childOrder;
        tops = [grouped.groupId];
      }

      let rootId = tops[0]!;
      const wrapped = wrapNodeInFrameForComponent(nodes, childOrder, rootId);
      if (!wrapped) return s;
      nodes = wrapped.nodes;
      childOrder = wrapped.childOrder;
      rootId = wrapped.frameId;

      const root = nodes[rootId];
      if (!root || root.isComponent) return s;

      nodes = markNodeAsComponent(nodes, rootId);
      const parentId = nodes[rootId]!.parentId;
      if (parentId) {
        nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [parentId]);
      }

      return {
        nodes,
        childOrder,
        selectedIds: [rootId],
        leftTab: "components" as LeftTab,
        tool: "move" as Tool,
      };
    });
  },

  createInstance: (componentKey, worldX, worldY) => {
    const s0 = get();
    const masterId = resolveMasterRootId(s0.nodes, componentKey);
    if (!masterId) return;
    const master = s0.nodes[masterId];
    if (!master?.isComponent || !master.componentId) return;
    get().pushHistory();
    set((s) => {
      const masterId = resolveMasterRootId(s.nodes, componentKey);
      if (!masterId) return s;
      const master = s.nodes[masterId];
      if (!master?.isComponent || !master.componentId) return s;
      const pid = frameParentAtWorldPoint(worldX, worldY, s.nodes, s.childOrder);
      const pos = centeredLocalPointInParent(
        worldX,
        worldY,
        pid,
        s.nodes,
        master.width,
        master.height,
        s.childOrder,
      );
      const parentKey = parentListKey(pid);
      const res = cloneEditorSubtree(
        s.nodes,
        s.childOrder,
        masterId,
        pid,
        parentKey,
        (root) => ({
          ...root,
          x: pos.x,
          y: pos.y,
          sourceComponentId: masterId,
          componentId: master.componentId,
          instanceOverrides: {},
        }),
        (_old, fresh) => stripComponentFields(fresh),
      );
      if (!res) return s;
      let { nodes, childOrder, newRootId } = res;
      if (pid) nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [pid]);
      const repaired = repairNodeHierarchy(nodes, childOrder);
      return {
        nodes: repaired.nodes,
        childOrder: repaired.childOrder,
        selectedIds: [newRootId],
        tool: "move",
        placingComponentMasterId: null,
        editingTextId: null,
      };
    });
  },

  detachInstance: (instanceRootId) => {
    const s0 = get();
    const root = s0.nodes[instanceRootId];
    if (!root?.sourceComponentId || root.locked) return;
    const next = detachInstanceTree(s0.nodes, s0.childOrder, instanceRootId);
    if (!next) return;
    get().pushHistory();
    set({ nodes: next, selectedIds: [instanceRootId] });
  },

  updateInstanceOverride: (instanceRootId, targetNodeId, patch) => {
    const s0 = get();
    const root = s0.nodes[instanceRootId];
    if (!root?.sourceComponentId || root.locked) return;
    get().pushHistory();
    set((s) => {
      const root2 = s.nodes[instanceRootId];
      if (!root2?.sourceComponentId || root2.locked) return s;
      const io: Record<string, Record<string, unknown>> = { ...(root2.instanceOverrides ?? {}) };
      const prev =
        io[targetNodeId] && typeof io[targetNodeId] === "object" && !Array.isArray(io[targetNodeId])
          ? { ...(io[targetNodeId] as Record<string, unknown>) }
          : {};
      io[targetNodeId] = { ...prev, ...patch };
      return {
        nodes: {
          ...s.nodes,
          [instanceRootId]: { ...root2, instanceOverrides: io },
        },
      };
    });
  },

  createVariantFromComponent: (componentKey) => {
    const s0 = get();
    const masterId = resolveMasterRootId(s0.nodes, componentKey);
    if (!masterId) return;
    const m0 = s0.nodes[masterId];
    if (!m0?.isComponent || m0.locked) return;
    get().pushHistory();
    set((s) => {
      const masterId = resolveMasterRootId(s.nodes, componentKey);
      if (!masterId) return s;
      const m = s.nodes[masterId];
      if (!m?.isComponent || m.locked) return s;
      const OFFSET = 24;
      const vg = m.variantGroupId ?? newVariantGroupId();
      const siblingCount =
        (m.variantGroupId
          ? Object.values(s.nodes).filter((x) => x.variantGroupId === vg).length
          : 0) + 1;
      const res = cloneEditorSubtree(
        s.nodes,
        s.childOrder,
        masterId,
        m.parentId,
        parentListKey(m.parentId),
        (root) => ({
          ...root,
          isComponent: true,
          componentId: newComponentId(),
          variantGroupId: vg,
          variantProperties: {
            ...(m.variantProperties ?? {}),
            Variant: `V${siblingCount + 1}`,
          },
          name: `${m.name} · variant`,
        }),
        (old, fresh) => {
          let next = stripComponentFields(fresh);
          if (old.id === masterId) {
            next = { ...next, x: next.x + OFFSET, y: next.y + OFFSET };
          }
          return next;
        },
      );
      if (!res) return s;
      let nodes = res.nodes;
      const childOrder = res.childOrder;
      if (!m.variantGroupId) {
        nodes = { ...nodes, [masterId]: { ...m, variantGroupId: vg } };
      }
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(m.parentId)]);
      return {
        nodes,
        childOrder,
        selectedIds: [res.newRootId],
        tool: "move",
        editingTextId: null,
      };
    });
  },

  updateVariantProperties: (componentKey, properties) => {
    const s0 = get();
    const id0 = resolveMasterRootId(s0.nodes, componentKey);
    if (!id0) return;
    const n0 = s0.nodes[id0];
    if (!n0?.isComponent || n0.locked) return;
    get().pushHistory();
    set((s) => {
      const id = resolveMasterRootId(s.nodes, componentKey);
      if (!id) return s;
      const n = s.nodes[id];
      if (!n?.isComponent || n.locked) return s;
      return {
        nodes: {
          ...s.nodes,
          [id]: {
            ...n,
            variantProperties: { ...(n.variantProperties ?? {}), ...properties },
          },
        },
      };
    });
  },

  duplicateSingle: (id) => {
    const s0 = get();
    const tops0 = topLevelSelectedIds([id], s0.nodes).filter((tid) => {
      const nn = s0.nodes[tid];
      return nn && !nn.locked && nn.visible;
    });
    if (tops0.length === 0) return;
    if (!s0.nodes[tops0[0]!]) return;
    get().pushHistory();
    set((s) => {
      const offset = 10 / Math.max(s.zoom, 0.01);
      const cloned = cloneTopLevelSelectionState({ ...s, selectedIds: [id] }, offset);
      if (!cloned) return s;
      return {
        ...cloned,
        contextMenu: null,
      };
    });
  },

  deleteSingle: (id) => {
    const s0 = get();
    const tops0 = topLevelSelectedIds([id], s0.nodes).filter((tid) => {
      const nn = s0.nodes[tid];
      return nn && !nn.locked && nn.visible;
    });
    if (tops0.length === 0) return;
    get().pushHistory();
    set((s) => {
      const tops = topLevelSelectedIds([id], s.nodes).filter((tid) => {
        const nn = s.nodes[tid];
        return nn && !nn.locked && nn.visible;
      });
      if (tops.length === 0) return s;
      const parentsToRelayout = new Set<string>();
      for (const root of tops) {
        parentsToRelayout.add(parentListKey(s.nodes[root]!.parentId));
      }
      const toRemove = new Set<string>();
      for (const root of tops) {
        for (const tid of collectSubtreeIds(root, s.childOrder)) {
          toRemove.add(tid);
        }
      }
      let nodes = { ...s.nodes };
      const childOrder: Record<string, string[]> = {};
      for (const [k, arr] of Object.entries(s.childOrder)) {
        childOrder[k] = arr.filter((tid) => !toRemove.has(tid));
      }
      for (const tid of toRemove) {
        delete nodes[tid];
        delete childOrder[tid];
      }
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, parentsToRelayout);
      return {
        nodes,
        childOrder,
        selectedIds: [],
        editingTextId: null,
        contextMenu: null,
        layerRenameId: null,
      };
    });
  },

  resizeNode: (id, handle, startBounds, currentPoint, modifiers, opts) => {
    if (get().transformInteractionMode === "rotate") return;
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const pre = get();
      const n0 = pre.nodes[id];
      if (n0 && !n0.locked && n0.visible) get().pushHistory();
    }
    set((s) => {
      if (s.transformInteractionMode === "rotate") return s;
      const n = s.nodes[id];
      if (!n || n.locked || !n.visible) return s;
      const kind: ResizeKind =
        n.type === "rectangle" ||
        n.type === "ellipse" ||
        n.type === "frame" ||
        n.type === "text" ||
        n.type === "line" ||
        n.type === "arrow" ||
        n.type === "polygon" ||
        n.type === "path" ||
        n.type === "group" ||
        n.type === "image"
          ? n.type
          : "rectangle";
      const rotated = hasRotation(n.rotation);
      /** Resize drags on rotated layers pass pointer in node-local space; bounds are 0,0,w,h. */
      const resizeStart: Bounds = rotated
        ? { x: 0, y: 0, width: startBounds.width, height: startBounds.height }
        : startBounds;
      const next = computeResizedBounds(handle, resizeStart, currentPoint, modifiers, kind);
      let x = rotated ? n.x : finiteCoord(next.x, n.x);
      let y = rotated ? n.y : finiteCoord(next.y, n.y);
      const width = finiteDimension(next.width, RESIZE_MIN_DIMENSION);
      const height = finiteDimension(next.height, RESIZE_MIN_DIMENSION);

      if (opts?.fixedWorld && rotated) {
        const centerScale = modifiers.shiftKey && modifiers.altKey;
        const anchorLocal = centerScale
          ? { x: width / 2, y: height / 2 }
          : getResizeAnchorLocal(handle, width, height);
        const solved = solveNodeXYForAnchorWorld(
          n,
          s.nodes,
          width,
          height,
          anchorLocal,
          opts.fixedWorld,
          { x: n.x, y: n.y },
        );
        x = solved.x;
        y = solved.y;
      }

      const content = buildResizeContentPatches(n, startBounds, { x, y, width, height }, handle, modifiers);
      let nodePatch: Partial<EditorNode> = { x, y, width, height, ...content };
      if (n.type === "text") {
        const mode = n.textResizeMode ?? "auto-width";
        const widthChanged = width !== startBounds.width;
        if (mode === "auto-width" && widthChanged && (handle === "e" || handle === "w" || handle === "se" || handle === "sw" || handle === "ne" || handle === "nw")) {
          nodePatch = { ...nodePatch, ...textResizePatch("auto-height") };
        }
        const layoutPatch = textLayoutPatchForNode(
          { ...n, ...nodePatch },
          n.content ?? "",
        );
        if (layoutPatch) nodePatch = { ...nodePatch, ...layoutPatch };
      }
      let nodes: Record<string, EditorNode> = {
        ...s.nodes,
        [id]: { ...n, ...nodePatch },
      };

      const sx = startBounds.width > 0 ? width / startBounds.width : 1;
      const sy = startBounds.height > 0 ? height / startBounds.height : 1;
      const uniform = isProportionalResize(handle, modifiers)
        ? Math.max(sx, sy)
        : Math.sqrt(Math.max(0, sx * sy));

      const isContainer = n.type === "frame" || n.type === "group";
      const layoutMode = n.layoutMode ?? "none";
      if (isContainer && layoutMode === "none") {
        if (shouldProportionalFrameScale(handle, modifiers)) {
          const childPatches = scaleSubtreeContentPatches(id, nodes, s.childOrder, sx, sy, uniform);
          for (const [cid, patch] of Object.entries(childPatches)) {
            const cn = nodes[cid];
            if (cn && !cn.locked) nodes[cid] = { ...cn, ...patch };
          }
        } else {
          const cp = constraintResizeChildPatches(
            id,
            toLayoutMap(nodes),
            s.childOrder,
            n.width,
            n.height,
            width,
            height,
          );
          for (const [cid, patch] of Object.entries(cp)) {
            const cn = nodes[cid];
            if (cn && !cn.locked) nodes[cid] = { ...cn, ...patch };
          }
        }
      } else if (isContainer && layoutMode !== "none") {
        const sizingPatch = layoutSizingPatchesForManualResize(
          n,
          width !== startBounds.width,
          height !== startBounds.height,
        );
        if (Object.keys(sizingPatch).length > 0) {
          nodes[id] = { ...nodes[id]!, ...sizingPatch };
        }
        nodes = deepAutoLayout(nodes, s.childOrder, id);
      }
      if (n.parentId) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId]);
      }
      const merged = nodes[id]!;
      warnInvalidNodeGeometry("resizeNode", id, merged, nodes);
      return { nodes };
    });
  },

  resizeFrameWithConstraints: (frameId, newBounds, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const n0 = get().nodes[frameId];
      if (n0 && !n0.locked) get().pushHistory();
    }
    set((s) => {
      const n = s.nodes[frameId];
      if (!n || n.locked || (n.type !== "frame" && n.type !== "group")) return s;
      const oldW = n.width;
      const oldH = n.height;
      const W = Math.max(RESIZE_MIN_DIMENSION, newBounds.width);
      const H = Math.max(RESIZE_MIN_DIMENSION, newBounds.height);
      const next: EditorNode = {
        ...n,
        width: W,
        height: H,
        ...(newBounds.x !== undefined ? { x: newBounds.x } : {}),
        ...(newBounds.y !== undefined ? { y: newBounds.y } : {}),
      };
      let nodes: Record<string, EditorNode> = { ...s.nodes, [frameId]: next };
      const layoutMode = next.layoutMode ?? "none";
      if (layoutMode === "none") {
        const cp = constraintResizeChildPatches(
          frameId,
          toLayoutMap(nodes),
          s.childOrder,
          oldW,
          oldH,
          W,
          H,
        );
        for (const [cid, patch] of Object.entries(cp)) {
          const cn = nodes[cid];
          if (cn && !cn.locked) nodes[cid] = { ...cn, ...patch };
        }
      } else {
        const sizingPatch = layoutSizingPatchesForManualResize(
          next,
          Math.abs(W - oldW) > 0.01,
          Math.abs(H - oldH) > 0.01,
        );
        if (Object.keys(sizingPatch).length > 0) {
          nodes[frameId] = { ...nodes[frameId]!, ...sizingPatch };
        }
        nodes = deepAutoLayout(nodes, s.childOrder, frameId);
      }
      if (next.parentId && !opts?.skipParentRelayout) {
        nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [next.parentId]);
      }
      return { nodes };
    });
  },

  openResponsivePreview: (frameId) => {
    set((s) => {
      let nodes = { ...s.nodes };
      if (s.responsivePreview) {
        for (const [bid, g] of Object.entries(s.responsivePreview.geomBackup)) {
          const nn = nodes[bid];
          if (nn) nodes[bid] = { ...nn, ...g };
        }
      }
      const n = nodes[frameId];
      if (!n || n.locked || (n.type !== "frame" && n.type !== "group")) {
        return { nodes, responsivePreview: null };
      }
      const subtree = collectSubtreeIds(frameId, s.childOrder);
      const geomBackup: Record<string, { x: number; y: number; width: number; height: number }> = {};
      for (const tid of subtree) {
        const t = nodes[tid];
        if (!t) continue;
        geomBackup[tid] = { x: t.x, y: t.y, width: t.width, height: t.height };
      }
      return {
        nodes,
        responsivePreview: {
          frameId,
          geomBackup,
          draftWidth: n.width,
          draftHeight: n.height,
        },
      };
    });
  },

  updateResponsivePreviewBounds: (width, height) => {
    set((s) => {
      const rp = s.responsivePreview;
      if (!rp) return s;
      let nodes = { ...s.nodes };
      for (const [bid, g] of Object.entries(rp.geomBackup)) {
        const nn = nodes[bid];
        if (nn) nodes[bid] = { ...nn, ...g };
      }
      const fr = nodes[rp.frameId];
      if (!fr || fr.locked) return { ...s, responsivePreview: null };
      const oldW = fr.width;
      const oldH = fr.height;
      const W = Math.max(RESIZE_MIN_DIMENSION, width);
      const H = Math.max(RESIZE_MIN_DIMENSION, height);
      nodes[rp.frameId] = { ...fr, width: W, height: H };
      const layoutMode = fr.layoutMode ?? "none";
      if (layoutMode === "none") {
        const cp = constraintResizeChildPatches(
          rp.frameId,
          toLayoutMap(nodes),
          s.childOrder,
          oldW,
          oldH,
          W,
          H,
        );
        for (const [cid, patch] of Object.entries(cp)) {
          const cn = nodes[cid];
          if (cn && !cn.locked) nodes[cid] = { ...cn, ...patch };
        }
      } else {
        nodes = deepAutoLayout(nodes, s.childOrder, rp.frameId);
      }
      const par = nodes[rp.frameId]?.parentId;
      if (par) nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
      return {
        nodes,
        responsivePreview: { ...rp, draftWidth: W, draftHeight: H },
      };
    });
  },

  resetResponsivePreview: () => {
    set((s) => {
      const rp = s.responsivePreview;
      if (!rp) return s;
      let nodes = { ...s.nodes };
      for (const [bid, g] of Object.entries(rp.geomBackup)) {
        const nn = nodes[bid];
        if (nn) nodes[bid] = { ...nn, ...g };
      }
      const og = rp.geomBackup[rp.frameId]!;
      return {
        nodes,
        responsivePreview: { ...rp, draftWidth: og.width, draftHeight: og.height },
      };
    });
  },

  cancelResponsivePreview: () => {
    set((s) => {
      const rp = s.responsivePreview;
      if (!rp) return s;
      let nodes = { ...s.nodes };
      for (const [bid, g] of Object.entries(rp.geomBackup)) {
        const nn = nodes[bid];
        if (nn) nodes[bid] = { ...nn, ...g };
      }
      return { nodes, responsivePreview: null };
    });
  },

  applyResponsivePreview: () => {
    const rp = get().responsivePreview;
    if (!rp) return;
    const { frameId, geomBackup: gb, draftWidth, draftHeight } = rp;
    set((s) => {
      let nodes = { ...s.nodes };
      for (const [bid, g] of Object.entries(gb)) {
        const nn = nodes[bid];
        if (nn) nodes[bid] = { ...nn, ...g };
      }
      return { nodes, responsivePreview: null };
    });
    get().pushHistory();
    get().resizeFrameWithConstraints(frameId, { width: draftWidth, height: draftHeight }, { skipHistory: true });
  },

  toggleGrid: () => {
    get().pushHistory();
    set((s) => {
      const next = { showGrid: !s.showGrid };
      return { ...next, ...syncActivePageRecord({ ...s, ...next }) };
    });
  },

  toggleRulers: () => {
    set((s) => {
      const next = { showRulers: !s.showRulers };
      return { ...next, ...syncActivePageRecord({ ...s, ...next }) };
    });
  },

  setCanvasBackgroundColor: (hex, opts) => {
    const normalized = normalizeHex(hex.startsWith("#") ? hex : `#${hex}`);
    if (!normalized) return;
    const s = get();
    if (s.canvasBackgroundColor === normalized) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    set((state) => {
      const next = { canvasBackgroundColor: normalized };
      return { ...next, ...syncActivePageRecord({ ...state, ...next }) };
    });
  },

  startPlacingComment: () => {
    const s = get();
    if (s.editorMode !== "design") return;
    set({
      tool: "comment",
      isPlacingComment: true,
      activeCommentId: null,
      placingComponentMasterId: null,
    });
  },

  cancelPlacingComment: () => {
    set({
      tool: "move",
      isPlacingComment: false,
      activeCommentId: null,
    });
  },

  addComment: (point, parentNodeIdOverride) => {
    const s = get();
    if (s.editorMode !== "design" || !s.isPlacingComment || s.tool !== "comment") return;
    const hit =
      parentNodeIdOverride ??
      pickDeepestVisibleNodeAtWorldPoint(point.x, point.y, s.nodes, s.childOrder) ??
      undefined;
    const frameHit =
      pickDeepestFrameAtWorldPoint(point.x, point.y, s.nodes, s.childOrder) ?? undefined;
    get().pushHistory();
    const id = newCommentId();
    const next: EditorComment = {
      id,
      x: point.x,
      y: point.y,
      ...(hit ? { parentNodeId: hit } : {}),
      ...(frameHit ? { frameId: frameHit } : {}),
      author: defaultCommentAuthor(),
      body: "",
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };
    set({
      comments: [...s.comments, next],
      activeCommentId: id,
      isPlacingComment: false,
    });

    const st2 = get();
    if (getPaytmCraftPublicEnv().mode !== "api" || !st2.isApiBackedFile || !st2.apiFileId) return;

    const fileId = st2.apiFileId;
    const localId = id;
    const p = apiClient
      .createComment({
        fileId,
        body: next.body,
        x: next.x,
        y: next.y,
        parentNodeId: next.parentNodeId,
        frameId: next.frameId,
      })
      .then((row) => row.id);
    pendingCommentCreateByLocalId.set(localId, p);
    void p
      .then((apiId) => {
        if (abortedCommentCreates.has(localId)) {
          abortedCommentCreates.delete(localId);
          return;
        }
        set((state) => ({
          comments: state.comments.map((c) => (c.id === localId ? { ...c, id: apiId } : c)),
          activeCommentId: state.activeCommentId === localId ? apiId : state.activeCommentId,
          apiCommentsStatus: "synced" as ApiCommentsStatus,
        }));
        void getSyncProvider()
          .saveDocument(editorStateToDocument(toPersistSlice(get())))
          .catch((err) => {
            console.warn("[Paytm Craft] persist after API comment create failed", err);
          });
      })
      .catch((e) => {
        console.warn("[Paytm Craft] createComment API failed", e);
        set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
      })
      .finally(() => {
        pendingCommentCreateByLocalId.delete(localId);
      });
  },

  updateComment: (id, body) => {
    const s = get();
    const prev = s.comments.find((c) => c.id === id);
    if (!prev || prev.body === body) return;
    get().pushHistory();
    set((state) => ({
      comments: state.comments.map((c) => (c.id === id ? { ...c, body } : c)),
    }));
    if (getPaytmCraftPublicEnv().mode !== "api" || !get().isApiBackedFile) return;
    void resolveCommentServerId(id).then((sid) =>
      apiClient
        .updateComment(sid, { body })
        .then(() => {
          set({ apiCommentsStatus: "synced" as ApiCommentsStatus });
        })
        .catch((e) => {
          console.warn("[Paytm Craft] updateComment API failed", e);
          set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
        }),
    );
  },

  addCommentReply: (commentId, body) => {
    if (!isNonEmptyCommentBody(body)) return;
    get().pushHistory();
    const reply: EditorCommentReply = {
      id: newReplyId(),
      author: defaultCommentAuthor("reply"),
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };
    set((state) => ({
      comments: state.comments.map((c) =>
        c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c,
      ),
    }));
  },

  resolveComment: (id) => {
    get().pushHistory();
    set((state) => ({
      comments: state.comments.map((c) => (c.id === id ? { ...c, resolved: true } : c)),
    }));
    if (getPaytmCraftPublicEnv().mode !== "api" || !get().isApiBackedFile) return;
    void resolveCommentServerId(id).then((sid) =>
      apiClient
        .updateComment(sid, { resolved: true })
        .then(() => {
          set({ apiCommentsStatus: "synced" as ApiCommentsStatus });
        })
        .catch((e) => {
          console.warn("[Paytm Craft] resolveComment API failed", e);
          set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
        }),
    );
  },

  reopenComment: (id) => {
    get().pushHistory();
    set((state) => ({
      comments: state.comments.map((c) => (c.id === id ? { ...c, resolved: false } : c)),
    }));
    if (getPaytmCraftPublicEnv().mode !== "api" || !get().isApiBackedFile) return;
    void resolveCommentServerId(id).then((sid) =>
      apiClient
        .updateComment(sid, { resolved: false })
        .then(() => {
          set({ apiCommentsStatus: "synced" as ApiCommentsStatus });
        })
        .catch((e) => {
          console.warn("[Paytm Craft] reopenComment API failed", e);
          set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
        }),
    );
  },

  deleteComment: (id, opts) => {
    const s0 = get();
    if (!s0.comments.some((c) => c.id === id)) return;
    const sidPromise = resolveCommentServerId(id);
    abortedCommentCreates.add(id);
    pendingCommentCreateByLocalId.delete(id);
    if (!opts?.skipHistory) get().pushHistory();
    set((state) => {
      let { comments } = state;
      if (opts?.pendingBody !== undefined) {
        const pb = opts.pendingBody.trim();
        if (isNonEmptyCommentBody(pb)) {
          comments = comments.map((c) => (c.id === id ? { ...c, body: pb } : c));
        }
      }
      return {
        comments: comments.filter((c) => c.id !== id),
        activeCommentId: state.activeCommentId === id ? null : state.activeCommentId,
      };
    });
    if (getPaytmCraftPublicEnv().mode !== "api" || !get().isApiBackedFile) return;
    void sidPromise
      .then((sid) =>
        apiClient.deleteComment(sid).catch((err) => {
          console.warn("[Paytm Craft] deleteComment API failed", err);
          set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
        }),
      )
      .catch(() => {
        /* Pending create rejected or never assigned a server id */
      });
  },

  setActiveCommentId: (activeCommentId) =>
    set((s) => ({
      activeCommentId,
      isPlacingComment:
        activeCommentId === null && s.tool === "comment" ? true : activeCommentId !== null ? false : s.isPlacingComment,
    })),

  toggleCommentsPanel: () => set((s) => ({ commentsPanelOpen: !s.commentsPanelOpen })),

  focusComment: (id) => {
    const s = get();
    const c = s.comments.find((x) => x.id === id);
    if (!c) return;
    const el = typeof document !== "undefined" ? document.querySelector<HTMLElement>("[data-canvas-viewport]") : null;
    const vw = el?.clientWidth ?? 800;
    const vh = el?.clientHeight ?? 600;
    const z = s.zoom;
    set({
      activeCommentId: id,
      isPlacingComment: false,
      pan: { x: vw / 2 - c.x * z, y: vh / 2 - c.y * z },
    });
  },

  startPathAt: (worldPoint) => {
    const s0 = get();
    if (s0.editorMode !== "design" || s0.tool !== "pen" || s0.penDrawingNodeId) return;
    get().pushHistory();
    set((s) => {
      if (s.editorMode !== "design" || s.tool !== "pen" || s.penDrawingNodeId) return s;

      const id = `path-${Date.now()}`;
      const pt0: PathPoint = { id: newPathPointId(), x: 0, y: 0 };
      let node: EditorNode = {
        id,
        parentId: null,
        type: "path",
        name: nextNumberedLayerName(s.nodes, "Vector"),
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        pathPoints: [pt0],
        pathClosed: false,
        fillEnabled: false,
        fillOpacity: 1,
        fill: "transparent",
        strokeColor: "#0f172a",
        strokeWidth: 2,
        strokePosition: "center",
      };
      node = normalizePathNode(node);
      const inserted = insertNodeWithFrameParenting(
        node,
        { x: worldPoint.x, y: worldPoint.y, width: node.width, height: node.height },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );

      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        penDrawingNodeId: id,
        selectedIds: [],
        tool: "pen",
      };
    });
  },

  addPathPoint: (worldPoint) => {
    const s0 = get();
    const drawId = s0.penDrawingNodeId;
    if (!drawId || s0.tool !== "pen") return;
    const path = s0.nodes[drawId];
    if (!path || path.type !== "path" || !path.pathPoints?.length) return;
    const origin = getRenderedWorldTopLeft(drawId, s0.nodes, s0.childOrder);
    const first = path.pathPoints[0]!;
    const wfx = origin.x + first.x;
    const wfy = origin.y + first.y;
    if (path.pathPoints.length >= 2 && Math.hypot(worldPoint.x - wfx, worldPoint.y - wfy) <= 12) {
      get().finishPath(true);
      return;
    }
    set((s) => {
      const n = s.nodes[drawId];
      if (!n || n.type !== "path" || !n.pathPoints) return s;
      const nOrigin = getRenderedWorldTopLeft(drawId, s.nodes, s.childOrder);
      const plx = worldPoint.x - nOrigin.x;
      const ply = worldPoint.y - nOrigin.y;
      const pts = [...n.pathPoints, { id: newPathPointId(), x: plx, y: ply }];
      let next: EditorNode = { ...n, pathPoints: pts };
      next = normalizePathNode(next);
      let nodes = { ...s.nodes, [drawId]: next };
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
      const repaired = repairNodeHierarchy(nodes, s.childOrder);
      return { nodes: repaired.nodes, childOrder: repaired.childOrder };
    });
  },

  addPathPointDrag: (anchorWorld, dragWorld) => {
    const s0 = get();
    const drawId = s0.penDrawingNodeId;
    if (!drawId || s0.tool !== "pen") return;
    const path = s0.nodes[drawId];
    if (!path || path.type !== "path" || !path.pathPoints?.length) return;

    const origin = getRenderedWorldTopLeft(drawId, s0.nodes, s0.childOrder);
    const first = path.pathPoints[0]!;
    const wfx = origin.x + first.x;
    const wfy = origin.y + first.y;
    if (path.pathPoints.length >= 2 && Math.hypot(anchorWorld.x - wfx, anchorWorld.y - wfy) <= 12) {
      get().finishPath(true);
      return;
    }

    set((s) => {
      const n = s.nodes[drawId];
      if (!n || n.type !== "path" || !n.pathPoints?.length) return s;
      const nOrigin = getRenderedWorldTopLeft(drawId, s.nodes, s.childOrder);
      const anchorLocal = {
        x: anchorWorld.x - nOrigin.x,
        y: anchorWorld.y - nOrigin.y,
      };
      const dragLocal = {
        x: dragWorld.x - nOrigin.x,
        y: dragWorld.y - nOrigin.y,
      };
      const hx = dragLocal.x - anchorLocal.x;
      const hy = dragLocal.y - anchorLocal.y;

      const pts = [...n.pathPoints];
      const prevIdx = pts.length - 1;
      const prev = pts[prevIdx]!;
      pts[prevIdx] = {
        ...prev,
        handleOut: { x: hx, y: hy },
      };

      const newPt: PathPoint = {
        id: newPathPointId(),
        x: anchorLocal.x,
        y: anchorLocal.y,
        handleIn: { x: -hx, y: -hy },
      };
      pts.push(newPt);

      let next: EditorNode = { ...n, pathPoints: pts };
      next = normalizePathNode(next);
      let nodes = { ...s.nodes, [drawId]: next };
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
      const repaired = repairNodeHierarchy(nodes, s.childOrder);
      return { nodes: repaired.nodes, childOrder: repaired.childOrder };
    });
  },

  finishPath: (asClosed) => {
    const id = get().penDrawingNodeId;
    if (!id) return;
    const closed = Boolean(asClosed);
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.type !== "path") return { ...s, penDrawingNodeId: null };
      const pts = n.pathPoints ?? [];
      if (pts.length < 2) {
        const parentRef = n.parentId;
        const { nodes, childOrder } = removeNodeAndDescendants(s, id);
        const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
        return {
          ...s,
          nodes: nodes2,
          childOrder,
          penDrawingNodeId: null,
          selectedIds: [],
          pathEditModeNodeId: null,
          objectEditModeNodeId: null,
          selectedPathPointId: null,
        };
      }
      let next: EditorNode = { ...n, pathClosed: closed };
      next = normalizePathNode(next);
      let nodes = { ...s.nodes, [id]: next };
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
      const repaired = repairNodeHierarchy(nodes, s.childOrder);
      return {
        ...s,
        nodes: repaired.nodes,
        childOrder: repaired.childOrder,
        penDrawingNodeId: null,
        selectedIds: [id],
        pathEditModeNodeId: null,
        objectEditModeNodeId: null,
        selectedPathPointId: null,
      };
    });
  },

  cancelPath: () => {
    const id = get().penDrawingNodeId;
    if (!id) return;
    set((s) => {
      if (!s.nodes[id]) return { ...s, penDrawingNodeId: null };
      const parentRef = s.nodes[id]?.parentId;
      const { nodes, childOrder } = removeNodeAndDescendants(s, id);
      const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
      return {
        ...s,
        nodes: nodes2,
        childOrder,
        penDrawingNodeId: null,
        selectedIds: [],
      };
    });
  },

  startPencilStroke: (worldPoint) => {
    const s0 = get();
    if (s0.editorMode !== "design" || s0.tool !== "pencil") return;
    if (s0.pencilDrawingNodeId) get().cancelPencilStroke();
    get().pushHistory();
    set((s) => {
      if (s.editorMode !== "design" || s.tool !== "pencil") return s;
      const id = `path-${Date.now()}`;
      const { defaultText } = canvasChromeForeground(s.canvasBackgroundColor);
      const strokeWidth = clampStrokeWidth(s.pencilStrokeWidth || DEFAULT_PENCIL_STROKE_WIDTH);
      const pt0: PathPoint = { id: newPathPointId(), x: 0, y: 0 };
      let node: EditorNode = {
        id,
        parentId: null,
        type: "path",
        name: nextNumberedLayerName(s.nodes, "Freehand"),
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        visible: true,
        locked: false,
        expanded: true,
        pathPoints: [pt0],
        pathClosed: false,
        fillEnabled: false,
        fillOpacity: 1,
        fill: "transparent",
        strokeColor: defaultText,
        strokeEnabled: true,
        strokeWidth,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        strokePosition: "center",
        strokeWidthProfile: "uniform",
      };
      node = normalizePathNode(node);
      const inserted = insertNodeWithFrameParenting(
        node,
        { x: worldPoint.x, y: worldPoint.y, width: node.width, height: node.height },
        s.nodes,
        s.childOrder,
        s.selectedIds,
      );
      return {
        nodes: inserted.nodes,
        childOrder: inserted.childOrder,
        pencilDrawingNodeId: id,
        selectedIds: [],
        tool: "pencil",
      };
    });
  },

  extendPencilStroke: (worldPoint) => {
    get().extendPencilStrokeCoalesced([worldPoint]);
  },

  extendPencilStrokeCoalesced: (worldPoints) => {
    if (worldPoints.length === 0) return;
    const s0 = get();
    const drawId = s0.pencilDrawingNodeId;
    if (!drawId || s0.tool !== "pencil") return;
    const path = s0.nodes[drawId];
    if (!path || path.type !== "path" || !path.pathPoints?.length) return;
    set((s) => {
      const n = s.nodes[drawId];
      if (!n || n.type !== "path" || !n.pathPoints?.length) return s;
      const nOrigin = getRenderedWorldTopLeft(drawId, s.nodes, s.childOrder);
      let pts = n.pathPoints;
      let last = pts[pts.length - 1]!;
      let changed = false;
      for (const worldPoint of worldPoints) {
        const lx = worldPoint.x - nOrigin.x;
        const ly = worldPoint.y - nOrigin.y;
        const firstSample = pts.length === 1;
        if (
          !firstSample &&
          !shouldSampleFreehandPoint(last.x, last.y, lx, ly, s.zoom)
        ) {
          continue;
        }
        const id = newPathPointId();
        pts = [...pts, { id, x: lx, y: ly }];
        last = pts[pts.length - 1]!;
        changed = true;
      }
      if (!changed) return s;
      let next: EditorNode = { ...n, pathPoints: pts };
      next = normalizePathNode(next);
      return { ...s, nodes: { ...s.nodes, [drawId]: next } };
    });
  },

  finishPencilStroke: () => {
    const id = get().pencilDrawingNodeId;
    if (!id) return;
    const s0 = get();
    const path = s0.nodes[id];
    if (!path || path.type !== "path" || !path.pathPoints?.length) {
      get().cancelPencilStroke();
      return;
    }
    const epsilon = 1.5 / Math.max(s0.zoom, 0.01);
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.type !== "path" || !n.pathPoints) {
        return { ...s, pencilDrawingNodeId: null };
      }
      const raw = n.pathPoints;
      let simplified = simplifyPolyline(
        raw.map((p) => ({ x: p.x, y: p.y })),
        epsilon,
      );
      if (simplified.length < 2 && raw.length >= 2) {
        simplified = [
          { x: raw[0]!.x, y: raw[0]!.y },
          { x: raw[raw.length - 1]!.x, y: raw[raw.length - 1]!.y },
        ];
      }
      if (simplified.length < 2) {
        if (raw.length >= 1) {
          const p = raw[0]!;
          simplified = [
            { x: p.x, y: p.y },
            { x: p.x + 0.5, y: p.y + 0.5 },
          ];
        } else {
          const parentRef = n.parentId;
          const { nodes, childOrder } = removeNodeAndDescendants(s, id);
          const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
          return {
            ...s,
            nodes: nodes2,
            childOrder,
            pencilDrawingNodeId: null,
            selectedIds: [],
          };
        }
      }
      const pts: PathPoint[] = simplified.map((p) => ({
        id: newPathPointId(),
        x: p.x,
        y: p.y,
      }));
      let next: EditorNode = { ...n, pathPoints: pts, pathClosed: false };
      next = normalizePathNode(next);
      let nodes = { ...s.nodes, [id]: next };
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
      const repaired = repairNodeHierarchy(nodes, s.childOrder);
      return {
        ...s,
        nodes: repaired.nodes,
        childOrder: repaired.childOrder,
        pencilDrawingNodeId: null,
        tool: "move",
        selectedIds: [id],
        pathEditModeNodeId: null,
        objectEditModeNodeId: null,
        selectedPathPointId: null,
      };
    });
    get().setTool("move");
  },

  cancelPencilStroke: () => {
    const id = get().pencilDrawingNodeId;
    if (!id) return;
    set((s) => {
      if (!s.nodes[id]) return { ...s, pencilDrawingNodeId: null };
      const parentRef = s.nodes[id]?.parentId;
      const { nodes, childOrder } = removeNodeAndDescendants(s, id);
      const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
      return {
        ...s,
        nodes: nodes2,
        childOrder,
        pencilDrawingNodeId: null,
        selectedIds: [],
      };
    });
  },

  updatePathPoint: (nodeId, pointId, patch, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    set((s) => {
      const n = s.nodes[nodeId];
      if (!n || n.type !== "path" || !n.pathPoints) return s;
      const mirroring = n.pathHandleMirroring ?? "none";
      const pts = n.pathPoints.map((p) => {
        if (p.id !== pointId) return p;
        let merged: PathPoint = { ...p };
        if (patch.x !== undefined) merged.x = patch.x;
        if (patch.y !== undefined) merged.y = patch.y;
        const handlePatch: Partial<PathPoint> = {};
        if ("handleIn" in patch) handlePatch.handleIn = patch.handleIn;
        if ("handleOut" in patch) handlePatch.handleOut = patch.handleOut;
        if ("handleIn" in patch || "handleOut" in patch) {
          const movedWhich =
            "handleIn" in patch && !("handleOut" in patch)
              ? "in"
              : "handleOut" in patch && !("handleIn" in patch)
                ? "out"
                : undefined;
          merged = mergePathPointHandles(merged, handlePatch, mirroring, movedWhich);
        }
        return merged;
      });
      let next: EditorNode = { ...n, pathPoints: pts };
      next = normalizePathNode(next);
      let nodes = { ...s.nodes, [nodeId]: next };
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
      return { nodes };
    });
  },

  deletePathPoint: (nodeId, pointId) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[nodeId];
      if (!n || n.type !== "path" || !n.pathPoints) return s;
      const nextPts = n.pathPoints.filter((p) => p.id !== pointId);
      if (nextPts.length < 2) {
        const parentRef = n.parentId;
        const { nodes, childOrder } = removeNodeAndDescendants(s, nodeId);
        const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
        return {
          ...s,
          nodes: nodes2,
          childOrder,
          selectedIds: s.selectedIds.filter((x) => x !== nodeId),
          pathEditModeNodeId: s.pathEditModeNodeId === nodeId ? null : s.pathEditModeNodeId,
          selectedPathPointId: null,
        };
      }
      let next: EditorNode = { ...n, pathPoints: nextPts };
      next = normalizePathNode(next);
      let nodes = { ...s.nodes, [nodeId]: next };
      nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
      return {
        ...s,
        nodes,
        selectedPathPointId: s.selectedPathPointId === pointId ? null : s.selectedPathPointId,
      };
    });
  },

  togglePathClosed: (nodeId) => {
    get().pushHistory();
    set((s) => {
      const n = s.nodes[nodeId];
      if (!n || n.type !== "path") return s;
      return { nodes: { ...s.nodes, [nodeId]: { ...n, pathClosed: !n.pathClosed } } };
    });
  },

  setPathEditMode: (nodeId) =>
    set({
      pathEditModeNodeId: nodeId,
      shapeEditModeNodeId: null,
      selectedPathPointId: null,
    }),

  enterShapeEditMode: (nodeId) => {
    const s = get();
    const id = nodeId ?? s.selectedIds[0];
    if (!id) return;
    const n = s.nodes[id];
    if (!n || n.locked || n.visible === false) return;
    if (s.editingTextId || s.penDrawingNodeId || s.pencilDrawingNodeId) return;
    if (n.type === "text") {
      set({ editingTextId: id, shapeEditModeNodeId: null, pathEditModeNodeId: null });
      return;
    }
    if (shouldEnterPathEditOnEdit(n)) {
      set({
        pathEditModeNodeId: id,
        shapeEditModeNodeId: null,
        selectedIds: [id],
        selectedPathPointId: null,
        objectEditModeNodeId: null,
      });
      return;
    }
    if (!canEnterParametricShapeEdit(n)) return;
    set({
      shapeEditModeNodeId: id,
      pathEditModeNodeId: null,
      selectedIds: [id],
      selectedPathPointId: null,
      objectEditModeNodeId: null,
    });
  },

  exitShapeEditMode: () => set({ shapeEditModeNodeId: null }),

  exitAllEditModes: () =>
    set({
      shapeEditModeNodeId: null,
      pathEditModeNodeId: null,
      editingTextId: null,
      selectedPathPointId: null,
    }),

  toggleEditMode: (nodeId) => {
    const s = get();
    const id = nodeId ?? s.selectedIds[0];
    if (!id) return;
    if (s.editingTextId === id) {
      set({ editingTextId: null });
      return;
    }
    if (s.pathEditModeNodeId === id || s.shapeEditModeNodeId === id) {
      get().exitAllEditModes();
      return;
    }
    get().enterShapeEditMode(id);
  },

  setTransformInteractionMode: (mode) => set({ transformInteractionMode: mode }),

  setIsMovingSelection: (active) => set({ isMovingSelection: active }),

  setRotateHandleHovered: (hovered, handle) =>
    set({
      rotateHandleHovered: hovered,
      rotateHandleHoverHandle: hovered ? (handle ?? null) : null,
    }),

  enterVectorEditMode: (nodeId) => {
    const s = get();
    const id = nodeId ?? s.selectedIds[0];
    if (!id) return;
    const raw = s.nodes[id];
    if (!raw || raw.locked || raw.visible === false) return;
    if (
      raw.type !== "rectangle" &&
      raw.type !== "ellipse" &&
      raw.type !== "line" &&
      raw.type !== "polygon" &&
      raw.type !== "path"
    ) {
      return;
    }
    if (s.editingTextId || s.penDrawingNodeId || s.pencilDrawingNodeId) return;
    const needsConvert = raw.type !== "path" && raw.type !== "polygon";
    if (needsConvert) get().pushHistory();
    set((st) => {
      const current = st.nodes[id];
      if (!current) return st;
      let converted: EditorNode;
      if (current.type === "polygon") {
        const built = shapeToPathPoints(current);
        if (!built) return st;
        converted = {
          ...current,
          pathPoints: built.pathPoints,
          pathClosed: built.pathClosed,
        };
      } else {
        const c = convertNodeToPath(current);
        if (!c) return st;
        converted = ensureRoundedRectPathPoints(c);
      }
      const nodes =
        needsConvert || converted !== current
          ? { ...st.nodes, [id]: converted }
          : st.nodes;
      return {
        nodes,
        pathEditModeNodeId: id,
        shapeEditModeNodeId: null,
        selectedIds: [id],
        selectedPathPointId: null,
        objectEditModeNodeId: null,
      };
    });
  },

  setPathHandleMirroring: (mode) => {
    const id = get().pathEditModeNodeId ?? get().selectedIds[0];
    if (!id) return;
    get().pushHistory();
    set((s) => {
      const n = s.nodes[id];
      if (!n || n.type !== "path") return s;
      return { nodes: { ...s.nodes, [id]: { ...n, pathHandleMirroring: mode } } };
    });
  },

  setSelectedPathPointId: (id) => set({ selectedPathPointId: id }),

  setApiFileSession: (fileId, workspaceId) => {
    pendingCommentCreateByLocalId.clear();
    abortedCommentCreates.clear();
    set({
      apiFileId: fileId,
      apiWorkspaceId: workspaceId,
      isApiBackedFile: true,
      apiCommentsStatus: "loading" as ApiCommentsStatus,
      versionHistoryOpen: false,
      apiVersionsStatus: "idle" as ApiVersionsStatus,
      apiFileVersions: [],
    });
    void get().loadApiComments();
  },

  clearApiFileSession: () => {
    pendingCommentCreateByLocalId.clear();
    abortedCommentCreates.clear();
    set({
      apiFileId: undefined,
      apiWorkspaceId: undefined,
      isApiBackedFile: false,
      apiCommentsStatus: "idle" as ApiCommentsStatus,
      versionHistoryOpen: false,
      apiVersionsStatus: "idle" as ApiVersionsStatus,
      apiFileVersions: [],
    });
  },

  saveCurrentDocumentAsApiFile: async () => {
    if (getPaytmCraftPublicEnv().mode !== "api") return;
    const st = get();
    if (st.apiFileId) return;
    const wid = getActiveMockWorkspace().id;
    const doc = editorStateToDocument(toPersistSlice(st));
    set({ documentSaveStatus: "saving" });
    try {
      const created = await apiClient.createFile({
        workspaceId: wid,
        name: sanitizeDocumentFilename(st.fileName) || "Untitled",
        documentJson: doc,
      });
      try {
        await getSyncProvider().saveDocument(doc);
      } catch (e) {
        console.warn("[Paytm Craft] local backup after Save as API failed", e);
      }
      set({
        apiFileId: created.id,
        apiWorkspaceId: wid,
        isApiBackedFile: true,
        documentSaveStatus: "saved-api" as DocumentSaveStatus,
        versionHistoryOpen: false,
        apiVersionsStatus: "idle" as ApiVersionsStatus,
        apiFileVersions: [],
      });
      pendingCommentCreateByLocalId.clear();
      abortedCommentCreates.clear();
      void get().loadApiComments();
    } catch (e) {
      console.warn("[Paytm Craft] saveCurrentDocumentAsApiFile failed", e);
      set({ documentSaveStatus: "unsaved" });
    }
  },

  loadApiComments: async () => {
    const st = get();
    if (getPaytmCraftPublicEnv().mode !== "api" || !st.isApiBackedFile || !st.apiFileId) {
      set({ apiCommentsStatus: "idle" as ApiCommentsStatus });
      return;
    }
    const fileId = st.apiFileId;
    const localComments = st.comments;
    set({ apiCommentsStatus: "loading" as ApiCommentsStatus });
    try {
      const list = await apiClient.listComments(fileId);
      const apiMapped = list.map((c) => editorCommentFromCraftApi(c));
      const byId = new Map<string, EditorComment>();
      for (const c of localComments) {
        byId.set(c.id, c);
      }
      for (const c of apiMapped) {
        const prev = byId.get(c.id);
        byId.set(c.id, {
          ...c,
          replies: prev && prev.replies.length > 0 ? prev.replies : c.replies,
        });
      }
      const merged = Array.from(byId.values()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      set({ comments: merged, apiCommentsStatus: "synced" as ApiCommentsStatus });
      void getSyncProvider()
        .saveDocument(editorStateToDocument(toPersistSlice(get())))
        .catch((err) => {
          console.warn("[Paytm Craft] persist after loadApiComments failed", err);
        });
    } catch (e) {
      console.warn("[Paytm Craft] loadApiComments failed", e);
      set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
    }
  },

  syncCommentToApi: (commentId) => {
    if (getPaytmCraftPublicEnv().mode !== "api" || !get().isApiBackedFile || !get().apiFileId) return;
    const c = get().comments.find((x) => x.id === commentId);
    if (!c) return;
    void resolveCommentServerId(commentId).then((sid) =>
      apiClient
        .updateComment(sid, { body: c.body, resolved: c.resolved })
        .then(() => {
          set({ apiCommentsStatus: "synced" as ApiCommentsStatus });
        })
        .catch((err) => {
          console.warn("[Paytm Craft] syncCommentToApi failed", err);
          set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
        }),
    );
  },

  deleteApiComment: (commentId) => {
    if (getPaytmCraftPublicEnv().mode !== "api" || !get().isApiBackedFile) return;
    void resolveCommentServerId(commentId).then((sid) =>
      apiClient.deleteComment(sid).catch((err) => {
        console.warn("[Paytm Craft] deleteApiComment failed", err);
        set({ apiCommentsStatus: "failed" as ApiCommentsStatus });
      }),
    );
  },

  openVersionHistory: () => {
    set({ versionHistoryOpen: true });
    void get().loadApiFileVersions();
  },

  closeVersionHistory: () => set({ versionHistoryOpen: false }),

  closeTopmostOverlay: () => {
    const s = get();
    if (s.commandMenuOpen) {
      set({ commandMenuOpen: false });
      return true;
    }
    if (s.shortcutOverlayOpen) {
      set({ shortcutOverlayOpen: false });
      return true;
    }
    if (s.versionHistoryOpen) {
      set({ versionHistoryOpen: false });
      return true;
    }
    if (s.aiModalOpen) {
      set({ aiModalOpen: false, aiModalSource: null });
      return true;
    }
    if (s.pluginMarketplaceOpen) {
      set({ pluginMarketplaceOpen: false });
      return true;
    }
    if (s.activePluginId) {
      set({ activePluginId: undefined });
      return true;
    }
    if (s.shareModalOpen) {
      set({ shareModalOpen: false });
      return true;
    }
    if (s.workspacePickerOpen) {
      set({ workspacePickerOpen: false });
      return true;
    }
    if (s.teamInviteModalOpen) {
      set({ teamInviteModalOpen: false });
      return true;
    }
    if (s.prototypePreview) {
      set({ prototypePreview: null });
      return true;
    }
    if (s.contextMenu) {
      set({ contextMenu: null });
      return true;
    }
    if (s.placingComponentMasterId) {
      set({ placingComponentMasterId: null });
      return true;
    }
    if (s.codeRoundTripOpen) {
      set({ codeRoundTripOpen: false });
      return true;
    }
    if (s.importHubOpen) {
      set({ importHubOpen: false });
      return true;
    }
    if (s.importWebModalOpen) {
      set({ importWebModalOpen: false });
      return true;
    }
    if (s.importFigmaModalOpen) {
      set({ importFigmaModalOpen: false });
      return true;
    }
    return false;
  },

  openHelpDemoChecklist: () => {
    if (typeof window !== "undefined") {
      window.open("/demo-checklist", "_blank", "noopener,noreferrer");
    }
  },

  loadApiFileVersions: async () => {
    const st = get();
    if (getPaytmCraftPublicEnv().mode !== "api" || !st.isApiBackedFile || !st.apiFileId) {
      set({
        apiVersionsStatus: "idle" as ApiVersionsStatus,
        apiFileVersions: [],
      });
      return;
    }
    set({ apiVersionsStatus: "loading" as ApiVersionsStatus });
    try {
      const list = await apiClient.listFileVersions(st.apiFileId);
      set({ apiFileVersions: list, apiVersionsStatus: "synced" as ApiVersionsStatus });
    } catch (e) {
      console.warn("[Paytm Craft] loadApiFileVersions failed", e);
      set({ apiVersionsStatus: "failed" as ApiVersionsStatus });
    }
  },

  createApiFileVersion: async (name) => {
    const st = get();
    if (!st.isApiBackedFile || !st.apiFileId) return;
    const doc = editorStateToDocument(toPersistSlice(st));
    try {
      await apiClient.createFileVersion(st.apiFileId, { name, documentJson: doc });
      await get().loadApiFileVersions();
    } catch (e) {
      console.warn("[Paytm Craft] createApiFileVersion failed", e);
      set({ apiVersionsStatus: "failed" as ApiVersionsStatus });
    }
  },

  restoreApiFileVersion: async (versionId) => {
    const st = get();
    if (!st.isApiBackedFile || !st.apiFileId) return;
    if (
      !window.confirm(
        "Restore this version? The editor will be replaced with this snapshot and the API file will be updated.",
      )
    ) {
      return;
    }
    get().pushHistory();
    try {
      const file = await apiClient.restoreFileVersion(st.apiFileId, versionId);
      const raw = file.documentJson;
      if (raw == null || !validatePaytmCraftDocument(raw)) {
        console.warn("[Paytm Craft] restoreApiFileVersion: invalid document from API");
        return;
      }
      set((s) => ({
        ...documentToEditorPatch(raw),
        guides: [],
        editingTextId: null,
        hoveredCanvasId: null,
        contextMenu: null,
        layerRenameId: null,
        placingComponentMasterId: null,
        prototypeWireDrag: null,
        selectedPrototypeLinkId: null,
        prototypePreview: null,
        responsivePreview: null,
        activeCommentId: null,
        isPlacingComment: false,
        commentsPanelOpen: false,
        penDrawingNodeId: null,
        pencilDrawingNodeId: null,
        pathEditModeNodeId: null,
  objectEditModeNodeId: null,
        selectedPathPointId: null,
        presenceUsers: [],
        showPresence: false,
        presenceActivityLog: [],
        commandMenuOpen: false,
        shortcutOverlayOpen: false,
        aiModalOpen: false,
        aiModalSource: null,
        pluginMarketplaceOpen: false,
        activePluginId: undefined,
        shareModalOpen: false,
        workspacePickerOpen: false,
        teamInviteModalOpen: false,
        versionHistoryOpen: false,
        editorMode: "design",
        tool: "move",
        leftTab: "layers",
        documentSaveStatus: "saved-api" as DocumentSaveStatus,
        documentHydrationRevision: s.documentHydrationRevision + 1,
        historyFuture: [],
      }));
      void getSyncProvider()
        .saveDocument(raw)
        .catch((err) => {
          console.warn("[Paytm Craft] persist after restore failed", err);
        });
      void get().loadApiComments();
      void get().loadApiFileVersions();
    } catch (e) {
      console.warn("[Paytm Craft] restoreApiFileVersion failed", e);
    }
  },

  saveToLocal: () => {
    set({ documentSaveStatus: "saving" });
    const st = get();
    const doc = editorStateToDocument(toPersistSlice(st));
    const shouldPushApi =
      getPaytmCraftPublicEnv().mode === "api" && st.isApiBackedFile && Boolean(st.apiFileId);

    void getSyncProvider()
      .saveDocument(doc)
      .then(() => {
        if (!shouldPushApi) {
          set({ documentSaveStatus: "saved" });
          return;
        }
        const fileId = st.apiFileId!;
        return apiClient
          .saveFile(fileId, { documentJson: doc })
          .then(() => {
            set({ documentSaveStatus: "saved-api" });
          })
          .catch((e) => {
            console.warn("[Paytm Craft] API save failed", e);
            set({ documentSaveStatus: "api-save-failed" });
          });
      })
      .catch((e) => {
        console.warn("[Paytm Craft] saveToLocal failed", e);
        set({ documentSaveStatus: "unsaved" });
      });
  },

  loadFromLocal: async () => {
    try {
      const doc = await getSyncProvider().loadDocument();
      if (!doc) return false;
      set((s) => ({ ...editorPartialFromPaytmCraftDocument(doc, s) }));
      return true;
    } catch (e) {
      console.warn("[Paytm Craft] loadFromLocal failed", e);
      return false;
    }
  },

  applySampleDocumentIfEmpty: () => {
    const s = get();
    if (!isWorkspaceEmpty(s)) return;

    let localDoc = readLocalDocument();
    if (localDoc && isBrokenOrphanedLocalDocument(localDoc)) {
      clearLocalDocument();
      localDoc = null;
    }
    if (localDoc) {
      set({
        ...documentToEditorPatch(localDoc),
        documentHydrating: false,
        documentHydrationRevision: s.documentHydrationRevision + 1,
        documentSaveStatus: "saved",
        historyPast: [],
        historyFuture: [],
      });
      return;
    }

    const mock = buildMock();
    const fields = mergeSampleDocumentFields(mock, "Paytm Craft — Product exploration");
    set({
      ...fields,
      selectedIds: [],
      guides: [],
      editingTextId: null,
      documentHydrating: false,
      documentSaveStatus: "saved",
      documentHydrationRevision: s.documentHydrationRevision + 1,
      historyPast: [],
      historyFuture: [],
    });
  },

  resetEditorBlockingState: () => {
    abortFigImport();
    set({
      documentHydrating: false,
      figImportInProgress: false,
      figImportStatus: null,
    });
  },

  applyPersistedDocumentIfClean: (doc) => {
    if (!doc) return false;
    const st = get();
    if (st.documentHydrating) return false;
    if (st.figImportInProgress) return false;
    if (st.documentSaveStatus !== "saved" && st.documentSaveStatus !== "saved-api") return false;
    const sliceFromDoc = documentToEditorPatch(doc);
    const incoming: EditorPersistSlice = {
      nodes: sliceFromDoc.nodes,
      childOrder: sliceFromDoc.childOrder,
      assets: sliceFromDoc.assets,
      designTokens: sliceFromDoc.designTokens,
      fileName: sliceFromDoc.fileName,
      selectedIds: sliceFromDoc.selectedIds,
      zoom: sliceFromDoc.zoom,
      pan: sliceFromDoc.pan,
      showGrid: sliceFromDoc.showGrid,
      showRulers: sliceFromDoc.showRulers,
      canvasBackgroundColor: sliceFromDoc.canvasBackgroundColor,
      comments: sliceFromDoc.comments,
      pages: sliceFromDoc.pages,
      pageOrder: sliceFromDoc.pageOrder,
      activePageId: sliceFromDoc.activePageId,
    };
    if (serializePersistStable(incoming) === serializePersistStable(toPersistSlice(st))) {
      return false;
    }
    const currentSlice = toPersistSlice(st);
    const currentRoots = (currentSlice.childOrder[ROOT] ?? []).length;
    const incomingRoots = (incoming.childOrder[ROOT] ?? []).length;
    const currentNodeCount = Object.keys(currentSlice.nodes).length;
    const incomingNodeCount = Object.keys(incoming.nodes).length;
    if (
      currentRoots > 0 &&
      (incomingRoots === 0 || incomingNodeCount < currentNodeCount - 50)
    ) {
      return false;
    }
    set((s) => ({ ...editorPartialFromPaytmCraftDocument(doc, s) }));
    return true;
  },

  exportDocument: () => {
    const s = get();
    const doc = editorStateToDocument(toPersistSlice(s));
    downloadJsonFile(`${sanitizeDocumentFilename(s.fileName)}.paytmcraft.json`, doc);
  },

  importDocument: async (file) => {
    try {
      const raw = await file.text();
      const doc = parsePaytmCraftDocumentJson(raw);
      if (!doc) {
        window.alert("Invalid Paytm Craft document. Expected version 1 .paytmcraft.json.");
        return;
      }
      set((s) => editorStateAfterDocumentImport(doc, s));
      void getSyncProvider()
        .saveDocument(editorStateToDocument(toPersistSlice(get())))
        .catch((e) => {
          console.warn("[Paytm Craft] persist save failed", e);
          useEditorStore.setState({ documentSaveStatus: "unsaved" });
        });
    } catch {
      window.alert("Could not import that file.");
    }
  },

  importFigmaFile: async (file) => {
    const importGen = beginFigImport();
    set({
      figImportInProgress: true,
      figImportStatus: "Reading file…",
      documentHydrating: false,
      figImportToast: null,
    });
    try {
      await waitForNextPaint();
      if (isFigImportCancelled(importGen)) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const onProgress = (message: string) => {
        if (!isFigImportCancelled(importGen)) {
          useEditorStore.setState({ figImportStatus: message });
        }
      };
      const result = await convertFigFileAsync(bytes, file.name, onProgress);
      if (isFigImportCancelled(importGen)) return;
      if (!result.ok) {
        throw new Error(result.error);
      }
      set({ figImportStatus: "Preparing canvas…" });
      const prepared = prepareDocumentForEditorImport(result.document);
      if (isFigImportCancelled(importGen)) return;
      const { finalizeFigmaImportToEditor } = await import("@/lib/figImport/finalizeFigmaImport");
      await finalizeFigmaImportToEditor({
        prepared,
        fileName: result.document.name || file.name.replace(/\.fig$/i, ""),
        runPostLayout: true,
        importGen,
      });
    } catch (e) {
      if (!isFigImportCancelled(importGen)) {
        get().resetEditorBlockingState();
        throw e;
      }
      get().resetEditorBlockingState();
    }
  },

  importFigmaFromLink: async (opts) => {
    const url = opts.url?.trim();
    let fileKey = opts.fileKey?.trim();
    let nodeId = opts.nodeId?.trim();
    if (url) {
      const parsed = parseFigmaUrl(url);
      if (parsed) {
        fileKey = fileKey || parsed.fileKey;
        nodeId = nodeId || parsed.nodeId;
      }
    }
    const accessToken = opts.accessToken?.trim() || readFigmaAccessToken() || undefined;
    const abortImport = (message: string) => {
      get().resetEditorBlockingState();
      window.alert(message);
    };
    if (!url && !fileKey) {
      abortImport("Paste a Figma design link or file key.");
      return;
    }
    if (url && !isFigmaDesignUrl(url)) {
      const bare = parseFigmaFileKey(url);
      if (!bare) {
        abortImport("Enter a valid Figma design link or file key.");
        return;
      }
    }
    if (!accessToken) {
      const server = await fetchFigmaServerConfig();
      if (!server.serverTokenValid) {
        abortImport(
          "Connect Figma once: open Import from Figma, paste your personal access token, and click Verify & connect. It stays saved in this browser. Your team can also set FIGMA_ACCESS_TOKEN in .env.local so nobody needs a personal token.",
        );
        return;
      }
    }

    const importGen = beginFigImport();
    const alreadyBusy = get().figImportInProgress;
    if (!alreadyBusy) {
      set({
        figImportInProgress: true,
        figImportStatus: "Connecting to Figma…",
        documentHydrating: false,
        figImportToast: null,
      });
    } else {
      set({ figImportStatus: "Fetching file from Figma…", documentHydrating: false });
    }
    try {
      set({ figImportStatus: "Fetching file from Figma…" });
      const doc = await importFigmaFromApi({
        accessToken,
        url: url && isFigmaDesignUrl(url) ? url : undefined,
        fileKey: fileKey || (url && !isFigmaDesignUrl(url) ? parseFigmaFileKey(url) ?? undefined : undefined),
        nodeId,
      });
      if (isFigImportCancelled(importGen)) return;
      set({ figImportStatus: "Preparing canvas…" });
      const prepared = prepareDocumentForEditorImport(doc);
      if (isFigImportCancelled(importGen)) return;
      const { finalizeFigmaImportToEditor } = await import("@/lib/figImport/finalizeFigmaImport");
      await finalizeFigmaImportToEditor({
        prepared,
        fileName: doc.name,
        runPostLayout: false,
        importGen,
      });
    } catch (e) {
      if (isFigImportCancelled(importGen)) {
        get().resetEditorBlockingState();
        return;
      }
      const message = e instanceof Error ? e.message : "Could not import from Figma.";
      set({ figImportStatus: message });
      get().resetEditorBlockingState();
      throw new Error(message);
    }
  },

  importWorkspaceFile: async (file) => {
    if (isFigmaFigFile(file)) {
      await get().importFigmaFile(file);
      return;
    }
    await get().importDocument(file);
  },

  loadWorkspaceFromPersist: (slice, apiSession) => {
    const backed = Boolean(apiSession?.apiFileId);
    pendingCommentCreateByLocalId.clear();
    abortedCommentCreates.clear();
    set((s) => ({
      nodes: slice.nodes,
      childOrder: slice.childOrder,
      assets: slice.assets ?? {},
      designTokens: slice.designTokens ?? {},
      fileName: slice.fileName,
      selectedIds: slice.selectedIds,
      zoom: slice.zoom,
      pan: slice.pan,
      showGrid: slice.showGrid,
      showRulers: slice.showRulers,
      canvasBackgroundColor: slice.canvasBackgroundColor,
      comments: slice.comments,
      pages: slice.pages,
      pageOrder: slice.pageOrder,
      activePageId: slice.activePageId,
      guides: [],
      editingTextId: null,
      hoveredCanvasId: null,
      contextMenu: null,
      layerRenameId: null,
      placingComponentMasterId: null,
      prototypeWireDrag: null,
      selectedPrototypeLinkId: null,
      prototypePreview: null,
      responsivePreview: null,
      activeCommentId: null,
      isPlacingComment: false,
      commentsPanelOpen: false,
      penDrawingNodeId: null,
      pencilDrawingNodeId: null,
      pathEditModeNodeId: null,
  objectEditModeNodeId: null,
      selectedPathPointId: null,
      presenceUsers: [],
      showPresence: false,
      presenceActivityLog: [],
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
      apiFileId: backed ? apiSession!.apiFileId : undefined,
      apiWorkspaceId: backed ? apiSession!.apiWorkspaceId : undefined,
      isApiBackedFile: backed,
      apiCommentsStatus: (backed ? "loading" : "idle") as ApiCommentsStatus,
      versionHistoryOpen: false,
      apiVersionsStatus: "idle" as ApiVersionsStatus,
      apiFileVersions: [],
      editorMode: "design",
      tool: "move",
      leftTab: "layers",
      documentSaveStatus: "saved",
      documentHydrating: false,
      documentHydrationRevision: s.documentHydrationRevision + 1,
      historyPast: [],
      historyFuture: [],
    }));
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        if (Object.keys(get().nodes).length > 0) {
          fitCanvasToImportedDocument();
        }
      });
    }
    const persistLargeWorkspace = () => {
      const save = () =>
        getSyncProvider()
          .saveDocument(editorStateToDocument(toPersistSlice(get())))
          .then(() => {
            if (!get().isApiBackedFile) {
              useEditorStore.setState({ documentSaveStatus: "saved" });
            }
          })
          .catch((e) => {
            console.warn("[Paytm Craft] persist save failed", e);
            useEditorStore.setState({ documentSaveStatus: "unsaved" });
          });

      const nodeCount = Object.keys(slice.nodes).length;
      if (nodeCount > 1_500) {
        deferFigImportSave(save);
        return Promise.resolve();
      }
      return save();
    };

    if (backed) {
      return get()
        .loadApiComments()
        .then(() => persistLargeWorkspace());
    }

    return persistLargeWorkspace();
  },

  applyGeneratedDesign: async (slice, mode, opts) => {
    const recordHistory = opts?.recordHistory !== false;
    const zoomToFit = opts?.zoomToFit !== false;

    let appliedSlice = slice;
    if (zoomToFit) {
      const el =
        typeof document !== "undefined"
          ? document.querySelector<HTMLElement>("[data-canvas-viewport]")
          : null;
      const vp = viewportForRootNodes(
        slice.nodes,
        slice.childOrder[ROOT] ?? [],
        el?.clientWidth ?? 1200,
        el?.clientHeight ?? 800,
      );
      if (vp) {
        appliedSlice = {
          ...slice,
          zoom: vp.zoom,
          pan: vp.pan,
          pages: Object.fromEntries(
            Object.entries(slice.pages).map(([id, page]) => [
              id,
              id === slice.activePageId ? { ...page, zoom: vp.zoom, pan: vp.pan } : page,
            ]),
          ),
        };
      }
    }

    const uiReset = (s: EditorState) => ({
      guides: [],
      editingTextId: null,
      hoveredCanvasId: null,
      contextMenu: null,
      layerRenameId: null,
      placingComponentMasterId: null,
      prototypeWireDrag: null,
      selectedPrototypeLinkId: null,
      prototypePreview: null,
      responsivePreview: null,
      activeCommentId: null,
      isPlacingComment: false,
      commentsPanelOpen: false,
      penDrawingNodeId: null,
      pencilDrawingNodeId: null,
      pathEditModeNodeId: null,
  objectEditModeNodeId: null,
      selectedPathPointId: null,
      presenceUsers: [],
      showPresence: false,
      presenceActivityLog: [],
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      importHubOpen: false,
      importWebModalOpen: false,
      importFigmaModalOpen: false,
      codeRoundTripOpen: false,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
      apiFileId: undefined,
      apiWorkspaceId: undefined,
      isApiBackedFile: false,
      apiCommentsStatus: "idle" as ApiCommentsStatus,
      versionHistoryOpen: false,
      apiVersionsStatus: "idle" as ApiVersionsStatus,
      apiFileVersions: [],
      editorMode: "design" as EditorMode,
      tool: "move" as Tool,
      leftTab: "layers" as LeftTab,
      documentSaveStatus: "saving" as DocumentSaveStatus,
      documentHydrationRevision: s.documentHydrationRevision + 1,
    });

    if (recordHistory) get().pushHistory();

    if (mode === "replace") {
      set((s) => {
        const nextState = {
          nodes: appliedSlice.nodes,
          childOrder: appliedSlice.childOrder,
          assets: appliedSlice.assets ?? {},
          designTokens: appliedSlice.designTokens ?? {},
          fileName: appliedSlice.fileName,
          selectedIds: appliedSlice.selectedIds,
          zoom: appliedSlice.zoom,
          pan: appliedSlice.pan,
          showGrid: appliedSlice.showGrid,
          showRulers: appliedSlice.showRulers,
          canvasBackgroundColor: appliedSlice.canvasBackgroundColor,
          comments: appliedSlice.comments,
          pages: appliedSlice.pages,
          pageOrder: appliedSlice.pageOrder,
          activePageId: appliedSlice.activePageId,
          ...uiReset(s),
          ...(recordHistory ? {} : { historyPast: [], historyFuture: [] }),
        };
        return {
          ...nextState,
          ...syncActivePageRecord({ ...s, ...nextState }),
        };
      });
    } else {
      set((s) => {
        const merged = remapPersistSliceIds(appliedSlice);
        const rootsExisting = [...(s.childOrder[ROOT] ?? [])];
        let maxRight = 80;
        for (const rid of rootsExisting) {
          const wr = worldRect(rid, s.nodes);
          maxRight = Math.max(maxRight, wr.x + wr.width);
        }
        const gap = 96;
        let xCursor = maxRight + gap;
        const newRootIds = [...(merged.childOrder[ROOT] ?? [])];
        const nodes: Record<string, EditorNode> = { ...s.nodes };
        for (const [oid, on] of Object.entries(merged.nodes)) {
          nodes[oid] = { ...on };
        }
        for (const rootId of newRootIds) {
          const n = nodes[rootId];
          if (n && !n.parentId) {
            nodes[rootId] = { ...n, x: xCursor };
            xCursor += n.width + gap;
          }
        }
        const childOrder = { ...s.childOrder };
        for (const [k, v] of Object.entries(merged.childOrder)) {
          if (k === ROOT) continue;
          childOrder[k] = v;
        }
        childOrder[ROOT] = [...rootsExisting, ...newRootIds];
        const mergedAssets = { ...s.assets, ...(merged.assets ?? {}) };
        const mergedDesignTokens = { ...s.designTokens, ...(merged.designTokens ?? {}) };
        const nextState = {
          nodes,
          childOrder,
          assets: mergedAssets,
          designTokens: mergedDesignTokens,
          selectedIds: newRootIds,
          fileName: s.fileName,
          comments: s.comments,
          ...uiReset(s),
        };
        return {
          ...nextState,
          ...syncActivePageRecord({ ...s, ...nextState }),
        };
      });
    }

    try {
      await getSyncProvider().saveDocument(editorStateToDocument(toPersistSlice(get())));
      useEditorStore.setState({ documentSaveStatus: "saved" });
    } catch (e) {
      console.warn("[Paytm Craft] persist save failed", e);
      useEditorStore.setState({ documentSaveStatus: "unsaved" });
    }
  },

  resetDocument: () => {
    const s = get();
    if (s.documentSaveStatus === "unsaved" || s.documentSaveStatus === "api-save-failed") {
      if (!window.confirm("Discard unsaved changes and create a new file?")) return;
    }
    const { nodes, childOrder } = buildMock();
    const pageInit = initialPagesFromCanvas(nodes, childOrder, {
      zoom: DEFAULT_CANVAS_ZOOM,
      pan: { x: 40, y: 24 },
      showGrid: false,
      showRulers: true,
    });
    set({
      nodes,
      childOrder,
      pages: pageInit.pages,
      pageOrder: pageInit.pageOrder,
      activePageId: pageInit.activePageId,
      assets: {},
      designTokens: {},
      fileName: "Untitled",
      selectedIds: [],
      zoom: DEFAULT_CANVAS_ZOOM,
      pan: { x: 40, y: 24 },
      showGrid: false,
      showRulers: true,
      comments: [],
      commentsPanelOpen: false,
      activeCommentId: null,
      isPlacingComment: false,
      penDrawingNodeId: null,
      pencilDrawingNodeId: null,
      pathEditModeNodeId: null,
  objectEditModeNodeId: null,
      selectedPathPointId: null,
      presenceUsers: [],
      showPresence: false,
      presenceActivityLog: [],
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      aiModalOpen: false,
      aiModalSource: null,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
      apiFileId: undefined,
      apiWorkspaceId: undefined,
      isApiBackedFile: false,
      apiCommentsStatus: "idle" as ApiCommentsStatus,
      versionHistoryOpen: false,
      apiVersionsStatus: "idle" as ApiVersionsStatus,
      apiFileVersions: [],
      guides: [],
      editingTextId: null,
      hoveredCanvasId: null,
      contextMenu: null,
      layerRenameId: null,
      placingComponentMasterId: null,
      prototypeWireDrag: null,
      selectedPrototypeLinkId: null,
      prototypePreview: null,
      responsivePreview: null,
      editorMode: "design",
      tool: "move",
      leftTab: "layers",
      documentSaveStatus: "saved",
      documentHydrationRevision: s.documentHydrationRevision + 1,
      historyPast: [],
      historyFuture: [],
    });
    void getSyncProvider()
      .saveDocument(editorStateToDocument(toPersistSlice(get())))
      .catch((e) => {
        console.warn("[Paytm Craft] persist save failed", e);
        useEditorStore.setState({ documentSaveStatus: "unsaved" });
      });
  },

  setDocumentName: (name) => {
    const next = name.trim() ? name.trim() : "Untitled";
    if (next === get().fileName) return;
    get().pushHistory();
    set({ fileName: next });
  },

  setActivePage: (pageId) => {
    const s = get();
    if (pageId === s.activePageId || !s.pages[pageId]) return;
    const captured = pagesWithActiveCaptured(s);
    const nextPage = captured.pages[pageId]!;
    set({
      pages: captured.pages,
      activePageId: pageId,
      ...editorPatchFromPage(nextPage),
      ...pageSwitchUiReset(),
    });
  },

  addPage: () => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = nextPageName(captured.pages, captured.pageOrder);
    const page = createEmptyPage(id, name);
    set({
      pages: { ...captured.pages, [id]: page },
      pageOrder: [...captured.pageOrder, id],
      activePageId: id,
      ...editorPatchFromPage(page),
      ...pageSwitchUiReset(),
    });
  },

  duplicatePage: (pageId) => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const sourceId = pageId ?? s.activePageId;
    const source = captured.pages[sourceId];
    if (!source) return;
    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cloned = clonePageCanvas(source);
    const page: EditorPage = {
      id,
      name: `${source.name} copy`,
      nodes: cloned.nodes,
      childOrder: cloned.childOrder,
      selectedIds: cloned.selectedIds,
      zoom: source.zoom,
      pan: { ...source.pan },
      showGrid: source.showGrid,
      showRulers: source.showRulers,
      canvasBackgroundColor: source.canvasBackgroundColor,
      layoutGuides: (source.layoutGuides ?? []).map((g) => ({
        ...g,
        id: `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })),
    };
    set({
      pages: { ...captured.pages, [id]: page },
      pageOrder: [...captured.pageOrder, id],
      activePageId: id,
      ...editorPatchFromPage(page),
      ...pageSwitchUiReset(),
    });
  },

  deletePage: (pageId) => {
    const s = get();
    if (s.pageOrder.length <= 1) return;
    const captured = pagesWithActiveCaptured(s);
    const page = captured.pages[pageId];
    if (!page) return;
    if (
      !window.confirm(`Delete "${page.name}"? This page and all of its content will be removed.`)
    ) {
      return;
    }
    const restPages = { ...captured.pages };
    delete restPages[pageId];
    const newOrder = captured.pageOrder.filter((id) => id !== pageId);
    if (pageId === s.activePageId) {
      const nextId = newOrder[newOrder.length - 1] ?? newOrder[0]!;
      const nextPage = restPages[nextId]!;
      set({
        pages: restPages,
        pageOrder: newOrder,
        activePageId: nextId,
        ...editorPatchFromPage(nextPage),
        ...pageSwitchUiReset(),
      });
      return;
    }
    set({ pages: restPages, pageOrder: newOrder });
  },

  cycleActivePage: (delta) => {
    const s = get();
    const idx = s.pageOrder.indexOf(s.activePageId);
    if (idx < 0) return;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= s.pageOrder.length) return;
    get().setActivePage(s.pageOrder[nextIdx]!);
  },

  renamePage: (pageId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => {
      const page = s.pages[pageId];
      if (!page || page.name === trimmed) return s;
      return { pages: { ...s.pages, [pageId]: { ...page, name: trimmed } } };
    });
  },
  };
});
