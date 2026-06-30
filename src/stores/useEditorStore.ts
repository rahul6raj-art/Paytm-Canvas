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
import { deferFigImportSave } from "@/lib/figImport/figImportRuntime";
import { fitCanvasToImportedDocument } from "@/lib/viewportZoom";
import { prepareImportedSliceForCanvas } from "@/lib/prepareImportedSliceForCanvas";
import { PML_PHONE_COLUMN_WIDTH } from "@/lib/craftBridge/pmlScreenMetrics";
import {
  filterBridgeCaptureRelayoutParents,
  isUnderBridgeCaptureScreen,
} from "@/lib/craftBridge/bridgeCaptureLayout";
import { buildAIGenerateSkeletonSlice } from "@/lib/aiGenerateSkeleton";
import { normalizeHex } from "@/lib/color";
import type { StrokeSpec } from "@/lib/strokeSpec";
import { mergeStrokeIntoNode } from "@/lib/strokeSpec";
import { defaultCanvasForegroundColor } from "@/lib/canvasForeground";
import { isShapeTool, type ShapeTool } from "@/lib/canvasToolRail";
import {
  createEmptyDocumentFields,
  isWorkspaceEmpty,
  preferLayoutGridOffWhenEmpty,
  readInitialDocumentFields,
} from "@/lib/editorBootstrap";
import { focusActiveTextEditField } from "@/lib/editorKeyboardFocus";
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
  type ApplyAutoLayoutSelectionResult,
} from "@/lib/autoLayoutSelection";
import { releaseAutoLayoutContainerToManual } from "@/lib/autoLayout/releaseAutoLayoutToManual";
import { isManualScreenFrame, rootFrameIds, ensureManualScreenLayout } from "@/lib/webImport/manualScreenFrames";
import { isUngroupableContainer } from "@/lib/ungroupSelection";
import { freezeAutoLayoutGapBeforeChildInsert } from "@/lib/layoutEngine/inferGap";
import { idsToDetachForAutoLayoutDrag } from "@/lib/autoLayoutDrag";
import {
  computeAutoLayoutArrowReorderIndex,
  getAutoLayoutArrowReorderContext,
  swapAutoLayoutSiblingOrder,
} from "@/lib/autoLayoutArrowReorder";
import {
  centerProportionalScaleFromWorld,
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
import {
  clampNodeDimensions,
  clampNodePosition,
  clampResizePointerLocal,
  sanitizeNodeGeometry,
} from "@/lib/nodeGeometryClamp";
import type { CornerRadii } from "@/lib/cornerRadius";
import {
  canEnterParametricShapeEdit,
  shouldEnterPathEditOnEdit,
} from "@/lib/editMode/shapeEditGate";
import {
  alignNodesInDocument,
  alignNodesInDocumentToGrid,
  alignableSelectionIds,
  canAlignSelection,
  distributeNodesInDocument,
  relayoutParentKeysAfterManualPosition,
  resolveAlignTargetIds,
} from "@/lib/alignSelection";
import {
  clampStrokeWidth,
  DEFAULT_PENCIL_STROKE_WIDTH,
  nodeSupportsStrokeWidth,
} from "@/lib/strokeAdjust";
import { nodeSupportsFillColor } from "@/lib/fillAdjust";
import { expandStyleTargetIds } from "@/lib/groupStyleTargets";
import type { CloneWorldOffset } from "@/lib/editorGraph";
import {
  getDuplicateStepOffset,
  recordDuplicateCreated,
  refreshDuplicateStepAfterMove,
  resetDuplicateRepeatOffset,
  selectionMatchesDuplicateChain,
  syncDuplicateRepeatSelection,
} from "@/lib/duplicateRepeatOffset";
import {
  clonedNodePosition,
  parentUsesAutoLayout,
  collectSubtreeIds,
  dedupeChildOrderLists,
  getRenderedWorldTopLeft,
  insertNodeInChildOrder,
  insertDuplicatedSiblingInChildOrder,
  buildParentMapFromChildOrder,
  syncParentIdsFromChildOrder,
  worldPointToParentLocalFromChildOrder,
  worldDragPairInParentSpace,
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
  canCreateComponentSetFromSelection,
  buildCreateComponentSetFromSelectionResult,
  instancePlacementParentAtWorldPoint,
  nextVariantMasterPosition,
  recordRecentComponent,
} from "@/lib/componentUx";
import {
  buildGoToMainComponentSelection,
  buildInstanceFromMaster,
  buildResetInstanceOverridesResult,
  buildSetInstanceVariantResult,
  buildSwapInstanceComponentResult,
  pushInstanceOverridesToMaster,
} from "@/lib/components/componentActions";
import { resolveComponentInstance } from "@/lib/components/resolveComponentInstance";
import {
  applyInstanceInteractionTrigger,
  clearEphemeralInteractiveFields,
} from "@/lib/components/componentInteractiveActions";
import {
  syncInteractionsToVariantGroup,
  type ComponentInteraction,
  type ComponentInteractionTrigger,
} from "@/lib/components/componentInteractions";
import {
  addPropertyToSet,
  addVariantForPropertyValue,
  deletePropertyFromSet,
  deleteVariantMaster as buildDeleteVariantMasterResult,
  duplicateVariantMaster as buildDuplicateVariantMasterResult,
  reflowComponentSetContainer,
  renamePropertyInSet,
} from "@/lib/components/componentSet";
import { applyComponentPropertyDefs } from "@/lib/components/resolveInstance";
import {
  buildInstanceSwapPropertyForNestedInstance,
  buildResetComponentPropertyValueResult,
} from "@/lib/components/componentInstanceSwap";
import {
  buildResetSlotContentResult,
  buildSetSlotContentResult,
  buildSlotPropertyForContainer,
  buildSlotTextContentSnapshot,
  captureSlotContentFromInstance,
  snapshotContentSignature,
} from "@/lib/components/componentSlots";
import {
  buildSlotEditBreadcrumb,
  resolveSlotEditScope,
  slotContentChanged,
  isDeletableDuringSlotEdit,
  resolveInstanceDropParentId,
  type ActiveSlotEditState,
} from "@/lib/slotEditScope";
import { readInstanceOverrideMap, writeInstanceOverrideState } from "@/lib/components/overrides";
import { recordInstanceOverrideForNode } from "@/lib/components/propagate";
import {
  applyComponentPropagationToStoreResult,
  isMasterComponentEdit,
} from "@/lib/components/componentPropagation";
import {
  applyMasterComponentDocumentChanges,
  type MasterDocumentMutation,
} from "@/lib/components/componentMasterMutation";
import {
  beginComponentUpdateTransaction,
  recordMasterMutation,
} from "@/lib/components/componentUpdateTransaction";
import { findMasterRootForNode } from "@/lib/components/propagate";
import { assignStableLayerIds } from "@/lib/components/stableIds";
import type { ComponentPropertyDef } from "@/lib/components/types";
import {
  defaultPrototypeLink,
  findPrototypeLinkOwner,
  newPrototypeLinkId,
  type PrototypeLink,
} from "@/lib/prototype";
import type {
  EditorAsset,
  EditorFontAsset,
  EditorPersistSlice,
  PaytmCraftDocument,
} from "@/lib/documentPersistence";
import type { CodeRoundTripLink } from "@/lib/craftBridge/types";
import { normalizeCodeRoundTripLink } from "@/lib/craftBridge/normalizeLink";
import { rehydrateProjectColorContext } from "@/lib/craftBridge/projectTokenCss";
import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import type { DesignToken, DetachableTokenKind, EffectTokenValue, CanvasColorMode } from "@/lib/designTokens";
import {
  newDesignTokenId,
  designTokenTimestamp,
  resolveNodeWithDesignTokens,
  isColorValue,
  isGradientValue,
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
  buildResizeContentOpts,
  buildResizeContentPatches,
  pathContentPatchFromBoxResize,
  scaleSubtreeContentPatches,
  shouldProportionalFrameScale,
  syncEditablePathAfterBoxChange,
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
import { clearCanonicalTextLayoutCache } from "@/lib/text/canonicalTextLayout";
import { buildTextResizeGeometryPatch } from "@/lib/text/textResizeFromDrag";
import { ensureTextModeForExplicitWidth } from "@/lib/text/ensureTextModeForExplicitWidth";
import { bumpTextLayoutEpoch } from "@/lib/text/textLayoutEpoch";
import {
  logTextResizeModeClick,
  resolveTextNodeFromStore,
  textResizeLayoutSnapshot,
  textResizeModeSnapshot,
  textResizeModeStylePatch,
} from "@/lib/text/setTextResizeModeForNode";
import { applyAspectLockedDimensions } from "@/lib/dimensionAspectLock";
import {
  createPointTextAt,
  createTextBoxFromDrag,
  createTextDraftNodeFromDrag,
  textGeometryPatchFromDrag,
} from "@/lib/text/textCreation";
import { createFrameNodeFromDrag, frameGeometryPatchFromDrag } from "@/lib/frameDrawing";
import { MIN_TEXT_BOX, textResizePatch } from "@/lib/text/textNodeModel";
import {
  DEFAULT_TEXT_FONT_FAMILY,
  DEFAULT_TEXT_FONT_SIZE,
  resolveTextTypo,
} from "@/lib/textTypography";
import { effectiveLineHeightMultiplier } from "@/lib/text/lineHeight";
import { letterSpacingPercentFromNode } from "@/lib/text/letterSpacing";
import {
  createShapeNode,
  shapeGeometryPatchFromDrag,
  toolToShapeType,
} from "@/lib/shapes/shapeCreation";
import { isZeroAreaDraftNode } from "@/lib/shapes/shapeDraft";
import {
  duplicatedTextLayerName,
  layerNameFromTextContent,
  nextDuplicatedLayerName,
  nextNumberedLayerName,
} from "@/lib/layerNaming";
import {
  lineEndpointsPatchFromBoxResize,
  linePatchFromEndpoints,
  lineEndpointsFromNode,
} from "@/lib/shapes/lineGeometry";
import { polygonGeometryPatch } from "@/lib/shapes/polygonGeometry";
import { isStarNode, starGeometryPatch } from "@/lib/shapes/starGeometry";
import {
  DEFAULT_FRAME_FILL,
  DEFAULT_LINE_STROKE_WIDTH,
  DEFAULT_SHAPE_FILL,
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
import { convertTextToOutlineVectorGroup } from "@/lib/text/textOutlineToVectors";
import { expandBooleanFillStylePatches } from "@/lib/booleanGroupFill";
import {
  getResizeAnchorLocal,
  isCornerHandle,
  solveNodeXYForAnchorWorld,
} from "@/lib/resizeTransform";
import {
  finiteCoord,
  finiteDimension,
  hasRotation,
  getNodeWorldOrigin,
} from "@/lib/transformMath";
import { validateImageImportFile, validateVideoImportFile, buildEditorVideoAssetFromFile } from "@/lib/editorAssets";
import { resolveImageAssetFromFile } from "@/lib/resolveImageAssetImport";
import { buildEditorFontAssetFromFile } from "@/lib/editorFontAssets";
import { importSvgFileToEditorGraph, isSvgLayerImportFile } from "@/lib/svgFileImport";
import { insertImportedNodes } from "@/lib/svgImportInsert";
import {
  clearLocalDocument,
  documentToEditorPatch,
  downloadJsonFile,
  editorStateToDocument,
  isBrokenOrphanedLocalDocument,
  parsePaytmCraftDocumentJson,
  paytmCraftDocumentFromPage,
  prepareDocumentForEditorImport,
  readLocalDocument,
  sanitizeDocumentFilename,
  serializePersistStable,
  validatePaytmCraftDocument,
} from "@/lib/documentPersistence";
import {
  getActiveApiRevision,
  isApiSaveConflictError,
  setActiveApiFileId,
  setActiveApiRevision,
} from "@/lib/apiSyncProvider";
import { getSyncProvider } from "@/lib/syncProviderSingleton";
import { persistSliceFromApiFileDetail } from "@/lib/apiFileHydration";
import { addDashboardSavedFile } from "@/lib/dashboardSavedFiles";
import { getActiveMockWorkspace } from "@/lib/mockAuth";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import type { RealtimeSyncStatus } from "@/lib/realtimeSyncProtocol";
import { apiClient, type CraftFileVersionSummary } from "@/lib/apiClient";

import {
  clonePersistedEditorSnapshot,
  editorStateToHistorySnapshot,
  historySnapshotToEditorPatch,
  type PersistedEditorSnapshot,
} from "@/lib/editorHistory";
import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import { bumpResizePreview } from "@/lib/canvasEphemeralTransform";
import {
  craftEngineAuthorityCanRedo,
  craftEngineAuthorityCanUndo,
  craftEngineAuthorityRedo,
  craftEngineAuthorityUndo,
} from "@/engine/craftEngineAuthorityBridge";
import { mirrorGeometryPatchesToWasm, mirrorNodeGeometryToWasm } from "@/engine/craftEngineAuthorityGeometry";
import { flushDeferredWasmReconcile, clearDeferredWasmReconcile } from "@/engine/craftEngineAuthorityMirror";
import type { WasmSnapshotStorePatch } from "@/engine/craftEngineSnapshotApply";
import { mergeWasmSnapshotWithStore } from "@/engine/craftEngineSnapshotApply";
import type { DocumentMutationResult } from "@/engine/craftEngineWasmFirstMutation";
import {
  commitDocumentMutation,
  syncWasmDocumentAfterStoreUpdate,
} from "@/engine/craftEngineWasmFirstMutation";
import {
  applyRotateGeometryLock,
  isRotateGeometryLockActive,
  rotateGeomSnapshotForNode,
} from "@/lib/rotation/rotateGeometryLock";
import {
  getActiveCraftEngine,
  requestCraftEngineForceFullSync,
  requestCraftEngineWasmBootstrap,
} from "@/engine/craftEngineRegistry";
import { runCraftEngineAccess } from "@/engine/craftEngineMutation";

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
import { shouldSampleFreehandPoint, simplifyPolyline, smoothPolylineToPathPoints } from "@/lib/freehandPath";
import {
  newPathPointId,
  normalizePathNode,
  rekeyPathPoints,
  type PathPoint,
} from "@/lib/pathGeometry";
import { mergePathPointHandles } from "@/lib/pathHandles";
import { canClosePathAt, effectiveHandleMirroring } from "@/lib/penTool";
import {
  buildCornerPathPoint,
  buildSmoothPathPointFromDrag,
} from "@/lib/penTool/bezierGeometry";
import {
  convertNodeToPath,
  ensureRoundedRectPathPoints,
  isVectorEditableShape,
  needsVectorPathConversion,
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
  createEmptySubPage,
  editorPatchFromPage,
  editorPatchFromSubPage,
  ensurePageHasSubPages,
  initialPagesFromCanvas,
  nextPageName,
  nextSubPageName,
  pagesWithActiveCaptured,
  resolveActiveSubPage,
  type EditorPage,
  type EditorSubPage,
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

export type DocumentSaveStatus =
  | "saved"
  | "unsaved"
  | "saving"
  | "saved-api"
  | "api-save-failed"
  | "api-conflict";

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
  strokeImageAssetId?: string;
  strokeVideoAssetId?: string;
  strokeWidth?: number;
  /** 0–1 stroke color opacity */
  strokeOpacity?: number;
  /** When false, stroke is hidden but settings are kept */
  strokeEnabled?: boolean;
  strokePosition?: StrokePosition;
  /** Which edges receive stroke (rectangles / frames). */
  strokeSides?: import("@/lib/strokeAlign").StrokeSidesMode;
  strokeSidesCustom?: import("@/lib/strokeAlign").StrokeSidesCustom;
  strokeSidesCustomColors?: import("@/lib/strokeAlign").StrokeSidesCustomColors;
  /** Line / open path start cap or arrow */
  strokeStartPoint?: import("@/lib/strokeEndpoints").StrokeEndpoint;
  /** Line / open path end cap or arrow */
  strokeEndPoint?: import("@/lib/strokeEndpoints").StrokeEndpoint;
  cornerRadius?: number;
  /** Per-corner radii [top-left, top-right, bottom-right, bottom-left]. */
  /** Per-corner radii (4 for rects; one per path vertex for vectors). */
  cornerRadii?: number[];
  /** 0 = circular corners, 1 = Figma-style corner smoothing. Default 0. */
  cornerSmoothing?: number;
  /** Text color; falls back to `fill` when unset */
  textColor?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number;
  /** Unitless multiplier, e.g. 1.25 */
  lineHeight?: number;
  /** How `lineHeight` is interpreted; defaults to auto when unset. */
  lineHeightUnit?: import("@/lib/text/lineHeight").LineHeightUnit;
  /** px when `letterSpacingUnit` is `px`; percent of font size when `percent` */
  letterSpacing?: number;
  /** How `letterSpacing` is interpreted; legacy nodes default to px. */
  letterSpacingUnit?: import("@/lib/text/letterSpacing").LetterSpacingUnit;
  /** Stroke dash pattern */
  strokeStyle?: "solid" | "dashed" | "dotted";
  /** Custom dash length (px) when dashed/dotted */
  strokeDashLength?: number;
  /** Custom gap length (px) when dashed/dotted */
  strokeDashGap?: number;
  /** SVG stroke-linecap (includes Figma-style taper). */
  strokeLinecap?: "butt" | "round" | "square" | "taper";
  /** SVG stroke-linejoin */
  strokeLinejoin?: "miter" | "round" | "bevel";
  /** Minimum corner angle (degrees) before miter becomes bevel */
  strokeMiterAngle?: number;
  /** Variable width along path; defaults to uniform (constant thickness). */
  strokeWidthProfile?: "uniform" | "taper";
  /** Flip width profile along path */
  strokeWidthProfileFlipped?: boolean;
  /** Taper amount at path start (0 = none, 1 = full point). */
  strokeTaperStart?: number;
  /** Taper amount at path end (0 = none, 1 = full point). */
  strokeTaperEnd?: number;
  /** Distance in px over which start taper ramps to full width. */
  strokeTaperLengthStart?: number;
  /** Distance in px over which end taper ramps to full width. */
  strokeTaperLengthEnd?: number;
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
  /** Star outer spike corner radius (falls back to cornerRadius). */
  starOuterCornerRadius?: number;
  /** Star inner valley corner radius (falls back to cornerRadius). */
  starInnerCornerRadius?: number;
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
  /** Image paint fill (shape/frame) — references `assets`. */
  fillImageAssetId?: string;
  /** Video paint fill — references `assets` (video/* data URLs). */
  fillVideoAssetId?: string;
  /** Tiled pattern fill from SVG `url(#pattern)` import or pattern mode. */
  fillPatternAssetId?: string;
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

  /** Component set container (frame): wraps variant masters (Figma component set). */
  isComponentSet?: boolean;
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

  /** Master: stable internal layer id per descendant (nodeId → stableLayerId) */
  componentLayerStableIds?: Record<string, string>;
  /** Master: when set, instances skip this pass-through shell and use the inner layer as root. */
  componentInstanceContentStableId?: string;
  componentDescription?: string;
  componentPropertyDefs?: import("@/lib/components/types").ComponentPropertyDef[];
  componentVersion?: number;
  libraryId?: string;
  remoteComponentId?: string;
  publishStatus?: "local" | "published" | "library";
  lastPublishedVersion?: number;
  updateAvailable?: boolean;

  /** Instance: maps cloned node id → stable layer id */
  instanceStableIdMap?: Record<string, string>;
  /** Instance overrides keyed by stable layer id */
  instanceOverridesByStableId?: Record<string, Record<string, unknown>>;
  /** Instance: selected variant property values */
  selectedVariantProperties?: Record<string, string>;
  /** Instance: component version at last resolve */
  componentVersionAtInsert?: number;
  /** Instance: cached resolved tree version */
  resolvedTreeCacheVersion?: number;
  instanceDetached?: boolean;
  /** Instance: exposed property values set on this instance */
  componentPropertyValues?: Record<string, string | boolean>;

  /** Component set: prototype-style variant interactions (shared across variant masters). */
  componentInteractions?: ComponentInteraction[];
  /** Instance: runtime interactive variant override (preview/ephemeral; not inspector selection). */
  currentInteractiveVariantValues?: Record<string, string>;
  /** Instance: runtime pointer/focus state for interactive preview. */
  interactionState?: InstanceInteractionState;

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
  /** Figma mask mode (OUTLINE | LUMINANCE | ALPHA). */
  figMaskType?: "OUTLINE" | "LUMINANCE" | "ALPHA" | string;
  /** When true, show mask layer while editing (Figma "show mask"). */
  maskVisible?: boolean;
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
  /** Web-imported screen artboard — keep manual layout (not every top-level canvas frame). */
  manualScreenLayout?: boolean;
  codeClassName?: string;
  /** Craft bridge: linked repo source path for this screen artboard root. */
  bridgeSourcePath?: string;
  /** Project CSS spacing token ids matched on bridge import. */
  projectSpacingTokenIds?: {
    paddingTop?: string;
    paddingRight?: string;
    paddingBottom?: string;
    paddingLeft?: string;
    layoutGap?: string;
    cornerRadius?: string;
  };
}

export type NodeStylePatch = Partial<
  Pick<
    EditorNode,
    | "fill"
    | "fillType"
    | "fillGradient"
    | "fillOpacity"
    | "fillEnabled"
    | "fillImageAssetId"
    | "fillVideoAssetId"
    | "fillPatternAssetId"
    | "fillTokenId"
    | "stroke"
    | "strokeColor"
    | "strokeType"
    | "strokeGradient"
    | "strokeImageAssetId"
    | "strokeVideoAssetId"
    | "strokeWidth"
    | "strokeOpacity"
    | "strokeEnabled"
    | "strokePosition"
    | "strokeSides"
    | "strokeSidesCustom"
    | "strokeSidesCustomColors"
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
    | "lineHeightUnit"
    | "letterSpacing"
    | "letterSpacingUnit"
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
  /** Last shape tool picked on the canvas rail — shown when another tool is active. */
  lastShapeTool: ShapeTool;
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
  fontAssets: Record<string, EditorFontAsset>;
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
  /** Active canvas screen within the active master page. */
  activeSubPageId: string;
  showGrid: boolean;
  showRulers: boolean;
  canvasBackgroundColor: string;
  /** Preview mode for semantic color tokens on canvas (light/dark). */
  canvasColorMode: CanvasColorMode;
  /** Linked page + token CSS for runtime class→var color binding. */
  projectCssSources: string[];
  storybookUrl?: string;
  storybookCatalogHash?: string;
  comments: EditorComment[];
  commentsPanelOpen: boolean;
  activeCommentId: string | null;
  isPlacingComment: boolean;
  /** In-progress pen path node id, or null. */
  penDrawingNodeId: string | null;
  /** In-progress freehand (pencil) path node id, or null. */
  pencilDrawingNodeId: string | null;
  /** Live shape drag (rect, ellipse, line, etc.) — real node updates while drawing. */
  shapeDrawingSession: {
    nodeId: string;
    shapeType: ShapeType;
    start: { x: number; y: number };
    style?: Partial<Pick<EditorNode, "polygonSides" | "starPoints" | "starInnerRadius">>;
  } | null;
  /** Live frame drag — real frame updates while drawing. */
  frameDrawingSession: {
    nodeId: string;
    start: { x: number; y: number };
  } | null;
  /** Live text box drag — real text layer updates while drawing. */
  textDrawingSession: {
    nodeId: string;
    start: { x: number; y: number };
  } | null;
  /** Brush size for the next freehand stroke (and toolbar preset). */
  pencilStrokeWidth: number;
  /** Point-edit mode for a finished path (Backspace deletes selected anchor). */
  pathEditModeNodeId: string | null;
  /** Parametric shape edit (corner radius, arc, line endpoints, polygon sides, etc.). */
  shapeEditModeNodeId: string | null;
  /** Transient mode while resizing or rotating via selection handles. */
  transformInteractionMode: "none" | "resize" | "rotate";
  /** Frozen local geometry at rotate-drag start (inspector + stable chrome). */
  rotateGeomSnapshot: {
    nodeId: string;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  /** Per-node frozen geometry during multi-select rotate. */
  rotateGeomSnapshots: Record<
    string,
    { x: number; y: number; width: number; height: number }
  > | null;
  /** True while dragging selected object(s) on canvas. */
  isMovingSelection: boolean;
  /** Pointer over a rotate-from-corner hit target. */
  rotateHandleHovered: boolean;
  /** Corner/edge under the pointer for rotate cursor orientation. */
  rotateHandleHoverHandle: import("@/lib/resize").ResizeHandle | "top" | null;
  /** Edit children inside a boolean group (Figma-style). */
  objectEditModeNodeId: string | null;
  selectedPathPointIds: string[];
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

  /** Interactive component variant preview on canvas (runtime-only state). */
  componentInteractionPreview: boolean;

  /** Active slot edit mode: instance root + slot property key + scope metadata. */
  activeSlotEdit: ActiveSlotEditState | null;

  /** Live responsive preview (temporary geometry); Apply commits with one undo step. */
  responsivePreview: null | {
    frameId: string;
    geomBackup: Record<string, { x: number; y: number; width: number; height: number }>;
    draftWidth: number;
    draftHeight: number;
  };

  documentSaveStatus: DocumentSaveStatus;
  /** Yjs/WebSocket session status when `NEXT_PUBLIC_PAYTM_CRAFT_SYNC_URL` is set. */
  realtimeSyncStatus: RealtimeSyncStatus;
  /** True until the first local/API document load finishes in the editor shell. */
  documentHydrating: boolean;
  documentHydrationRevision: number;

  /** When set (api mode), document is also saved to `/api/v1/files/:id`. Not serialized in `.paytmcraft.json`. */
  apiFileId: string | undefined;
  apiWorkspaceId: string | undefined;
  /** Last known server revision for `If-Match` optimistic concurrency. */
  apiFileRevision: string | undefined;
  isApiBackedFile: boolean;
  /** Mock API comment sync; not persisted in `.paytmcraft.json`. */
  apiCommentsStatus: ApiCommentsStatus;

  /** Version history side panel (API-backed files only). Not persisted. */
  versionHistoryOpen: boolean;
  apiVersionsStatus: ApiVersionsStatus;
  apiFileVersions: ApiFileVersion[];

  historyPast: PersistedEditorSnapshot[];
  historyFuture: PersistedEditorSnapshot[];
  /** WASM undo stack UI state (native + WASM authority mode). */
  wasmHistoryCanUndo: boolean;
  wasmHistoryCanRedo: boolean;
  isApplyingHistory: boolean;
  /** True while applying a WASM snapshot patch to the document slice (UI mirror mode). */
  isApplyingWasmMirror: boolean;
  applyWasmDocumentPatch: (patch: WasmSnapshotStorePatch) => void;
  pushHistory: (label?: string) => void;
  undo: () => void;
  redo: () => void;
  clearHistory: () => void;

  setEditingTextId: (id: string | null, selection?: { anchor: number; focus: number }) => void;
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
  updateNode: (
    id: string,
    patch: Partial<EditorNode>,
    opts?: { skipHistory?: boolean; allowZeroGeometry?: boolean },
  ) => void;
  updateNodes: (patches: Record<string, Partial<EditorNode>>, opts?: { skipHistory?: boolean }) => void;
  updateNodeStyle: (id: string, patch: NodeStylePatch, opts?: { skipHistory?: boolean }) => void;
  /** Figma-style text resize mode — updates mode, autoResize, layout, and dimensions. */
  setTextResizeMode: (
    id: string,
    mode: import("@/lib/text/textNodeModel").TextResizeMode,
    opts?: { skipHistory?: boolean },
  ) => void;
  /** Apply a solid fill hex on one layer (clears linked fill color token, handles instances/booleans). */
  setNodeFillHex: (nodeId: string, hex: string, opts?: { skipHistory?: boolean }) => void;
  /** Apply text color hex (clears linked color token when used for text). */
  setNodeTextColorHex: (nodeId: string, hex: string, opts?: { skipHistory?: boolean }) => void;
  /** Apply solid fill / text color to all fill-capable layers in the current selection. */
  setSelectionFillHex: (hex: string, opts?: { skipHistory?: boolean }) => void;
  /** Apply a style patch to each editable top-level selected layer. */
  updateSelectionStyle: (patch: NodeStylePatch, opts?: { skipHistory?: boolean }) => void;
  /** Apply a node patch to each editable top-level selected layer. */
  updateSelectionNodes: (patch: Partial<EditorNode>, opts?: { skipHistory?: boolean }) => void;
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
  startShapeFromDrag: (
    shapeType: ShapeType,
    start: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
    style?: Partial<Pick<EditorNode, "polygonSides" | "starPoints" | "starInnerRadius">>,
  ) => void;
  updateShapeFromDrag: (
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
  ) => void;
  finishShapeFromDrag: (
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
  ) => void;
  cancelShapeFromDrag: () => void;
  startFrameFromDrag: (start: { x: number; y: number }) => void;
  updateFrameFromDrag: (
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
  ) => void;
  finishFrameFromDrag: (
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
  ) => void;
  cancelFrameFromDrag: () => void;
  startTextFromDrag: (start: { x: number; y: number }) => void;
  updateTextFromDrag: (
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
  ) => void;
  finishTextFromDrag: (
    end: { x: number; y: number },
    modifiers: { shiftKey: boolean; altKey: boolean },
  ) => void;
  cancelTextFromDrag: () => void;
  booleanUnionSelection: () => void;
  createBooleanGroup: (operation: BooleanOperation) => void;
  updateBooleanOperation: (groupId: string, operation: BooleanOperation) => void;
  flattenSelection: () => void;
  outlineStrokeSelection: (nodeId?: string) => void;
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
  importVideoAsset: (file: File) => Promise<string | null>;
  /** Reads TTF/OTF into `fontAssets`, returns new font asset id or null on error. */
  importFontFile: (file: File) => Promise<string | null>;
  /** Places an image node for `assetId`. Uses frame center when `worldX` / `worldY` omitted. */
  addImageNodeAt: (assetId: string, worldX?: number, worldY?: number) => void;
  /** Import files and place image nodes at a world point (single undo step). Returns count placed. */
  placeImageFilesOnCanvas: (files: File[], worldX: number, worldY: number) => Promise<number>;
  replaceImageAsset: (nodeId: string, file: File) => Promise<void>;
  replaceAsset: (assetId: string, file: File) => Promise<void>;
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
  updateEffect: (
    nodeId: string,
    effectId: string,
    patch: Partial<import("@/lib/nodeEffects").NodeEffect>,
    opts?: { skipHistory?: boolean },
  ) => void;
  deleteEffect: (nodeId: string, effectId: string, opts?: { skipHistory?: boolean }) => void;
  toggleEffect: (nodeId: string, effectId: string, opts?: { skipHistory?: boolean }) => void;
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
  alignSelectionToGrid: (row: number, col: number) => void;
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
  reorderAutoLayoutChildByArrow: (arrowCode: string, shiftKey?: boolean) => boolean;
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
  setCanvasColorMode: (mode: CanvasColorMode) => void;
  /** Fetch linked CSS + relink fill tokens when missing from a saved bridge document. */
  rehydrateProjectColorTokensIfNeeded: () => Promise<void>;
  /** Import Components/* stories from Storybook into the local component library. */
  importStorybookComponents: (opts?: { force?: boolean }) => Promise<{
    ok: boolean;
    message: string;
    imported?: number;
    remaining?: number;
    storyCount?: number;
    totalImported?: number;
  }>;
  rehydrateProjectStorybookComponentsIfNeeded: () => Promise<void>;

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
    opts?: { skipHistory?: boolean; breakHandleMirror?: boolean },
  ) => void;
  deletePathPoint: (nodeId: string, pointId: string) => void;
  togglePathClosed: (nodeId: string) => void;
  setPathEditMode: (nodeId: string | null) => void;
  selectPathPoint: (nodeId: string, pointId: string | null) => void;
  enterShapeEditMode: (nodeId?: string) => void;
  exitShapeEditMode: () => void;
  exitAllEditModes: () => void;
  toggleEditMode: (nodeId?: string) => void;
  setTransformInteractionMode: (mode: "none" | "resize" | "rotate") => void;
  setRotateGeomSnapshot: (
    snapshot: {
      nodeId: string;
      x: number;
      y: number;
      width: number;
      height: number;
    } | null,
  ) => void;
  /** Atomically start rotate drag with frozen local geometry. */
  beginRotateInteraction: (
    nodeId: string,
    snapshot: { x: number; y: number; width: number; height: number },
  ) => void;
  /** Freeze geometry for every node in a multi-select rotate drag. */
  beginMultiRotateInteraction: (
    snapshots: Record<string, { x: number; y: number; width: number; height: number }>,
  ) => void;
  /** Restore frozen geometry + final rotation, then end rotate mode. */
  endRotateInteraction: (nodeId: string, rotation: number) => void;
  /** End multi-select rotate drag and clear geometry snapshots. */
  endMultiRotateInteraction: () => void;
  setIsMovingSelection: (active: boolean) => void;
  setRotateHandleHovered: (
    hovered: boolean,
    handle?: import("@/lib/resize").ResizeHandle | "top",
  ) => void;
  enterVectorEditMode: (nodeId?: string) => void;
  setPathHandleMirroring: (mode: import("@/lib/pathHandles").PathHandleMirroring) => void;
  setSelectedPathPointIds: (ids: string[]) => void;
  togglePathPointSelection: (pointId: string, additive: boolean) => void;
  updatePathPoints: (
    nodeId: string,
    patches: Record<string, Partial<Pick<PathPoint, "x" | "y" | "handleIn" | "handleOut">>>,
    opts?: { skipHistory?: boolean },
  ) => void;
  deletePathPoints: (nodeId: string, pointIds: string[]) => void;
  resizeNode: (
    id: string,
    handle: ResizeHandle,
    startBounds: Bounds,
    currentPoint: { x: number; y: number },
    modifiers: ResizeModifiers,
    opts?: {
      skipHistory?: boolean;
      fixedWorld?: { x: number; y: number } | null;
      pointerWorld?: { x: number; y: number };
      startPointerWorld?: { x: number; y: number };
      startPathPoints?: import("@/lib/pathGeometry").PathPoint[];
      startNodesSnapshot?: Record<string, EditorNode>;
    },
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
  /** Discard local edits and reload the API file from the server (after revision conflict). */
  reloadApiFileFromServer: () => Promise<void>;
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
  setActiveSubPage: (subPageId: string) => void;
  addPage: () => void;
  addSubPage: () => void;
  duplicatePage: (pageId?: string) => void;
  duplicateSubPage: (subPageId: string) => void;
  deletePage: (pageId: string, opts?: { skipConfirm?: boolean }) => void;
  deleteSubPage: (subPageId: string, opts?: { skipConfirm?: boolean }) => void;
  /** Close a page tab: save to dashboard and remove from the open document. */
  closePage: (pageId: string) => { emptied: boolean };
  renamePage: (pageId: string, name: string) => void;
  renameSubPage: (subPageId: string, name: string) => void;
  cycleActivePage: (delta: -1 | 1) => void;
  /** Replace editor document from a persist slice (dashboard templates, imports, blank). Writes localStorage. */
  loadWorkspaceFromPersist: (
    slice: EditorPersistSlice,
    apiSession?: { apiFileId: string; apiWorkspaceId?: string; apiRevision?: string },
  ) => Promise<void>;

  duplicateSingle: (id: string) => void;
  deleteSingle: (id: string) => void;

  placingComponentMasterId: string | null;
  setPlacingComponentMasterId: (id: string | null) => void;
  createComponentFromSelection: () => void;
  combineAsVariants: () => void;
  createComponentSetFromSelection: () => void;
  createInstance: (componentKey: string, worldX: number, worldY: number) => void;
  detachInstance: (instanceRootId: string) => void;
  updateInstanceOverride: (
    instanceRootId: string,
    targetNodeId: string,
    patch: InstanceOverridePatch,
  ) => void;
  createVariantFromComponent: (componentKey: string) => void;
  updateVariantProperties: (componentKey: string, properties: Record<string, string>) => void;
  addVariantPropertyAxis: (masterId: string, axis: string, defaultValue: string) => void;
  renameVariantProperty: (masterId: string, oldName: string, newName: string) => void;
  deleteVariantProperty: (masterId: string, propertyName: string) => void;
  addVariantPropertyValue: (masterId: string, propertyName: string, value: string) => void;
  duplicateVariantMaster: (masterId: string) => void;
  deleteVariantMaster: (masterId: string) => void;
  goToMainComponent: (instanceRootId: string) => void;
  resetInstanceOverrides: (instanceRootId: string, stableId?: string, propertyPath?: string) => void;
  swapInstanceComponent: (instanceRootId: string, newMasterKey: string) => void;
  setInstanceVariant: (instanceRootId: string, variantProperties: Record<string, string>) => void;
  pushInstanceChangesToMain: (instanceRootId: string) => void;
  setComponentDescription: (masterId: string, description: string) => void;
  addComponentProperty: (
    masterId: string,
    property: import("@/lib/components/types").ComponentPropertyDef,
  ) => void;
  setComponentPropertyValue: (
    instanceRootId: string,
    propertyKey: string,
    value: string | boolean,
  ) => void;
  resetComponentPropertyValue: (instanceRootId: string, propertyKey: string) => void;
  createInstanceSwapPropertyFromSelection: (
    masterId: string,
    nestedInstanceNodeId: string,
    label?: string,
  ) => void;
  updateComponentProperty: (
    masterId: string,
    propertyId: string,
    patch: Partial<import("@/lib/components/types").ComponentPropertyDef>,
  ) => void;
  createSlotPropertyFromSelection: (
    masterId: string,
    containerNodeId: string,
    label?: string,
  ) => void;
  setSlotContent: (
    instanceRootId: string,
    propertyKey: string,
    snapshot: import("@/lib/components/types").SlotContentSnapshot,
  ) => void;
  resetSlotContent: (instanceRootId: string, propertyKey: string) => void;
  enterSlotEditMode: (
    instanceRootId: string,
    propertyKey: string,
    priorBreadcrumb?: import("@/lib/slotEditScope").SlotEditBreadcrumbCrumb[],
  ) => void;
  exitSlotEditMode: (save?: boolean) => void;
  navigateSlotEditBreadcrumb: (index: number) => void;
  pasteIntoActiveSlot: () => void;

  /** When true, canvas pointer events drive interactive component variant switching. */
  componentInteractionPreview: boolean;
  activeSlotEdit: ActiveSlotEditState | null;
  setComponentInteractionPreview: (enabled: boolean) => void;
  setComponentInteractions: (masterId: string, interactions: ComponentInteraction[]) => void;
  addComponentInteraction: (masterId: string, interaction: ComponentInteraction) => void;
  updateComponentInteraction: (
    masterId: string,
    interactionId: string,
    patch: Partial<ComponentInteraction>,
  ) => void;
  removeComponentInteraction: (masterId: string, interactionId: string) => void;
  triggerInstanceInteraction: (instanceRootId: string, trigger: ComponentInteractionTrigger) => void;
  clearInteractiveInstanceStates: () => void;

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
  /** Constrain W/H proportions in the inspector and on canvas resize handles. */
  inspectorAspectRatioLocked: boolean;
  setCommandMenuOpen: (open: boolean) => void;
  setShortcutOverlayOpen: (open: boolean) => void;
  toggleUiChrome: () => void;
  setUiChromeVisible: (visible: boolean) => void;
  setInspectorAspectRatioLocked: (locked: boolean) => void;
  toggleInspectorAspectRatioLocked: () => void;

  aiModalOpen: boolean;
  aiModalSource: "dashboard" | "editor" | null;
  openAIModal: (source: "dashboard" | "editor") => void;
  closeAIModal: () => void;
  aiGenerateActive: boolean;
  aiGenerateStep: string | null;
  aiGenerateJobSeq: number;
  aiGenerateJob: import("@/lib/aiGenerateJob").AIGenerateJob | null;
  aiGenerateError: string | null;
  aiGenerateFailedJob: import("@/lib/aiGenerateJob").AIGenerateFailedJob | null;
  queueAIGenerate: (
    job: Omit<import("@/lib/aiGenerateJob").AIGenerateJob, "id" | "queuedAt">,
  ) => number;
  setAIGenerateStep: (step: string) => void;
  finishAIGenerate: () => void;
  failAIGenerate: (error: string, job: import("@/lib/aiGenerateJob").AIGenerateJob) => void;
  cancelAIGenerate: () => void;
  clearAIGenerateError: () => void;

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
  /** Figma fidelity inspector — source snapshots from last .fig import. */
  figFidelityCaptures: Record<string, import("@/lib/figImport/figFidelityTypes").FigImportFidelityCapture> | null;
  figFidelityReport: import("@/lib/figImport/figFidelityTypes").FigmaFidelityProjectReport | null;
  figFidelityOverlayEnabled: boolean;
  setFigFidelityOverlayEnabled: (enabled: boolean) => void;
  refreshFigFidelityReport: () => void;
  /** SVG layer import warnings shown in a dismissible toast. */
  svgImportNotice: { title: string; details: string[] } | null;
  setSvgImportNotice: (notice: { title: string; details: string[] } | null) => void;
  clearSvgImportNotice: () => void;
  codeRoundTripOpen: boolean;
  codeRoundTripTab: "export" | "import";
  /** Import lines preserved from uploaded React for 1:1 export */
  codeRoundTripSourceHeader: string | null;
  setCodeRoundTripSourceHeader: (header: string | null) => void;
  /** Linked source file for bridge round-trip (persisted in document). */
  codeRoundTripLink: CodeRoundTripLink | null;
  setCodeRoundTripLink: (link: CodeRoundTripLink | null) => void;
  updateCodeRoundTripLink: (patch: Partial<CodeRoundTripLink>) => void;
  /** Transient bridge sync UI state (not persisted). */
  craftBridgeSyncStatus: "idle" | "syncing" | "synced" | "error";
  craftBridgeSyncError: string | null;
  setCraftBridgeSyncStatus: (
    status: "idle" | "syncing" | "synced" | "error",
    error?: string | null,
  ) => void;
  /** Last Storybook component sync result (not persisted). */
  storybookSyncMessage: string | null;
  setStorybookSyncMessage: (message: string | null) => void;
  /** True while applying source→canvas import (pauses outbound auto-sync). */
  craftBridgeInboundActive: boolean;
  setCraftBridgeInboundActive: (active: boolean) => void;
  /** Set when source and canvas diverge under conflictPolicy=ask. */
  craftBridgeConflict: {
    sourceHash: string;
    canvasHash: string;
    sourceContent: string;
    canvasContent: string;
  } | null;
  setCraftBridgeConflict: (conflict: {
    sourceHash: string;
    canvasHash: string;
    sourceContent: string;
    canvasContent: string;
  }) => void;
  clearCraftBridgeConflict: () => void;
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
    opts?: { recordHistory?: boolean; zoomToFit?: boolean; preserveCaptureGeometry?: boolean },
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
    const page = ensurePageHasSubPages(slice.pages[pageId]!);
    if (pageId === slice.activePageId) {
      const subId = slice.activeSubPageId ?? page.activeSubPageId!;
      const updatedSub: EditorSubPage = {
        ...(page.subPages?.[subId] ?? createEmptySubPage(subId, "Page 1")),
        nodes: activeRemapped.nodes,
        childOrder: activeRemapped.childOrder,
        selectedIds: activeRemapped.selectedIds,
      };
      const subPages = { ...page.subPages, [subId]: updatedSub };
      pages[pageId] = {
        ...page,
        subPages,
        ...activeRemapped,
      };
      continue;
    }
    const subPages: Record<string, EditorSubPage> = {};
    for (const subId of page.subPageOrder ?? []) {
      const sub = page.subPages?.[subId];
      if (!sub) continue;
      const remapped = remapNodeTreeIds(sub.nodes, sub.childOrder, sub.selectedIds);
      subPages[subId] = {
        ...sub,
        nodes: remapped.nodes,
        childOrder: remapped.childOrder,
        selectedIds: remapped.selectedIds,
      };
    }
    const activeSubId = page.activeSubPageId ?? page.subPageOrder?.[0];
    const activeSub = activeSubId ? subPages[activeSubId] : undefined;
    pages[pageId] = activeSub
      ? {
          ...page,
          subPages,
          nodes: activeSub.nodes,
          childOrder: activeSub.childOrder,
          selectedIds: activeSub.selectedIds,
        }
      : {
          ...page,
          ...remapNodeTreeIds(page.nodes, page.childOrder, page.selectedIds),
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
    | "activeSubPageId"
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

function cloneSubPageCanvas(sub: EditorSubPage): Pick<EditorSubPage, "nodes" | "childOrder" | "selectedIds"> {
  return remapNodeTreeIds(sub.nodes, sub.childOrder, sub.selectedIds);
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
  const W = PML_PHONE_COLUMN_WIDTH;
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

type StructuralDocumentResult = DocumentMutationResult & {
  componentMutation?: MasterDocumentMutation;
};

function applyMasterPropagationFromResult(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  mutation: MasterDocumentMutation | undefined,
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  if (!mutation) return { nodes, childOrder };
  const refresh = new Set<string>();
  const propagated = applyMasterComponentDocumentChanges(nodes, childOrder, refresh, mutation);
  let nextNodes = propagated.nodes;
  let nextOrder = propagated.childOrder;
  if (refresh.size > 0) {
    nextNodes = relayoutParentsWithAutoLayout(nextNodes, nextOrder, refresh);
  }
  return { nodes: nextNodes, childOrder: nextOrder };
}

function propagateMasterLayerInsert(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  nodeId: string,
  reason = "insert",
): { nodes: Record<string, EditorNode>; childOrder: Record<string, string[]> } {
  if (!isMasterComponentEdit(nodes, nodeId)) return { nodes, childOrder };
  return applyMasterPropagationFromResult(nodes, childOrder, {
    addedNodeIds: [nodeId],
    changedNodeIds: [nodeId],
    structural: true,
    reason,
  });
}

const PAGE_SCOPED_UI_KEYS = [
  "layoutGuides",
  "layoutGuideDraft",
  "showGrid",
  "showRulers",
  "canvasBackgroundColor",
  "fileName",
  "comments",
] as const;

function buildDeleteSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  const tops = editableTopLevelSelection(s);
  if (tops.length === 0) return null;

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
  return {
    nodes,
    childOrder,
    ui: {
      selectedIds: [],
      editingTextId: null,
      pathEditModeNodeId: null,
      selectedPathPointIds: [],
    },
  };
}

type ZOrderMode = "forward" | "backward" | "front" | "back";

function buildZOrderResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
  mode: ZOrderMode,
): StructuralDocumentResult | null {
  const tops = editableTopLevelSelection(s);
  if (tops.length === 0) return null;

  const childOrder = { ...s.childOrder };
  const byParent = new Map<string, string[]>();
  for (const id of tops) {
    const P = parentListKey(s.nodes[id]!.parentId);
    if (!byParent.has(P)) byParent.set(P, []);
    byParent.get(P)!.push(id);
  }

  for (const [P, ids] of byParent) {
    const list = [...(childOrder[P] ?? [])];
    if (mode === "forward") {
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
    } else if (mode === "backward") {
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
    } else if (mode === "front") {
      const set = new Set(ids);
      const rest = list.filter((id) => !set.has(id));
      const stable = [...ids].sort((a, b) => list.indexOf(a) - list.indexOf(b));
      childOrder[P] = [...rest, ...stable];
      continue;
    } else {
      const set = new Set(ids);
      const rest = list.filter((id) => !set.has(id));
      const stable = [...ids].sort((a, b) => list.indexOf(a) - list.indexOf(b));
      childOrder[P] = [...stable, ...rest];
      continue;
    }
    childOrder[P] = list;
  }

  let nodes = { ...s.nodes };
  nodes = relayoutParentsWithAutoLayout(nodes, childOrder, byParent.keys());
  return { nodes, childOrder, ui: {} };
}

function buildReorderNodeResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  targetParentId: string,
  targetIndex: number,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;
  if ((n.parentId ?? ROOT) !== targetParentId) return null;
  const res = applyMoveNodeToParent(s, id, targetParentId, targetIndex);
  if (!res) return null;
  let { nodes, childOrder } = res;
  nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [targetParentId]);

  if (isMasterComponentEdit(s.nodes, id)) {
    const refresh = new Set<string>();
    const propagated = applyMasterComponentDocumentChanges(nodes, childOrder, refresh, {
      changedNodeIds: [id],
      structural: true,
      reason: "reorder",
    });
    nodes = propagated.nodes;
    childOrder = propagated.childOrder;
    if (refresh.size > 0) {
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);
    }
  }

  return { nodes, childOrder, ui: {} };
}

function buildMoveNodeToParentResult(
  s: EditorState,
  id: string,
  newParentId: string | null,
  index: number,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;
  const newKey = newParentId === ROOT ? ROOT : newParentId!;
  const oldKey = parentListKey(n.parentId);

  let stateForMove: EditorState = s;
  if (newKey !== ROOT) {
    const parent = s.nodes[newKey];
    const gapPatch = freezeAutoLayoutGapBeforeChildInsert(parent, s.nodes, s.childOrder, id);
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
  if (!res) return null;
  let { nodes, childOrder } = res;
  const refresh = new Set<string>();
  if (oldKey !== newKey) {
    if (oldKey !== ROOT) refresh.add(oldKey);
    if (newKey !== ROOT) refresh.add(newKey);
  } else {
    refresh.add(oldKey);
  }
  nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);

  const movedWithinMaster = isMasterComponentEdit(s.nodes, id);
  if (movedWithinMaster) {
    const propagated = applyMasterComponentDocumentChanges(nodes, childOrder, refresh, {
      changedNodeIds: [id],
      structural: true,
      reason: "reparent",
    });
    nodes = propagated.nodes;
    childOrder = propagated.childOrder;
    if (refresh.size > 0) {
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);
    }
  }

  return { nodes, childOrder, ui: {} };
}

function buildAddRectangleResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldX: number,
  worldY: number,
): StructuralDocumentResult {
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
    ui: { selectedIds: [id], tool: "move" as Tool, editingTextId: null },
  };
}

function buildAddTextAtResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "canvasBackgroundColor">,
  worldX: number,
  worldY: number,
): StructuralDocumentResult {
  const ts = textStyleFromSelection(s);
  const typo = resolveTextTypo(ts);
  const { width: tw, height: th } = computeTextBoxSize("", typo, "auto-width", 0, 0);
  const x = Math.round(worldX);
  const y = Math.round(worldY);
  const id = `text-${Date.now()}`;
  const { node: base } = createPointTextAt(x, y, tw, th, ts);
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
    ui: {
      selectedIds: [id],
      tool: "move" as Tool,
      editingTextId: id,
      textEditSelection: { anchor: 0, focus: 0 },
    },
  };
}

function buildCreateTextBoxFromDragResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "canvasBackgroundColor">,
  start: { x: number; y: number },
  end: { x: number; y: number },
  modifiers: { shiftKey: boolean; altKey: boolean },
): StructuralDocumentResult {
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
    ui: {
      selectedIds: [id],
      tool: "move" as Tool,
      editingTextId: id,
      textEditSelection: { anchor: 0, focus: 0 },
    },
  };
}

function commitStructuralResult(result: StructuralDocumentResult | null): void {
  if (!result) return;
  const stBefore = useEditorStore.getState();
  const propagated = applyMasterPropagationFromResult(
    result.nodes,
    result.childOrder,
    result.componentMutation,
  );
  const mergedResult: StructuralDocumentResult = {
    ...result,
    nodes: propagated.nodes,
    childOrder: propagated.childOrder,
  };
  commitDocumentMutation(mergedResult, (built) => {
    const st = useEditorStore.getState();
    const pageFields: Partial<EditorState> = {};
    for (const key of PAGE_SCOPED_UI_KEYS) {
      if (key in built.ui) {
        (pageFields as Record<string, unknown>)[key] = built.ui[key];
      }
    }
    const mergedForSync = {
      ...st,
      nodes: built.nodes,
      childOrder: built.childOrder,
      ...pageFields,
    };
    const pageSync =
      Object.keys(pageFields).length > 0 ? syncActivePageRecord(mergedForSync) : {};
    useEditorStore.setState({
      nodes: built.nodes,
      childOrder: built.childOrder,
      ...(built.assets ? { assets: built.assets } : {}),
      ...(built.designTokens ? { designTokens: built.designTokens } : {}),
      ...(built.fontAssets ? { fontAssets: built.fontAssets } : {}),
      ...built.ui,
      ...pageSync,
    });
    let textLayoutDirty = false;
    for (const id of Object.keys(built.nodes)) {
      const next = built.nodes[id];
      const prev = stBefore.nodes[id];
      if (!next || next.type !== "text" || !prev || prev.type !== "text") continue;
      if (
        next.width !== prev.width ||
        next.height !== prev.height ||
        next.textResizeMode !== prev.textResizeMode ||
        next.autoResize !== prev.autoResize ||
        next.content !== prev.content
      ) {
        clearCanonicalTextLayoutCache(id);
        textLayoutDirty = true;
      }
    }
    if (textLayoutDirty) bumpTextLayoutEpoch();
    if (stBefore.transformInteractionMode !== "rotate" && !isRotateGeometryLockActive(stBefore)) {
      syncWasmDocumentAfterStoreUpdate();
    }
  });
}

let resizePreviewRaf = 0;
let pendingResizePreview: StructuralDocumentResult | null = null;

function flushResizePreviewToStore(): void {
  resizePreviewRaf = 0;
  const result = pendingResizePreview;
  pendingResizePreview = null;
  if (!result) return;
  const st = useEditorStore.getState();
  let textLayoutDirty = false;
  for (const id of Object.keys(result.nodes)) {
    const next = result.nodes[id];
    const prev = st.nodes[id];
    if (!next || next.type !== "text" || !prev || prev.type !== "text") continue;
    if (
      next.width !== prev.width ||
      next.height !== prev.height ||
      next.textResizeMode !== prev.textResizeMode ||
      next.autoResize !== prev.autoResize ||
      next.content !== prev.content
    ) {
      clearCanonicalTextLayoutCache(id);
      textLayoutDirty = true;
    }
  }
  const merged = { ...st, nodes: result.nodes, childOrder: result.childOrder };
  useEditorStore.setState({
    nodes: result.nodes,
    childOrder: result.childOrder,
    ...syncActivePageRecord(merged),
  });
  if (textLayoutDirty) bumpTextLayoutEpoch();
  bumpResizePreview();
}

/** Live resize preview — apply to store immediately so text layout matches frame width. */
function applyResizePreviewToStore(result: StructuralDocumentResult): void {
  pendingResizePreview = result;
  if (resizePreviewRaf) {
    cancelAnimationFrame(resizePreviewRaf);
    resizePreviewRaf = 0;
  }
  flushResizePreviewToStore();
}

export function finalizeResizeWasmSync(): void {
  if (resizePreviewRaf) {
    cancelAnimationFrame(resizePreviewRaf);
    flushResizePreviewToStore();
  }
  syncWasmDocumentAfterStoreUpdate();
}

function buildAddEllipseResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldX: number,
  worldY: number,
): StructuralDocumentResult {
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
    ui: { selectedIds: [id], tool: "move" as Tool },
  };
}

function buildAddLineResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldX: number,
  worldY: number,
): StructuralDocumentResult {
  const w = 120;
  const h = 0;
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
    strokeColor: defaultCanvasForegroundColor(),
    strokeWidth: DEFAULT_LINE_STROKE_WIDTH,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokePosition: "center",
    strokeWidthProfile: "uniform",
  };
  const inserted = insertNodeWithFrameParenting(
    node,
    { x, y, width: w, height: h },
    s.nodes,
    s.childOrder,
    s.selectedIds,
    { minDimension: 0 },
  );
  return {
    nodes: inserted.nodes,
    childOrder: inserted.childOrder,
    ui: { selectedIds: [id], tool: "move" as Tool },
  };
}

function buildAddTriangleResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldX: number,
  worldY: number,
): StructuralDocumentResult {
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
    strokeColor: defaultCanvasForegroundColor(),
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
    ui: { selectedIds: [id], tool: "move" as Tool },
  };
}

function buildCreateShapeFromDragResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  shapeType: ShapeType,
  start: { x: number; y: number },
  end: { x: number; y: number },
  modifiers: { shiftKey: boolean; altKey: boolean },
  style?: Partial<Pick<EditorNode, "polygonSides" | "starPoints" | "starInnerRadius">>,
): StructuralDocumentResult {
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
    shapeType === "line" || shapeType === "arrow" ? { minDimension: 0 } : undefined,
  );
  const frameId = inserted.nodes[id]?.parentId;
  const nodesOut = frameId
    ? relayoutParentsWithAutoLayout(inserted.nodes, inserted.childOrder, [frameId])
    : inserted.nodes;
  return {
    nodes: nodesOut,
    childOrder: inserted.childOrder,
    ui: { selectedIds: [id], tool: "move" as Tool },
  };
}

function buildStartShapeFromDragResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "editorMode">,
  shapeType: ShapeType,
  start: { x: number; y: number },
  style?: Partial<Pick<EditorNode, "polygonSides" | "starPoints" | "starInnerRadius">>,
): StructuralDocumentResult | null {
  if (s.editorMode !== "design") return null;
  const draft = createShapeNode(
    shapeType,
    start,
    start,
    { shiftKey: false, altKey: false },
    style,
    "live",
  );
  const id = `${draft.type}-${Date.now()}`;
  const node: EditorNode = {
    ...draft,
    id,
    name: nextNumberedLayerName(s.nodes, draft.name),
  };
  const inserted = insertNodeWithFrameParenting(
    node,
    { x: node.x, y: node.y, width: node.width, height: node.height },
    s.nodes,
    s.childOrder,
    s.selectedIds,
    { minDimension: 0 },
  );
  const frameId = inserted.nodes[id]?.parentId;
  const nodesOut = frameId
    ? relayoutParentsWithAutoLayout(inserted.nodes, inserted.childOrder, [frameId])
    : inserted.nodes;
  return {
    nodes: nodesOut,
    childOrder: inserted.childOrder,
    ui: {
      shapeDrawingSession: { nodeId: id, shapeType, start, style },
      selectedIds: [] as string[],
    },
  };
}

function buildCreateFrameWithBoundsResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  x: number,
  y: number,
  width: number,
  height: number,
  opts?: { name?: string },
): StructuralDocumentResult {
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
    ui: { selectedIds: [id], tool: "move" as Tool, editingTextId: null },
  };
}

function buildStartFrameFromDragResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "editorMode">,
  start: { x: number; y: number },
): StructuralDocumentResult | null {
  if (s.editorMode !== "design") return null;
  const draft = createFrameNodeFromDrag(
    start,
    start,
    { shiftKey: false, altKey: false },
    nextFrameName(s.nodes),
    "live",
  );
  const id = `frame-${Date.now()}`;
  const node: EditorNode = { ...draft, id, parentId: null };
  const inserted = insertNodeWithFrameParenting(
    node,
    { x: node.x, y: node.y, width: node.width, height: node.height },
    s.nodes,
    s.childOrder,
    s.selectedIds,
    { minDimension: 0 },
  );
  const frameId = inserted.nodes[id]?.parentId;
  const nodesOut = frameId
    ? relayoutParentsWithAutoLayout(inserted.nodes, inserted.childOrder, [frameId])
    : inserted.nodes;
  return {
    nodes: nodesOut,
    childOrder: inserted.childOrder,
    ui: {
      frameDrawingSession: { nodeId: id, start },
      selectedIds: [] as string[],
    },
  };
}

function buildStartTextFromDragResult(
  s: Pick<
    EditorState,
    "nodes" | "childOrder" | "selectedIds" | "editorMode" | "canvasBackgroundColor"
  >,
  start: { x: number; y: number },
): StructuralDocumentResult | null {
  if (s.editorMode !== "design") return null;
  const ts = textStyleFromSelection(s);
  const draft = createTextDraftNodeFromDrag(
    start,
    start,
    { shiftKey: false, altKey: false },
    ts,
    "live",
  );
  const id = `text-${Date.now()}`;
  const node: EditorNode = {
    ...draft,
    id,
    parentId: null,
    name: layerNameFromTextContent(draft.content),
    ...textResizePatch(draft.textResizeMode ?? "auto-width"),
  };
  const inserted = insertNodeWithFrameParenting(
    node,
    { x: node.x, y: node.y, width: node.width, height: node.height },
    s.nodes,
    s.childOrder,
    s.selectedIds,
    { minDimension: 0 },
  );
  return {
    nodes: inserted.nodes,
    childOrder: inserted.childOrder,
    ui: {
      textDrawingSession: { nodeId: id, start },
      selectedIds: [] as string[],
    },
  };
}

function buildAddRectangleToolbarResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
): StructuralDocumentResult {
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
    ui: { selectedIds: [id] },
  };
}

function buildRemoveDraftNodeResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  sessionKey: "shapeDrawingSession" | "frameDrawingSession" | "textDrawingSession",
): StructuralDocumentResult | null {
  if (!s.nodes[nodeId]) {
    return { nodes: s.nodes, childOrder: s.childOrder, ui: { [sessionKey]: null } };
  }
  const parentRef = s.nodes[nodeId]?.parentId;
  const { nodes, childOrder } = removeNodeAndDescendants(s, nodeId);
  const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
  return {
    nodes: nodes2,
    childOrder,
    ui: { [sessionKey]: null, selectedIds: [] as string[] },
  };
}

function buildDuplicateSelectionResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldOffset: CloneWorldOffset | null,
): StructuralDocumentResult | null {
  const cloned = cloneTopLevelSelectionState(s, worldOffset);
  if (!cloned) return null;
  return {
    nodes: cloned.nodes,
    childOrder: cloned.childOrder,
    ui: {
      selectedIds: cloned.selectedIds,
      tool: cloned.tool,
      editingTextId: cloned.editingTextId,
    },
  };
}

function buildPasteSelectionResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "assets">,
  payload: EditorClipboardPayloadV1,
  offset: number,
): StructuralDocumentResult | null {
  if (!payload.rootIds?.length) return null;

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

  for (const rootId of payload.rootIds) {
    const rootOld = payload.nodes[rootId];
    if (!rootOld) continue;
    const pasteParentId = resolvePasteParentId(s, payload, rootId);
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
      const wx = worldR.x;
      const wy = worldR.y + (isTreeRoot ? -offset : 0);
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
    ui: {
      selectedIds: newRoots,
      tool: "move" as Tool,
      editingTextId: null,
      contextMenu: null,
    },
  };
}

function buildAlignSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
  direction: AlignDirection,
): StructuralDocumentResult | null {
  if (!canAlignSelection(s.selectedIds, s.nodes, s.childOrder)) return null;
  const targets = resolveAlignTargetIds(s.selectedIds, s.nodes, s.childOrder);
  if (targets.length === 0) return null;
  let nodes = alignNodesInDocument(s.nodes, s.childOrder, targets, direction);
  const relayoutKeys = relayoutParentKeysAfterManualPosition(
    nodes,
    s.childOrder,
    targets,
    parentListKey,
  );
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, relayoutKeys);
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildAlignSelectionGridResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
  row: number,
  col: number,
): StructuralDocumentResult | null {
  if (!canAlignSelection(s.selectedIds, s.nodes, s.childOrder)) return null;
  const targets = resolveAlignTargetIds(s.selectedIds, s.nodes, s.childOrder);
  if (targets.length === 0) return null;
  let nodes = alignNodesInDocumentToGrid(s.nodes, s.childOrder, targets, row, col);
  const relayoutKeys = relayoutParentKeysAfterManualPosition(
    nodes,
    s.childOrder,
    targets,
    parentListKey,
  );
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, relayoutKeys);
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildDistributeSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
  axis: "horizontal" | "vertical",
): StructuralDocumentResult | null {
  const tops = alignableSelectionIds(s.selectedIds, s.nodes);
  if (tops.length < 3) return null;
  let nodes = distributeNodesInDocument(s.nodes, s.childOrder, tops, axis);
  const relayoutKeys = relayoutParentKeysAfterManualPosition(
    nodes,
    s.childOrder,
    tops,
    parentListKey,
  );
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, relayoutKeys);
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildCreateBooleanGroupResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
  operation: BooleanOperation,
): StructuralDocumentResult | null {
  const tops = getBooleanEligibleSelection(s.selectedIds, s.nodes);
  if (tops.length < 2) return null;
  const parentId = s.nodes[tops[0]!]!.parentId;
  if (!tops.every((id) => s.nodes[id]!.parentId === parentId)) return null;
  const P = parentListKey(parentId);
  const list = s.childOrder[P] ?? [];
  let ordered = [...tops].sort((a, b) => list.indexOf(a) - list.indexOf(b));
  const pw = parentId ? worldRect(parentId, s.nodes) : { x: 0, y: 0, width: 0, height: 0 };
  const visible = boundsForBooleanChildren(operation, ordered, s.nodes, s.childOrder);
  const minX = visible.x;
  const minY = visible.y;
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
  let nodesOut = relayoutParentsWithAutoLayout(nodes, childOrder, [P]);
  nodesOut = syncGroupFrameToVisible(gid, nodesOut, childOrder);
  return {
    nodes: nodesOut,
    childOrder,
    ui: {
      selectedIds: [gid],
      tool: "move" as Tool,
      editingTextId: null,
      objectEditModeNodeId: null,
    },
  };
}

function buildUpdateBooleanOperationResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  groupId: string,
  operation: BooleanOperation,
): StructuralDocumentResult | null {
  const node = s.nodes[groupId];
  if (!node?.isBooleanGroup) return null;
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
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildFlattenBooleanGroupResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
  flattenResult: NonNullable<ReturnType<typeof flattenBooleanGroup>>,
): StructuralDocumentResult | null {
  const gid = s.selectedIds[0];
  if (!gid) return null;
  const g2 = s.nodes[gid];
  if (!g2?.isBooleanGroup) return null;
  const kids = s.childOrder[gid] ?? [];
  const parentId = g2.parentId;
  const P = parentListKey(parentId);
  const pw = parentId ? worldRect(parentId, s.nodes) : { x: 0, y: 0, width: 0, height: 0 };
  const pathNode = booleanResultToPathNode(flattenResult, g2, parentId);
  pathNode.x = flattenResult.x - pw.x;
  pathNode.y = flattenResult.y - pw.y;
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
  return {
    nodes,
    childOrder,
    ui: { selectedIds: [pathNode.id], tool: "move" as Tool },
  };
}

function buildOutlineTextToVectorsResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  textId: string,
  group: EditorNode,
  vectors: EditorNode[],
): StructuralDocumentResult | null {
  const text = s.nodes[textId];
  if (!text) return null;
  const parentId = text.parentId;
  const P = parentListKey(parentId);
  const nodes = { ...s.nodes };
  const childOrder = { ...s.childOrder };

  delete nodes[textId];
  nodes[group.id] = group;
  for (const vector of vectors) {
    nodes[vector.id] = vector;
  }

  const list = [...(childOrder[P] ?? [])];
  const idx = list.indexOf(textId);
  if (idx >= 0) list[idx] = group.id;
  else list.push(group.id);
  childOrder[P] = list;
  // childOrder is back-to-front; layer panel reverses for display (reading order top-to-bottom).
  childOrder[group.id] = [...vectors].reverse().map((v) => v.id);

  const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [P]);
  return {
    nodes: nodes2,
    childOrder,
    ui: {
      pathEditModeNodeId: null,
      shapeEditModeNodeId: null,
      objectEditModeNodeId: null,
      selectedPathPointIds: [] as string[],
      selectedIds: [group.id],
      tool: "move" as Tool,
      editingTextId: null,
    },
  };
}

function buildOutlineStrokeSelectionResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  converted: EditorNode,
  removeKids: string[],
): StructuralDocumentResult | null {
  const current = s.nodes[id];
  if (!current) return null;
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
  const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(current.parentId)]);
  return {
    nodes: nodes2,
    childOrder,
    ui: {
      pathEditModeNodeId: id,
      shapeEditModeNodeId: null,
      objectEditModeNodeId: null,
      selectedPathPointIds: [] as string[],
      selectedIds: [id],
      tool: "move" as Tool,
    },
  };
}

function buildStartPathAtResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "editorMode" | "tool" | "penDrawingNodeId">,
  worldPoint: { x: number; y: number },
): StructuralDocumentResult | null {
  if (s.editorMode !== "design" || s.tool !== "pen" || s.penDrawingNodeId) return null;
  const id = `path-${Date.now()}`;
  const pt0 = buildCornerPathPoint(0, 0);
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
    strokeColor: defaultCanvasForegroundColor(),
    strokeWidth: 2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokePosition: "center",
    strokeWidthProfile: "uniform",
    pathHandleMirroring: "angle-length",
  };
  node = normalizePathNode(node);
  const inserted = insertNodeWithFrameParenting(
    node,
    { x: worldPoint.x, y: worldPoint.y, width: node.width, height: node.height },
    s.nodes,
    s.childOrder,
    s.selectedIds,
    { minDimension: 0 },
  );
  return {
    nodes: inserted.nodes,
    childOrder: inserted.childOrder,
    ui: { penDrawingNodeId: id, selectedIds: [] as string[], tool: "pen" as Tool },
  };
}

function buildAddPathPointResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  drawId: string,
  worldPoint: { x: number; y: number },
): StructuralDocumentResult | null {
  const n = s.nodes[drawId];
  if (!n || n.type !== "path" || !n.pathPoints) return null;
  const nOrigin = getRenderedWorldTopLeft(drawId, s.nodes, s.childOrder);
  const plx = worldPoint.x - nOrigin.x;
  const ply = worldPoint.y - nOrigin.y;
  const pts = [...n.pathPoints, buildCornerPathPoint(plx, ply)];
  let next: EditorNode = { ...n, pathPoints: pts };
  next = normalizePathNode(next);
  let nodes = { ...s.nodes, [drawId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  const repaired = repairNodeHierarchy(nodes, s.childOrder);
  return { nodes: repaired.nodes, childOrder: repaired.childOrder, ui: {} };
}

function buildAddPathPointDragResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  drawId: string,
  anchorWorld: { x: number; y: number },
  dragWorld: { x: number; y: number },
): StructuralDocumentResult | null {
  const n = s.nodes[drawId];
  if (!n || n.type !== "path" || !n.pathPoints?.length) return null;
  const nOrigin = getRenderedWorldTopLeft(drawId, s.nodes, s.childOrder);
  const anchorLocal = { x: anchorWorld.x - nOrigin.x, y: anchorWorld.y - nOrigin.y };
  const dragLocal = { x: dragWorld.x - nOrigin.x, y: dragWorld.y - nOrigin.y };
  const pts = [...n.pathPoints];
  const prevIdx = pts.length - 1;
  const prev = pts[prevIdx]!;
  const { prevPatch, newPoint } = buildSmoothPathPointFromDrag(prev, anchorLocal, dragLocal);
  pts[prevIdx] = { ...prev, ...prevPatch };
  pts.push(newPoint);
  let next: EditorNode = { ...n, pathPoints: pts };
  next = normalizePathNode(next);
  let nodes = { ...s.nodes, [drawId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  const repaired = repairNodeHierarchy(nodes, s.childOrder);
  return { nodes: repaired.nodes, childOrder: repaired.childOrder, ui: {} };
}

function buildFinishPathResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "penDrawingNodeId">,
  pathId: string,
  asClosed: boolean,
): StructuralDocumentResult | null {
  const n = s.nodes[pathId];
  if (!n || n.type !== "path") {
    return { nodes: s.nodes, childOrder: s.childOrder, ui: { penDrawingNodeId: null } };
  }
  const pts = n.pathPoints ?? [];
  if (pts.length < 2) {
    const parentRef = n.parentId;
    const { nodes, childOrder } = removeNodeAndDescendants(s, pathId);
    const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
    return {
      nodes: nodes2,
      childOrder,
      ui: {
        penDrawingNodeId: null,
        selectedIds: [] as string[],
        pathEditModeNodeId: null,
        objectEditModeNodeId: null,
        selectedPathPointIds: [] as string[],
      },
    };
  }
  let next: EditorNode = { ...n, pathClosed: asClosed };
  next = normalizePathNode(next);
  let nodes = { ...s.nodes, [pathId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  const repaired = repairNodeHierarchy(nodes, s.childOrder);
  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    ui: {
      penDrawingNodeId: null,
      selectedIds: [pathId],
      pathEditModeNodeId: pathId,
      objectEditModeNodeId: null,
      selectedPathPointIds: [] as string[],
    },
  };
}

function buildCancelPathResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  pathId: string,
): StructuralDocumentResult | null {
  if (!s.nodes[pathId]) {
    return { nodes: s.nodes, childOrder: s.childOrder, ui: { penDrawingNodeId: null, selectedIds: [] } };
  }
  const parentRef = s.nodes[pathId]?.parentId;
  const { nodes, childOrder } = removeNodeAndDescendants(s, pathId);
  const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
  return {
    nodes: nodes2,
    childOrder,
    ui: { penDrawingNodeId: null, selectedIds: [] as string[] },
  };
}

function buildFinishShapeDragResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n) {
    return { nodes: s.nodes, childOrder: s.childOrder, ui: { shapeDrawingSession: null } };
  }
  const frameId = n.parentId;
  let nodes = s.nodes;
  if (frameId) {
    nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [frameId]);
  }
  const repaired = repairNodeHierarchyIfNeeded(nodes, s.childOrder);
  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    ui: { shapeDrawingSession: null, selectedIds: [nodeId], tool: "move" as Tool },
  };
}

function buildFinishFrameDragResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
): StructuralDocumentResult | null {
  const node = s.nodes[nodeId];
  if (!node) {
    return { nodes: s.nodes, childOrder: s.childOrder, ui: { frameDrawingSession: null } };
  }
  const parentId = node.parentId;
  let nodes = s.nodes;
  if (parentId) {
    nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [parentId]);
  }
  const repaired = repairNodeHierarchyIfNeeded(nodes, s.childOrder);
  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    ui: {
      frameDrawingSession: null,
      selectedIds: [nodeId],
      tool: "move" as Tool,
      editingTextId: null,
    },
  };
}

const finishTextDragUi = (nodeId: string) => ({
  textDrawingSession: null,
  selectedIds: [nodeId],
  tool: "move" as Tool,
  editingTextId: nodeId,
  textEditSelection: { anchor: 0, focus: 0 },
});

function buildFinishTextDragClickResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "canvasBackgroundColor" | "selectedIds">,
  nodeId: string,
  start: { x: number; y: number },
): StructuralDocumentResult | null {
  const node = s.nodes[nodeId];
  if (!node) return null;
  const ts = textStyleFromSelection(s);
  const typo = resolveTextTypo(ts);
  const emptySize = computeTextBoxSize("", typo, "auto-width", 0, 0);
  const localStart = node.parentId
    ? worldPointToParentLocalFromChildOrder(start.x, start.y, node.parentId, s.nodes, s.childOrder)
    : start;
  const nodes = {
    ...s.nodes,
    [nodeId]: {
      ...node,
      x: Math.round(localStart.x),
      y: Math.round(localStart.y),
      width: emptySize.width,
      height: emptySize.height,
      ...textResizePatch("auto-width"),
      content: "",
    },
  };
  return { nodes, childOrder: s.childOrder, ui: finishTextDragUi(nodeId) };
}

function buildFinishTextDragBoxResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "canvasBackgroundColor" | "selectedIds">,
  nodeId: string,
  start: { x: number; y: number },
  end: { x: number; y: number },
  modifiers: { shiftKey: boolean; altKey: boolean },
): StructuralDocumentResult | null {
  const node = s.nodes[nodeId];
  if (!node) return null;
  const ts = textStyleFromSelection(s);
  const drag = worldDragPairInParentSpace(node.parentId, s.nodes, s.childOrder, start, end);
  const draft = createTextDraftNodeFromDrag(drag.start, drag.end, modifiers, ts, "commit");
  const next = {
    ...node,
    x: draft.x,
    y: draft.y,
    width: draft.width,
    height: draft.height,
    ...textResizePatch("fixed"),
  };
  if (isZeroAreaDraftNode(next)) return null;
  return {
    nodes: { ...s.nodes, [nodeId]: next },
    childOrder: s.childOrder,
    ui: finishTextDragUi(nodeId),
  };
}

function buildPlaceImportedFilesResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "assets">,
  svgImports: Awaited<ReturnType<typeof importSvgFileToEditorGraph>>[],
  assetsToAdd: EditorAsset[],
  worldX: number,
  worldY: number,
): StructuralDocumentResult {
  let nodes = { ...s.nodes };
  let childOrder = { ...s.childOrder };
  const assets = { ...s.assets };
  let selectedIds = s.selectedIds;
  const newIds: string[] = [];
  let placeIndex = 0;

  for (const imported of svgImports) {
    if (!imported) continue;
    const merged = insertImportedNodes(imported, worldX, worldY, {
      nodes,
      childOrder,
      assets,
      selectedIds,
    }, { placeIndex });
    nodes = merged.nodes;
    childOrder = merged.childOrder;
    Object.assign(assets, merged.assets);
    selectedIds = merged.selectedIds;
    newIds.push(merged.rootId);
    placeIndex += 1;
  }

  for (let i = 0; i < assetsToAdd.length; i++) {
    const asset = assetsToAdd[i]!;
    assets[asset.id] = asset;
    const iw = asset.width && asset.width > 0 ? asset.width : 200;
    const ih = asset.height && asset.height > 0 ? asset.height : 150;
    const scale = Math.min(1, 480 / iw, 480 / ih);
    const w = Math.max(16, Math.round(iw * scale));
    const h = Math.max(16, Math.round(ih * scale));
    const cx = worldX + placeIndex * 12;
    const cy = worldY + placeIndex * 12;
    placeIndex += 1;
    const { x, y } = worldCenteredRootPoint(cx, cy, w, h);
    const id = `image-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`;
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
      assetId: asset.id,
      imageSrc: asset.dataUrl,
      imageName: asset.name,
      imageMimeType: asset.mimeType,
      imageFitMode: "fill",
      fillOpacity: 1,
      fillEnabled: true,
    };
    const inserted = insertNodeWithFrameParenting(node, { x, y, width: w, height: h }, nodes, childOrder, selectedIds);
    nodes = inserted.nodes;
    childOrder = inserted.childOrder;
    selectedIds = [id];
    newIds.push(id);
  }

  return {
    nodes,
    childOrder,
    assets,
    ui: { selectedIds: newIds, tool: "move" as Tool },
  };
}

function buildSetNodeFillHexResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  hex: string,
): StructuralDocumentResult | null {
  const normalized = normalizeHex(hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`);
  if (!normalized) return null;
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  const stylePatch: NodeStylePatch =
    n.type === "text"
      ? { fill: normalized, fillType: "solid", textColor: normalized, fillEnabled: true }
      : { fill: normalized, fillType: "solid", fillEnabled: true };
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
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildSetSelectionFillHexResult(
  s: Pick<EditorState, "editorMode" | "selectedIds" | "nodes" | "childOrder">,
  hex: string,
): StructuralDocumentResult | null {
  if (s.editorMode !== "design") return null;
  const normalized = normalizeHex(hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`);
  if (!normalized) return null;

  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length === 0) return null;

  const targetIds = [
    ...new Set(tops.flatMap((id) => expandStyleTargetIds(id, s.nodes, s.childOrder))),
  ].filter((id) => nodeSupportsFillColor(s.nodes[id]));

  if (targetIds.length === 0) return null;

  let nodes = { ...s.nodes };
  let changed = false;
  for (const nodeId of targetIds) {
    const slice = buildSetNodeFillHexResult({ nodes, childOrder: s.childOrder }, nodeId, normalized);
    if (!slice) continue;
    nodes = slice.nodes;
    changed = true;
  }
  if (!changed) return null;
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildUpdateSelectionStyleResult(
  s: EditorState,
  patch: NodeStylePatch,
): StructuralDocumentResult | null {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked;
  });
  if (tops.length === 0) return null;

  let nodes = s.nodes;
  let childOrder = s.childOrder;
  let changed = false;
  for (const id of tops) {
    const slice = buildUpdateNodeStyleResult({ ...s, nodes, childOrder }, id, patch);
    if (!slice) continue;
    nodes = slice.nodes;
    childOrder = slice.childOrder;
    changed = true;
  }
  if (!changed) return null;
  return { nodes, childOrder, ui: {} };
}

function buildUpdateSelectionNodesResult(
  s: EditorState,
  patch: Partial<EditorNode>,
): StructuralDocumentResult | null {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked;
  });
  if (tops.length === 0) return null;
  const patches: Record<string, Partial<EditorNode>> = {};
  for (const id of tops) {
    patches[id] = patch;
  }
  return buildUpdateNodesResult(s, patches);
}

function buildSetNodeTextColorHexResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  hex: string,
): StructuralDocumentResult | null {
  const normalized = normalizeHex(hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`);
  if (!normalized) return null;
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  const stylePatch: NodeStylePatch = {
    textColor: normalized,
    fill: normalized,
    fillType: "solid",
    fillEnabled: true,
  };
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
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildApplyTokenToSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder" | "designTokens">,
  tokenId: string,
): StructuralDocumentResult | null {
  const t = s.designTokens[tokenId];
  if (!t) return null;
  const nodes = { ...s.nodes };
  for (const id of s.selectedIds) {
    const raw = nodes[id];
    if (!raw || raw.locked) continue;
    if (t.type === "color") {
      if (["frame", "rectangle", "ellipse", "polygon", "path", "text"].includes(raw.type)) {
        nodes[id] = { ...raw, fillTokenId: tokenId, fillType: "solid", fillEnabled: true };
      }
    } else if (t.type === "gradient") {
      if (["frame", "rectangle", "ellipse", "polygon", "path"].includes(raw.type)) {
        nodes[id] = { ...raw, fillTokenId: tokenId, fillType: "gradient", fillEnabled: true };
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
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildUpdatePathPointResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  pointId: string,
  patch: Partial<Pick<PathPoint, "x" | "y" | "handleIn" | "handleOut" | "pointType">>,
  opts?: { breakHandleMirror?: boolean },
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.type !== "path" || !n.pathPoints) return null;
  const nodeMirroring = n.pathHandleMirroring ?? "none";
  const pts = n.pathPoints.map((p) => {
    if (p.id !== pointId) return p;
    let merged: PathPoint = { ...p };
    if (patch.x !== undefined) merged.x = patch.x;
    if (patch.y !== undefined) merged.y = patch.y;
    if (patch.pointType !== undefined) merged.pointType = patch.pointType;
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
      const mirroring = effectiveHandleMirroring(merged, nodeMirroring, opts?.breakHandleMirror);
      merged = mergePathPointHandles(merged, handlePatch, mirroring, movedWhich);
    }
    return merged;
  });
  let next: EditorNode = { ...n, pathPoints: pts, flattenedPathData: undefined };
  next = normalizePathNode(next);
  let nodes = { ...s.nodes, [nodeId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildDeletePathPointResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "pathEditModeNodeId" | "selectedPathPointIds">,
  nodeId: string,
  pointId: string,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.type !== "path" || !n.pathPoints) return null;
  const nextPts = n.pathPoints.filter((p) => p.id !== pointId);
  if (nextPts.length < 2) {
    const parentRef = n.parentId;
    const { nodes, childOrder } = removeNodeAndDescendants(s, nodeId);
    const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
    return {
      nodes: nodes2,
      childOrder,
      ui: {
        selectedIds: s.selectedIds.filter((x) => x !== nodeId),
        pathEditModeNodeId: s.pathEditModeNodeId === nodeId ? null : s.pathEditModeNodeId,
        selectedPathPointIds: [] as string[],
      },
    };
  }
  let next: EditorNode = { ...n, pathPoints: nextPts, flattenedPathData: undefined };
  next = normalizePathNode(next);
  let nodes = { ...s.nodes, [nodeId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  return {
    nodes,
    childOrder: s.childOrder,
    ui: { selectedPathPointIds: s.selectedPathPointIds.filter((id) => id !== pointId) },
  };
}

function applyPathPointPatches(
  n: EditorNode,
  patches: Record<string, Partial<Pick<PathPoint, "x" | "y" | "handleIn" | "handleOut">>>,
  opts?: { breakHandleMirror?: boolean },
): EditorNode {
  if (!n.pathPoints) return n;
  const nodeMirroring = n.pathHandleMirroring ?? "none";
  const pts = n.pathPoints.map((p) => {
    const patch = patches[p.id];
    if (!patch) return p;
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
      const mirroring = effectiveHandleMirroring(merged, nodeMirroring, opts?.breakHandleMirror);
      merged = mergePathPointHandles(merged, handlePatch, mirroring, movedWhich);
    }
    return merged;
  });
  let next: EditorNode = { ...n, pathPoints: pts, flattenedPathData: undefined };
  next = normalizePathNode(next);
  return next;
}

function buildUpdatePathPointsResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  patches: Record<string, Partial<Pick<PathPoint, "x" | "y" | "handleIn" | "handleOut">>>,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.type !== "path" || !n.pathPoints) return null;
  let next = applyPathPointPatches(n, patches);
  let nodes = { ...s.nodes, [nodeId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildDeletePathPointsResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "pathEditModeNodeId" | "selectedPathPointIds">,
  nodeId: string,
  pointIds: string[],
): StructuralDocumentResult | null {
  if (pointIds.length === 0) return null;
  const n = s.nodes[nodeId];
  if (!n || n.type !== "path" || !n.pathPoints) return null;
  const remove = new Set(pointIds);
  const nextPts = n.pathPoints.filter((p) => !remove.has(p.id));
  if (nextPts.length < 2) {
    const parentRef = n.parentId;
    const { nodes, childOrder } = removeNodeAndDescendants(s, nodeId);
    const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
    return {
      nodes: nodes2,
      childOrder,
      ui: {
        selectedIds: s.selectedIds.filter((x) => x !== nodeId),
        pathEditModeNodeId: s.pathEditModeNodeId === nodeId ? null : s.pathEditModeNodeId,
        selectedPathPointIds: [] as string[],
      },
    };
  }
  let next: EditorNode = { ...n, pathPoints: nextPts, flattenedPathData: undefined };
  next = normalizePathNode(next);
  let nodes = { ...s.nodes, [nodeId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  return {
    nodes,
    childOrder: s.childOrder,
    ui: { selectedPathPointIds: s.selectedPathPointIds.filter((id) => !remove.has(id)) },
  };
}

function buildDetachTokenFromSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
  tokenType: DetachableTokenKind,
): StructuralDocumentResult {
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
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildToggleLockSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  if (s.selectedIds.length === 0) return null;
  const nodes = { ...s.nodes };
  for (const id of s.selectedIds) {
    const n = nodes[id];
    if (!n) continue;
    nodes[id] = { ...n, locked: !n.locked };
  }
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildToggleVisibleSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  if (s.selectedIds.length === 0) return null;
  const nodes = { ...s.nodes };
  for (const id of s.selectedIds) {
    const n = nodes[id];
    if (!n) continue;
    nodes[id] = { ...n, visible: !n.visible };
  }
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildStartPencilStrokeResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "editorMode" | "tool" | "canvasBackgroundColor" | "pencilStrokeWidth">,
  worldPoint: { x: number; y: number },
): StructuralDocumentResult | null {
  if (s.editorMode !== "design" || s.tool !== "pencil") return null;
  const id = `path-${Date.now()}`;
  const strokeWidth = clampStrokeWidth(s.pencilStrokeWidth || DEFAULT_PENCIL_STROKE_WIDTH);
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
    strokeColor: defaultCanvasForegroundColor(),
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
    ui: { pencilDrawingNodeId: id, selectedIds: [] as string[], tool: "pencil" as Tool },
  };
}

function buildExtendPencilStrokeResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "zoom" | "tool" | "pencilDrawingNodeId">,
  drawId: string,
  worldPoints: Array<{ x: number; y: number }>,
): StructuralDocumentResult | null {
  if (worldPoints.length === 0 || s.tool !== "pencil") return null;
  const n = s.nodes[drawId];
  if (!n || n.type !== "path" || !n.pathPoints?.length) return null;
  const nOrigin = getRenderedWorldTopLeft(drawId, s.nodes, s.childOrder);
  let pts = n.pathPoints;
  let last = pts[pts.length - 1]!;
  let changed = false;
  for (const worldPoint of worldPoints) {
    const lx = worldPoint.x - nOrigin.x;
    const ly = worldPoint.y - nOrigin.y;
    const firstSample = pts.length === 1;
    if (!firstSample && !shouldSampleFreehandPoint(last.x, last.y, lx, ly, s.zoom)) {
      continue;
    }
    pts = [...pts, { id: newPathPointId(), x: lx, y: ly }];
    last = pts[pts.length - 1]!;
    changed = true;
  }
  if (!changed) return null;
  let next: EditorNode = { ...n, pathPoints: pts };
  next = normalizePathNode(next);
  return {
    nodes: { ...s.nodes, [drawId]: next },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildFinishPencilStrokeResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "zoom" | "pencilDrawingNodeId">,
  pathId: string,
): StructuralDocumentResult | null {
  const n = s.nodes[pathId];
  if (!n || n.type !== "path" || !n.pathPoints) {
    return { nodes: s.nodes, childOrder: s.childOrder, ui: { pencilDrawingNodeId: null } };
  }
  const epsilon = 2.5 / Math.max(s.zoom, 0.01);
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
      const { nodes, childOrder } = removeNodeAndDescendants(s, pathId);
      const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
      return {
        nodes: nodes2,
        childOrder,
        ui: { pencilDrawingNodeId: null, selectedIds: [] as string[] },
      };
    }
  }
  const pts = smoothPolylineToPathPoints(simplified, n.pathClosed ?? false, newPathPointId);
  let next: EditorNode = { ...n, pathPoints: pts, pathClosed: n.pathClosed ?? false };
  next = normalizePathNode(next);
  let nodes = { ...s.nodes, [pathId]: next };
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [n.parentId ?? ROOT]);
  const repaired = repairNodeHierarchy(nodes, s.childOrder);
  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    ui: {
      pencilDrawingNodeId: null,
      tool: "move" as Tool,
      selectedIds: [pathId],
      pathEditModeNodeId: null,
      objectEditModeNodeId: null,
      selectedPathPointIds: [] as string[],
    },
  };
}

function buildCancelPencilStrokeResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  pathId: string,
): StructuralDocumentResult | null {
  if (!s.nodes[pathId]) {
    return { nodes: s.nodes, childOrder: s.childOrder, ui: { pencilDrawingNodeId: null, selectedIds: [] } };
  }
  const parentRef = s.nodes[pathId]?.parentId;
  const { nodes, childOrder } = removeNodeAndDescendants(s, pathId);
  const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
  return {
    nodes: nodes2,
    childOrder,
    ui: { pencilDrawingNodeId: null, selectedIds: [] as string[] },
  };
}

function buildRenameNodeResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  name: string,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n) return null;
  return { nodes: { ...s.nodes, [id]: { ...n, name } }, childOrder: s.childOrder, ui: {} };
}

function buildToggleExpandedResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n) return null;
  return {
    nodes: { ...s.nodes, [id]: { ...n, expanded: !n.expanded } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildAddEffectResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  type: NodeEffectType,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  const ne = defaultNodeEffect(type);
  const list = [...(n.effects ?? []), ne];
  return {
    nodes: { ...s.nodes, [nodeId]: { ...n, effects: list } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildUpdateEffectResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  effectId: string,
  patch: Partial<import("@/lib/nodeEffects").NodeEffect>,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  const list = (n.effects ?? []).map((e) =>
    e.id === effectId ? mergeNodeEffectPatch(e, patch) : e,
  );
  return {
    nodes: { ...s.nodes, [nodeId]: { ...n, effects: list } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildDeleteEffectResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  effectId: string,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  const list = (n.effects ?? []).filter((e) => e.id !== effectId);
  return {
    nodes: { ...s.nodes, [nodeId]: { ...n, effects: list.length ? list : undefined } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildToggleEffectResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  effectId: string,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  const list = (n.effects ?? []).map((e) =>
    e.id === effectId ? { ...e, visible: !e.visible } : e,
  );
  return {
    nodes: { ...s.nodes, [nodeId]: { ...n, effects: list } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildSetPathHandleMirroringResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  mode: import("@/lib/pathHandles").PathHandleMirroring,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.type !== "path") return null;
  return {
    nodes: { ...s.nodes, [id]: { ...n, pathHandleMirroring: mode } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildEnterVectorEditModeResult(
  s: Pick<
    EditorState,
    | "nodes"
    | "childOrder"
    | "selectedIds"
    | "editingTextId"
    | "penDrawingNodeId"
    | "pencilDrawingNodeId"
  >,
  nodeId?: string,
): StructuralDocumentResult | null {
  const id = nodeId ?? s.selectedIds[0];
  if (!id) return null;
  const current = s.nodes[id];
  if (!current || !isVectorEditableShape(current)) return null;
  if (s.editingTextId || s.penDrawingNodeId || s.pencilDrawingNodeId) return null;

  let converted: EditorNode = current;
  if (needsVectorPathConversion(current)) {
    const c = convertNodeToPath(current);
    if (!c) return null;
    converted = ensureRoundedRectPathPoints(c);
  }

  const nodes =
    converted !== current ? { ...s.nodes, [id]: converted } : s.nodes;
  return {
    nodes,
    childOrder: s.childOrder,
    ui: {
      pathEditModeNodeId: id,
      shapeEditModeNodeId: null,
      selectedIds: [id],
      selectedPathPointIds: [] as string[],
      objectEditModeNodeId: null,
    },
  };
}

function buildGroupSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length < 2) return null;
  const parentId = s.nodes[tops[0]!]!.parentId;
  if (!tops.every((id) => s.nodes[id]!.parentId === parentId)) return null;

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
  const nodesOut = relayoutParentsWithAutoLayout(nodes, childOrder, [P]);
  return {
    nodes: nodesOut,
    childOrder,
    ui: {
      selectedIds: [gid],
      tool: "move" as Tool,
      editingTextId: null,
    },
  };
}

function buildUngroupSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  if (s.selectedIds.length !== 1) return null;
  const gid = s.selectedIds[0]!;
  const g = s.nodes[gid];
  if (!isUngroupableContainer(g)) return null;
  const kids = [...(s.childOrder[gid] ?? [])];
  if (kids.length === 0) return null;

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
  const nodesOut = relayoutParentsWithAutoLayout(nodes, childOrder, [P]);
  return {
    nodes: nodesOut,
    childOrder,
    ui: {
      selectedIds: kids,
      tool: "move" as Tool,
      editingTextId: null,
      objectEditModeNodeId: null,
    },
  };
}

function buildAutoLayoutMutationResult(
  result: ApplyAutoLayoutSelectionResult | null,
): StructuralDocumentResult | null {
  if (!result) return null;
  const repaired = repairNodeHierarchy(result.nodes, result.childOrder);
  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    ui: {
      selectedIds: result.selectedIds,
      tool: "move" as Tool,
      editingTextId: null,
    },
  };
}

function buildPatchNodeWithParentRelayoutResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  patch: Partial<Pick<EditorNode, "visible" | "locked">>,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n) return null;
  let nodes = { ...s.nodes, [id]: { ...n, ...patch } };
  const par = nodes[id]!.parentId;
  if (par) {
    nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
  }
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildNudgeSelectionResult(
  s: Pick<EditorState, "editorMode" | "selectedIds" | "nodes" | "childOrder">,
  dx: number,
  dy: number,
): StructuralDocumentResult | null {
  if (s.editorMode !== "design" || (dx === 0 && dy === 0)) return null;
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length === 0) return null;
  let nodes = { ...s.nodes };
  const detachIds = idsToDetachForAutoLayoutDrag(tops, nodes, nodes);
  for (const id of detachIds) {
    const n = nodes[id]!;
    nodes[id] = { ...n, layoutPositioning: "absolute", layoutDirty: true };
  }
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
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildSwapAutoLayoutSiblingsResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  idA: string,
  idB: string,
): StructuralDocumentResult | null {
  const a = s.nodes[idA];
  const b = s.nodes[idB];
  if (!a?.parentId || a.parentId !== b?.parentId) return null;
  const parentId = a.parentId;
  const nextOrder = swapAutoLayoutSiblingOrder(parentId, idA, idB, s.childOrder);
  if (!nextOrder) return null;
  const nodes = relayoutParentsWithAutoLayout(s.nodes, nextOrder, [parentId]);
  return { nodes, childOrder: nextOrder, ui: {} };
}

function buildUpdateLayoutResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  patch: LayoutPatch,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked || (n.type !== "frame" && n.type !== "group")) return null;

  let nodes = ensureManualScreenLayout(s.nodes, s.childOrder, id);
  const current = nodes[id]!;

  const rootIds = rootFrameIds(s.childOrder);
  if (
    patch.layoutMode &&
    patch.layoutMode !== "none" &&
    isUnderBridgeCaptureScreen(nodes, id, s.childOrder)
  ) {
    return null;
  }

  if (
    isManualScreenFrame(current, rootIds) &&
    patch.layoutMode &&
    patch.layoutMode !== "none"
  ) {
    return null;
  }

  if (patch.layoutMode === "none" && (current.layoutMode ?? "none") !== "none") {
    nodes = releaseAutoLayoutContainerToManual(nodes, s.childOrder, id);
    const { layoutMode: _ignored, ...rest } = patch;
    if (Object.keys(rest).length > 0) {
      nodes = applyLayoutPatchWithAutoLayout(nodes, s.childOrder, id, rest) as EditorState["nodes"];
    }
    return { nodes, childOrder: s.childOrder, ui: {} };
  }

  nodes = applyLayoutPatchWithAutoLayout(nodes, s.childOrder, id, patch) as EditorState["nodes"];
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildUpdateLayoutSizingResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  axis: "horizontal" | "vertical",
  mode: LayoutSizingMode,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;
  const patch =
    axis === "horizontal"
      ? { layoutSizingHorizontal: mode }
      : { layoutSizingVertical: mode };
  let nodes = { ...s.nodes, [id]: { ...n, ...patch, layoutDirty: true } };
  const refresh = new Set<string>();
  if (n.parentId && !isUnderBridgeCaptureScreen(s.nodes, n.parentId, s.childOrder)) {
    refresh.add(n.parentId);
  }
  if (
    (n.type === "frame" || n.type === "group") &&
    (n.layoutMode ?? "none") !== "none" &&
    !isUnderBridgeCaptureScreen(s.nodes, id, s.childOrder)
  ) {
    refresh.add(id);
  }
  nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, refresh);
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildUpdateLayoutPositioningResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  positioning: LayoutPositioning,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;
  let nodes = { ...s.nodes, [id]: { ...n, layoutPositioning: positioning, layoutDirty: true } };
  const par = n.parentId;
  if (par && !isUnderBridgeCaptureScreen(s.nodes, par, s.childOrder)) {
    nodes = relayoutParentsWithAutoLayout(nodes, s.childOrder, [par]);
  }
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildUpdateConstraintsResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
  patch: ConstraintsPatch,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;
  return {
    nodes: { ...s.nodes, [id]: { ...n, ...patch } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildApplyAutoLayoutResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  parentId: string,
): StructuralDocumentResult | null {
  const p = s.nodes[parentId];
  if (!p || (p.type !== "frame" && p.type !== "group")) return null;
  const result = applyAutoLayoutToContainer(s.nodes, s.childOrder, parentId);
  if (!result) return null;
  return {
    nodes: result.nodes,
    childOrder: result.childOrder,
    ui: {},
  };
}

function buildSetSelectionStrokeWidthResult(
  s: Pick<EditorState, "editorMode" | "selectedIds" | "nodes" | "childOrder" | "pencilStrokeWidth">,
  width: number,
): StructuralDocumentResult | null {
  if (s.editorMode !== "design") return null;
  const next = clampStrokeWidth(width);
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible && nodeSupportsStrokeWidth(n);
  });
  if (tops.length === 0) return null;
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
  return { nodes, childOrder: s.childOrder, ui: { pencilStrokeWidth: next } };
}

function buildNudgeSelectionStrokeWidthResult(
  s: Pick<EditorState, "editorMode" | "selectedIds" | "nodes" | "childOrder" | "pencilStrokeWidth">,
  delta: number,
): StructuralDocumentResult | null {
  if (s.editorMode !== "design" || delta === 0) return null;
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible && nodeSupportsStrokeWidth(n);
  });
  if (tops.length === 0) return null;
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
  return { nodes, childOrder: s.childOrder, ui: { pencilStrokeWidth: preset } };
}

function buildUseSelectionAsMaskResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  const tops = getBooleanEligibleSelection(s.selectedIds, s.nodes);
  if (tops.length < 2) return null;
  const parentId = s.nodes[tops[0]!]!.parentId;
  if (!tops.every((id) => s.nodes[id]!.parentId === parentId)) return null;

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
    figMaskType: "OUTLINE",
    maskVisible: false,
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
    ui: {
      selectedIds: firstContent ? [firstContent] : [gid],
      tool: "move" as Tool,
    },
  };
}

function buildReleaseMaskResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  maskGroupId: string,
): StructuralDocumentResult | null {
  const g = s.nodes[maskGroupId];
  if (!g || !isMaskGroup(g) || g.locked) return null;
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
  return {
    nodes,
    childOrder,
    ui: { selectedIds: kids, tool: "move" as Tool },
  };
}

function buildSetNodeAsMaskResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
  isMask: boolean,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  return {
    nodes: {
      ...s.nodes,
      [nodeId]: {
        ...n,
        isMask,
        name: isMask ? "Mask" : n.name,
      },
    },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildFinishPrototypeConnectionResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "prototypeWireDrag">,
  targetFrameId: string,
): StructuralDocumentResult | null {
  const w = s.prototypeWireDrag;
  if (!w) return null;
  const src = s.nodes[w.sourceNodeId];
  const tgt = s.nodes[targetFrameId];
  if (!src || !tgt || tgt.type !== "frame") return null;
  if (isAncestorOf(s.nodes, w.sourceNodeId, targetFrameId)) return null;
  const link = defaultPrototypeLink(w.sourceNodeId, targetFrameId);
  const prevLinks = src.prototypeLinks ?? [];
  return {
    nodes: {
      ...s.nodes,
      [w.sourceNodeId]: { ...src, prototypeLinks: [...prevLinks, link] },
    },
    childOrder: s.childOrder,
    ui: {
      prototypeWireDrag: null,
      selectedPrototypeLinkId: link.id,
      selectedIds: [w.sourceNodeId],
    },
  };
}

function buildUpdatePrototypeLinkResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  linkId: string,
  patch: Partial<PrototypeLink>,
): StructuralDocumentResult | null {
  const own = findPrototypeLinkOwner(s.nodes, linkId);
  if (!own) return null;
  const node = s.nodes[own.ownerId]!;
  const arr = [...(node.prototypeLinks ?? [])];
  const cur = arr[own.index]!;
  const next: PrototypeLink = { ...cur, ...patch, id: cur.id, sourceNodeId: cur.sourceNodeId };
  arr[own.index] = next;
  return {
    nodes: { ...s.nodes, [own.ownerId]: { ...node, prototypeLinks: arr } },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildDeletePrototypeLinkResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedPrototypeLinkId">,
  linkId: string,
): StructuralDocumentResult | null {
  const own = findPrototypeLinkOwner(s.nodes, linkId);
  if (!own) return null;
  const node = s.nodes[own.ownerId]!;
  const arr = (node.prototypeLinks ?? []).filter((l) => l.id !== linkId);
  const nextNode: EditorNode = { ...node, prototypeLinks: arr.length ? arr : undefined };
  return {
    nodes: { ...s.nodes, [own.ownerId]: nextNode },
    childOrder: s.childOrder,
    ui: {
      selectedPrototypeLinkId: s.selectedPrototypeLinkId === linkId ? null : s.selectedPrototypeLinkId,
    },
  };
}

function buildCreateComponentFromSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  if (!canCreateComponentFromSelection(s.selectedIds, s.nodes)) return null;

  let nodes = { ...s.nodes };
  let childOrder = { ...s.childOrder };
  let tops = topLevelSelectedIds(s.selectedIds, nodes).filter((id) => {
    const n = nodes[id];
    return n && !n.locked && n.visible;
  });

  if (tops.length >= 2) {
    const grouped = groupNodesForComponent(nodes, childOrder, tops);
    if (!grouped) return null;
    nodes = grouped.nodes;
    childOrder = grouped.childOrder;
    tops = [grouped.groupId];
  }

  let rootId = tops[0]!;
  const wrapped = wrapNodeInFrameForComponent(nodes, childOrder, rootId);
  if (!wrapped) return null;
  nodes = wrapped.nodes;
  childOrder = wrapped.childOrder;
  rootId = wrapped.frameId;

  const root = nodes[rootId];
  if (!root || root.isComponent) return null;

  nodes = markNodeAsComponent(nodes, childOrder, rootId);
  const parentId = nodes[rootId]!.parentId;
  if (parentId) {
    nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [parentId]);
  }

  return {
    nodes,
    childOrder,
    ui: {
      selectedIds: [rootId],
      tool: "move" as Tool,
      leftTab: "components" as LeftTab,
    },
  };
}

function buildCreateInstanceResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "activeSlotEdit">,
  componentKey: string,
  worldX: number,
  worldY: number,
): StructuralDocumentResult | null {
  const masterId = resolveMasterRootId(s.nodes, componentKey);
  if (!masterId) return null;
  const master = s.nodes[masterId];
  if (!master?.isComponent || !master.componentId) return null;
  const slotParent = resolveInstanceDropParentId(
    s.nodes,
    s.childOrder,
    s.activeSlotEdit,
    worldX,
    worldY,
    (x, y) => pickDeepestVisibleNodeAtWorldPoint(x, y, s.nodes, s.childOrder) ?? "",
  );
    const pid =
    slotParent ??
    instancePlacementParentAtWorldPoint(worldX, worldY, s.nodes, s.childOrder);
  const pos = centeredLocalPointInParent(
    worldX,
    worldY,
    pid,
    s.nodes,
    master.width,
    master.height,
    s.childOrder,
  );
  const res = buildInstanceFromMaster(
    s.nodes,
    s.childOrder,
    masterId,
    pid,
    pos.x,
    pos.y,
    master.variantProperties,
  );
  if (!res) return null;
  let { nodes, childOrder, newRootId } = res;
  const resolved = resolveComponentInstance(nodes, childOrder, newRootId, { force: true });
  nodes = resolved.nodes;
  childOrder = resolved.childOrder;
  if (pid) nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [pid]);
  const repaired = repairNodeHierarchy(nodes, childOrder);
  return {
    nodes: repaired.nodes,
    childOrder: repaired.childOrder,
    ui: {
      selectedIds: [newRootId],
      tool: "move" as Tool,
      placingComponentMasterId: null,
      editingTextId: null,
    },
  };
}

function buildDetachInstanceResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  instanceRootId: string,
): StructuralDocumentResult | null {
  const root = s.nodes[instanceRootId];
  if (!root?.sourceComponentId || root.locked) return null;
  const resolved = resolveComponentInstance(s.nodes, s.childOrder, instanceRootId, { force: true });
  const next = detachInstanceTree(resolved.nodes, resolved.childOrder, instanceRootId);
  if (!next) return null;
  return {
    nodes: next,
    childOrder: resolved.childOrder,
    ui: { selectedIds: [instanceRootId] },
  };
}

function buildUpdateInstanceOverrideResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  instanceRootId: string,
  targetNodeId: string,
  patch: InstanceOverridePatch,
): StructuralDocumentResult | null {
  const root = s.nodes[instanceRootId];
  if (!root?.sourceComponentId || root.locked) return null;
  const updatedRoot = recordInstanceOverrideForNode(s.nodes, instanceRootId, targetNodeId, patch);
  if (!updatedRoot) return null;
  let nextNodes = { ...s.nodes, [instanceRootId]: updatedRoot };
  const resolved = resolveComponentInstance(nextNodes, s.childOrder, instanceRootId, { force: true });
  return {
    nodes: resolved.nodes,
    childOrder: resolved.childOrder,
    ui: {},
  };
}

function buildCreateVariantFromComponentResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  componentKey: string,
): StructuralDocumentResult | null {
  const masterId = resolveMasterRootId(s.nodes, componentKey);
  if (!masterId) return null;
  const m = s.nodes[masterId];
  if (!m?.isComponent || m.locked) return null;

  const vg = m.variantGroupId ?? newVariantGroupId();
  const siblingCount =
    (m.variantGroupId
      ? Object.values(s.nodes).filter((x) => x.variantGroupId === vg).length
      : 0) + 1;
  const variantPos = nextVariantMasterPosition(s.nodes, vg, m);
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
        next = { ...next, x: variantPos.x, y: variantPos.y };
      }
      return next;
    },
  );
  if (!res) return null;
  let nodes = res.nodes;
  const childOrder = res.childOrder;
  const stableIds = assignStableLayerIds(nodes, childOrder, res.newRootId);
  if (!m.variantGroupId) {
    nodes = { ...nodes, [masterId]: { ...m, variantGroupId: vg } };
  }
  nodes = {
    ...nodes,
    [res.newRootId]: {
      ...nodes[res.newRootId]!,
      componentLayerStableIds: stableIds,
      componentVersion: 1,
    },
  };
  nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(m.parentId)]);
  return {
    nodes,
    childOrder,
    ui: {
      selectedIds: [res.newRootId],
      tool: "move" as Tool,
      editingTextId: null,
    },
  };
}

function buildUpdateVariantPropertiesResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  componentKey: string,
  properties: Record<string, string>,
): StructuralDocumentResult | null {
  const id = resolveMasterRootId(s.nodes, componentKey);
  if (!id) return null;
  const n = s.nodes[id];
  if (!n?.isComponent || n.locked) return null;
  return {
    nodes: {
      ...s.nodes,
      [id]: {
        ...n,
        variantProperties: { ...(n.variantProperties ?? {}), ...properties },
      },
    },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildDuplicateSingleResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  id: string,
  worldOffset: CloneWorldOffset | null,
): StructuralDocumentResult | null {
  const tops = topLevelSelectedIds([id], s.nodes).filter((tid) => {
    const nn = s.nodes[tid];
    return nn && !nn.locked && nn.visible;
  });
  if (tops.length === 0 || !s.nodes[tops[0]!]) return null;
  const cloned = cloneTopLevelSelectionState({ ...s, selectedIds: [id] }, worldOffset);
  if (!cloned) return null;
  return {
    nodes: cloned.nodes,
    childOrder: cloned.childOrder,
    ui: {
      selectedIds: cloned.selectedIds,
      tool: cloned.tool,
      editingTextId: cloned.editingTextId,
      contextMenu: null,
    },
  };
}

function buildDeleteSingleResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  id: string,
): StructuralDocumentResult | null {
  const tops = topLevelSelectedIds([id], s.nodes).filter((tid) => {
    const nn = s.nodes[tid];
    return nn && !nn.locked && nn.visible;
  });
  if (tops.length === 0) return null;
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
  const removedIds = [...toRemove];
  let nodes = { ...s.nodes };
  const childOrder: Record<string, string[]> = {};
  for (const [k, arr] of Object.entries(s.childOrder)) {
    childOrder[k] = arr.filter((tid) => !toRemove.has(tid));
  }
  for (const tid of toRemove) {
    delete nodes[tid];
    delete childOrder[tid];
  }
  const refresh = new Set<string>();
  for (const root of tops) {
    parentsToRelayout.add(parentListKey(s.nodes[root]!.parentId));
  }
  const propagated = applyMasterComponentDocumentChanges(nodes, childOrder, refresh, {
    removedNodeIds: removedIds,
    changedNodeIds: tops.filter((id) => isMasterComponentEdit(s.nodes, id)),
    structural: true,
    reason: "delete",
  });
  nodes = propagated.nodes;
  const nextChildOrder = propagated.childOrder;
  nodes = relayoutParentsWithAutoLayout(nodes, nextChildOrder, parentsToRelayout);
  return {
    nodes,
    childOrder: nextChildOrder,
    ui: {
      selectedIds: [] as string[],
      editingTextId: null,
      contextMenu: null,
      layerRenameId: null,
    },
  };
}

const PLUGIN_RENAME_LABELS: Record<NodeKind, string> = {
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

function buildApplyPluginLoremResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  const textIds = s.selectedIds.filter((id) => {
    const n = s.nodes[id];
    return n?.type === "text" && !n.locked;
  });
  if (textIds.length === 0) return null;
  const lorem =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.";
  const nodes = { ...s.nodes };
  for (const id of textIds) {
    const n = nodes[id];
    if (!n || n.type !== "text" || n.locked) continue;
    nodes[id] = { ...n, content: lorem };
  }
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildApplyPluginRenameResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder">,
): StructuralDocumentResult | null {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked;
  });
  if (tops.length === 0) return null;
  const counts = new Map<NodeKind, number>();
  const nodes = { ...s.nodes };
  for (const id of tops) {
    const n = nodes[id];
    if (!n) continue;
    const c = (counts.get(n.type) ?? 0) + 1;
    counts.set(n.type, c);
    const base = PLUGIN_RENAME_LABELS[n.type] ?? "Layer";
    const name = c > 1 ? `${base} ${c}` : base;
    nodes[id] = { ...n, name };
  }
  return { nodes, childOrder: s.childOrder, ui: {} };
}

function buildApplyPluginIconResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
): StructuralDocumentResult | null {
  const frameId = resolveFrameParentForPlugin(s);
  if (!frameId) return null;
  const frame = s.nodes[frameId];
  if (!frame || frame.locked) return null;
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
    strokeColor: defaultCanvasForegroundColor(),
    strokeWidth: 1.5,
    strokePosition: "center",
  };
  pathNode = normalizePathNode(pathNode);
  const nodes: Record<string, EditorNode> = { ...s.nodes };
  nodes[pathId] = pathNode;
  nodes[gid] = {
    id: gid,
    parentId: frameId,
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
  const order = [...(childOrder[frameId] ?? [])];
  order.push(gid);
  childOrder[frameId] = order;
  const nodesOut = relayoutParentsWithAutoLayout(nodes, childOrder, [frameId]);
  return {
    nodes: nodesOut,
    childOrder,
    ui: {
      selectedIds: [gid],
      tool: "move" as Tool,
      editingTextId: null,
    },
  };
}

function buildImportImageAssetResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "assets">,
  asset: EditorAsset,
): StructuralDocumentResult {
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    assets: { ...s.assets, [asset.id]: asset },
    ui: {},
  };
}

function buildReplaceImageAssetResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "assets">,
  nodeId: string,
  asset: EditorAsset,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.type !== "image") return null;
  const baseName = (asset.name || "Image").replace(/\.[^.]+$/, "") || "Image";
  return {
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
    childOrder: s.childOrder,
    assets: { ...s.assets, [asset.id]: asset },
    ui: {},
  };
}

function buildDeleteAssetResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "assets">,
  assetId: string,
): StructuralDocumentResult | null {
  if (!s.assets[assetId]) return null;
  const { [assetId]: _removed, ...rest } = s.assets;
  const nodes = { ...s.nodes };
  for (const nid of Object.keys(nodes)) {
    const n = nodes[nid];
    if (n?.type === "image" && n.assetId === assetId) {
      nodes[nid] = { ...n, assetId: undefined };
    }
  }
  return { nodes, childOrder: s.childOrder, assets: rest, ui: {} };
}

function buildReplaceAssetResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "assets">,
  assetId: string,
  asset: EditorAsset,
): StructuralDocumentResult | null {
  const existing = s.assets[assetId];
  if (!existing) return null;
  const nextAsset: EditorAsset = {
    ...asset,
    id: assetId,
    createdAt: existing.createdAt,
  };
  const baseName = (nextAsset.name || "Image").replace(/\.[^.]+$/, "") || "Image";
  const nodes = { ...s.nodes };
  for (const nid of Object.keys(nodes)) {
    const n = nodes[nid];
    if (n?.type === "image" && n.assetId === assetId) {
      nodes[nid] = {
        ...n,
        imageSrc: nextAsset.dataUrl,
        imageName: nextAsset.name,
        imageMimeType: nextAsset.mimeType,
        name: baseName,
      };
    }
  }
  return {
    nodes,
    childOrder: s.childOrder,
    assets: { ...s.assets, [assetId]: nextAsset },
    ui: {},
  };
}

function pickColorTokenSourceNode(
  s: Pick<EditorState, "selectedIds" | "nodes" | "designTokens">,
): EditorNode | null {
  const colorTypes = new Set<NodeKind>(["frame", "rectangle", "ellipse", "path", "text"]);
  for (const id of s.selectedIds) {
    const raw = s.nodes[id];
    if (!raw || raw.locked || !raw.visible) continue;
    if (!colorTypes.has(raw.type)) continue;
    const merged = mergeInstanceOverrides(raw, s.nodes);
    const n = resolveNodeWithDesignTokens(merged, s.designTokens);
    if (effectiveFillType(n) === "gradient") continue;
    const h = n.type === "text" ? (n.textColor ?? n.fill) : n.fill;
    if (!h) continue;
    return n;
  }
  return null;
}

function buildCreateColorTokenFromSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder" | "designTokens">,
  name?: string,
): StructuralDocumentResult | null {
  const picked = pickColorTokenSourceNode(s);
  if (!picked) return null;
  const hex = picked.type === "text" ? (picked.textColor ?? picked.fill) : picked.fill;
  if (!hex) return null;
  const colorCount = Object.values(s.designTokens).filter((t) => t.type === "color").length;
  const tid = newDesignTokenId("color");
  const nm =
    name?.trim() ||
    `Color / ${picked.name || "Selection"}${colorCount > 0 ? ` ${colorCount + 1}` : ""}`;
  const token: DesignToken = {
    id: tid,
    name: nm.slice(0, 64),
    type: "color",
    value: { hex, opacity: picked.fillOpacity ?? 1 },
    createdAt: designTokenTimestamp(),
    updatedAt: designTokenTimestamp(),
  };
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: { ...s.designTokens, [tid]: token },
    ui: {},
  };
}

function buildCreateGradientTokenFromSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder" | "designTokens">,
  name?: string,
): StructuralDocumentResult | null {
  const shapeTypes = new Set<NodeKind>(["frame", "rectangle", "ellipse", "path"]);
  let picked: EditorNode | null = null;
  for (const id of s.selectedIds) {
    const raw = s.nodes[id];
    if (!raw || raw.locked || !raw.visible) continue;
    if (!shapeTypes.has(raw.type)) continue;
    const merged = mergeInstanceOverrides(raw, s.nodes);
    const n = resolveNodeWithDesignTokens(merged, s.designTokens);
    if (effectiveFillType(n) !== "gradient") continue;
    picked = n;
    break;
  }
  if (!picked) return null;
  const gradient = normalizeFillGradient(picked.fillGradient, picked.fill);
  const gradCount = Object.values(s.designTokens).filter((t) => t.type === "gradient").length;
  const tid = newDesignTokenId("grad");
  const nm =
    name?.trim() ||
    `Gradient / ${picked.name || "Selection"}${gradCount > 0 ? ` ${gradCount + 1}` : ""}`;
  const token: DesignToken = {
    id: tid,
    name: nm.slice(0, 64),
    type: "gradient",
    value: gradient,
    createdAt: designTokenTimestamp(),
    updatedAt: designTokenTimestamp(),
  };
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: { ...s.designTokens, [tid]: token },
    ui: {},
  };
}

function buildCreateTypographyTokenFromSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder" | "designTokens">,
  name?: string,
): StructuralDocumentResult | null {
  let picked: EditorNode | null = null;
  for (const id of s.selectedIds) {
    const raw = s.nodes[id];
    if (!raw || raw.locked || !raw.visible || raw.type !== "text") continue;
    const merged = mergeInstanceOverrides(raw, s.nodes);
    picked = resolveNodeWithDesignTokens(merged, s.designTokens);
    break;
  }
  if (!picked) return null;
  const typoCount = Object.values(s.designTokens).filter((t) => t.type === "typography").length;
  const tid = newDesignTokenId("type");
  const nm =
    name?.trim() ||
    `Typography / ${picked.name || "Text"}${typoCount > 0 ? ` ${typoCount + 1}` : ""}`;
  const token: DesignToken = {
    id: tid,
    name: nm.slice(0, 64),
    type: "typography",
    value: {
      fontFamily: picked.fontFamily ?? "Inter, system-ui, sans-serif",
      fontSize: picked.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
      fontWeight: picked.fontWeight ?? 500,
      lineHeight: picked.lineHeight ?? effectiveLineHeightMultiplier(picked),
      letterSpacing: letterSpacingPercentFromNode(picked),
    },
    createdAt: designTokenTimestamp(),
    updatedAt: designTokenTimestamp(),
  };
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: { ...s.designTokens, [tid]: token },
    ui: {},
  };
}

function buildCreateSpacingTokenResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "designTokens">,
  name: string,
  value: number,
): StructuralDocumentResult | null {
  if (!Number.isFinite(value)) return null;
  const tid = newDesignTokenId("space");
  const token: DesignToken = {
    id: tid,
    name: name.trim() || "Spacing",
    type: "spacing",
    value: { value },
    createdAt: designTokenTimestamp(),
    updatedAt: designTokenTimestamp(),
  };
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: { ...s.designTokens, [tid]: token },
    ui: {},
  };
}

function buildCreateColorTokenResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "designTokens">,
  name: string,
  hex: string,
  opacity = 1,
): StructuralDocumentResult | null {
  const h = normalizeHex(hex.trim().startsWith("#") ? hex.trim() : `#${hex.trim()}`);
  if (!h) return null;
  const token = createColorDesignToken(
    name,
    { hex: h, opacity: Math.min(1, Math.max(0, opacity)) },
    s.designTokens,
  );
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: { ...s.designTokens, [token.id]: token },
    ui: { _createdColorTokenId: token.id },
  };
}

function buildSeedDesignSystemColorPaletteResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "designTokens">,
): StructuralDocumentResult {
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: buildPaletteTokens(DEFAULT_COLOR_PALETTE, s.designTokens),
    ui: {},
  };
}

function buildUpdateDesignTokenResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "designTokens">,
  id: string,
  patch: Partial<Omit<DesignToken, "id" | "createdAt">>,
): StructuralDocumentResult | null {
  const t = s.designTokens[id];
  if (!t) return null;
  const next: DesignToken = {
    ...t,
    ...patch,
    id: t.id,
    createdAt: t.createdAt,
    type: patch.type ?? t.type,
    value: patch.value !== undefined ? (patch.value as DesignToken["value"]) : t.value,
    updatedAt: designTokenTimestamp(),
  };
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: { ...s.designTokens, [id]: next },
    ui: {},
  };
}

function buildDeleteDesignTokenResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "designTokens">,
  id: string,
): StructuralDocumentResult | null {
  if (!s.designTokens[id]) return null;
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
  return {
    nodes,
    childOrder: s.childOrder,
    designTokens: rest,
    ui: {},
  };
}

function buildCreateEffectTokenFromSelectionResult(
  s: Pick<EditorState, "selectedIds" | "nodes" | "childOrder" | "designTokens">,
  name?: string,
): StructuralDocumentResult | null {
  let pickedId: string | null = null;
  for (const id of s.selectedIds) {
    const raw = s.nodes[id];
    if (!raw || raw.locked || !raw.visible) continue;
    pickedId = id;
    break;
  }
  if (!pickedId) return null;
  const merged = mergeInstanceOverrides(s.nodes[pickedId]!, s.nodes);
  const resolved = resolveNodeWithDesignTokens(merged, s.designTokens);
  const effList = resolved.effects?.length
    ? resolved.effects.map((e) => ({ ...e, id: newNodeEffectId() }))
    : undefined;
  const value: EffectTokenValue =
    effList && effList.length > 0
      ? { effects: effList }
      : { shadow: "0 4px 12px rgba(15, 23, 42, 0.2)", blur: 0 };
  const n = s.nodes[pickedId]!;
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
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    designTokens: { ...s.designTokens, [tid]: token },
    ui: {},
  };
}

function buildCommitLayoutGuideResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "layoutGuides" | "layoutGuideDraft">,
): StructuralDocumentResult | null {
  if (!s.layoutGuideDraft) return null;
  const guide: LayoutGuide = {
    id: `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    axis: s.layoutGuideDraft.axis,
    pos: s.layoutGuideDraft.pos,
  };
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      layoutGuides: [...s.layoutGuides, guide],
      layoutGuideDraft: null,
    },
  };
}

function buildRemoveLayoutGuideResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "layoutGuides" | "selectedLayoutGuideId">,
  id: string,
): StructuralDocumentResult {
  const layoutGuides = s.layoutGuides.filter((g) => g.id !== id);
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      layoutGuides,
      selectedLayoutGuideId: s.selectedLayoutGuideId === id ? null : s.selectedLayoutGuideId,
    },
  };
}

function buildUpdateLayoutGuidePositionResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "layoutGuides">,
  id: string,
  pos: number,
): StructuralDocumentResult {
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      layoutGuides: s.layoutGuides.map((g) => (g.id === id ? { ...g, pos } : g)),
    },
  };
}

function buildImportFontAssetResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "fontAssets">,
  asset: EditorFontAsset,
): StructuralDocumentResult {
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    fontAssets: { ...s.fontAssets, [asset.id]: asset },
    ui: {},
  };
}

function buildSetCanvasBackgroundColorResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "canvasBackgroundColor" | "selectedIds">,
  hex: string,
): StructuralDocumentResult | null {
  const normalized = normalizeHex(hex.startsWith("#") ? hex : `#${hex}`);
  if (!normalized || s.canvasBackgroundColor === normalized) return null;
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: { canvasBackgroundColor: normalized },
  };
}

function buildToggleGridResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "showGrid">,
): StructuralDocumentResult {
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: { showGrid: !s.showGrid },
  };
}

function buildToggleRulersResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "showRulers">,
): StructuralDocumentResult {
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: { showRulers: !s.showRulers },
  };
}

function buildSetDocumentNameResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "fileName">,
  name: string,
): StructuralDocumentResult | null {
  const next = name.trim() ? name.trim() : "Untitled";
  if (next === s.fileName) return null;
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: { fileName: next },
  };
}

function buildDeleteEmptyTextOnEditEndResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  textId: string,
): StructuralDocumentResult | null {
  if (!s.nodes[textId]) {
    return {
      nodes: s.nodes,
      childOrder: s.childOrder,
      ui: { editingTextId: null, textEditSelection: null },
    };
  }
  const parentRef = s.nodes[textId]?.parentId;
  const { nodes, childOrder } = removeNodeAndDescendants(s, textId);
  const nodes2 = relayoutParentsWithAutoLayout(nodes, childOrder, [parentListKey(parentRef)]);
  return {
    nodes: nodes2,
    childOrder,
    ui: {
      editingTextId: null,
      textEditSelection: null,
      selectedIds: s.selectedIds.filter((id) => id !== textId),
    },
  };
}

function buildTogglePathClosedResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  nodeId: string,
): StructuralDocumentResult | null {
  const n = s.nodes[nodeId];
  if (!n || n.type !== "path") return null;
  let next: EditorNode = { ...n, pathClosed: !n.pathClosed };
  next = normalizePathNode(next);
  return {
    nodes: { ...s.nodes, [nodeId]: next },
    childOrder: s.childOrder,
    ui: {},
  };
}

function buildAddCommentResult(
  s: Pick<
    EditorState,
    "nodes" | "childOrder" | "comments" | "editorMode" | "isPlacingComment" | "tool"
  >,
  point: { x: number; y: number },
  parentNodeIdOverride?: string,
): StructuralDocumentResult | null {
  if (s.editorMode !== "design" || !s.isPlacingComment || s.tool !== "comment") return null;
  const hit =
    parentNodeIdOverride ??
    pickDeepestVisibleNodeAtWorldPoint(point.x, point.y, s.nodes, s.childOrder) ??
    undefined;
  const frameHit =
    pickDeepestFrameAtWorldPoint(point.x, point.y, s.nodes, s.childOrder) ?? undefined;
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
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      comments: [...s.comments, next],
      activeCommentId: id,
      isPlacingComment: false,
      _newCommentId: id,
    },
  };
}

function buildUpdateCommentResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "comments">,
  id: string,
  body: string,
): StructuralDocumentResult | null {
  const prev = s.comments.find((c) => c.id === id);
  if (!prev || prev.body === body) return null;
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      comments: s.comments.map((c) => (c.id === id ? { ...c, body } : c)),
    },
  };
}

function buildAddCommentReplyResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "comments">,
  commentId: string,
  body: string,
): StructuralDocumentResult | null {
  if (!isNonEmptyCommentBody(body)) return null;
  const reply: EditorCommentReply = {
    id: newReplyId(),
    author: defaultCommentAuthor("reply"),
    body: body.trim(),
    createdAt: new Date().toISOString(),
  };
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      comments: s.comments.map((c) =>
        c.id === commentId ? { ...c, replies: [...c.replies, reply] } : c,
      ),
    },
  };
}

function buildResolveCommentResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "comments">,
  id: string,
  resolved: boolean,
): StructuralDocumentResult | null {
  if (!s.comments.some((c) => c.id === id)) return null;
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      comments: s.comments.map((c) => (c.id === id ? { ...c, resolved } : c)),
    },
  };
}

function buildDeleteCommentResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "comments" | "activeCommentId">,
  id: string,
  opts?: { pendingBody?: string },
): StructuralDocumentResult | null {
  if (!s.comments.some((c) => c.id === id)) return null;
  let comments = s.comments;
  if (opts?.pendingBody !== undefined) {
    const pb = opts.pendingBody.trim();
    if (isNonEmptyCommentBody(pb)) {
      comments = comments.map((c) => (c.id === id ? { ...c, body: pb } : c));
    }
  }
  return {
    nodes: s.nodes,
    childOrder: s.childOrder,
    ui: {
      comments: comments.filter((c) => c.id !== id),
      activeCommentId: s.activeCommentId === id ? null : s.activeCommentId,
    },
  };
}

function buildAddTextToolbarResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "canvasBackgroundColor" | "selectedIds">,
): StructuralDocumentResult {
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
    ui: { selectedIds: [id] },
  };
}

function buildAddImageNodeResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds" | "assets">,
  assetId: string,
  worldX?: number,
  worldY?: number,
): StructuralDocumentResult | null {
  const asset = s.assets[assetId];
  if (!asset) return null;
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
    ui: { selectedIds: [id], tool: "move" as Tool },
  };
}

function buildUpdateNodeStyleResult(
  s: EditorState,
  id: string,
  patch: NodeStylePatch,
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;

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
    "strokeImageAssetId",
    "strokeVideoAssetId",
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
  let mergedPatch = touchesStroke
    ? { ...patch, ...mergeStrokeIntoNode(layoutBase, patch) }
    : patch;
  if ("fillGradient" in mergedPatch) {
    mergedPatch = { ...mergedPatch, fillTokenId: undefined };
  }
  let finalPatch: Partial<EditorNode> =
    n.type === "text" ? withTextLayoutPatch(layoutBase, mergedPatch) : mergedPatch;
  if (n.type === "text") {
    finalPatch = mergeTextLayoutPatchWithAspectLock(
      layoutBase,
      mergedPatch,
      finalPatch,
      s.inspectorAspectRatioLocked,
    );
  }
  if (n.type === "text" && "content" in mergedPatch) {
    finalPatch = {
      ...finalPatch,
      name: layerNameFromTextContent(
        (mergedPatch as { content?: string }).content ?? n.content,
      ),
    };
  }

  const rotateInteraction = isRotateGeometryLockActive(s);
  if (rotateInteraction) {
    const stripped: Partial<EditorNode> = { ...finalPatch };
    delete stripped.x;
    delete stripped.y;
    delete stripped.width;
    delete stripped.height;
    delete stripped.rotation;
    finalPatch = stripped;
  }

  let nodes: Record<string, EditorNode>;
  if (instRoot && instRoot !== id) {
    const updatedRoot = recordInstanceOverrideForNode(
      s.nodes,
      instRoot,
      id,
      finalPatch as InstanceOverridePatch,
    );
    if (updatedRoot) {
      nodes = { ...s.nodes, [instRoot]: updatedRoot };
      if ("fillGradient" in finalPatch) {
        nodes[id] = { ...n, fillTokenId: undefined };
      }
    } else {
      nodes = { ...s.nodes };
    }
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

  if (rotateInteraction) {
    const snap = rotateGeomSnapshotForNode(s, id);
    if (snap) {
      const cur = nodes[id];
      if (cur) {
        nodes[id] = applyRotateGeometryLock(
          cur,
          snap,
          s.rotateGeomSnapshot?.nodeId === id,
        );
      }
    } else {
      const cur = nodes[id];
      if (cur) {
        nodes[id] = {
          ...cur,
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
        };
      }
    }
  }

  const fp = finalPatch as Partial<EditorNode>;
  if (n.type === "path" && fp.pathClosed === true && !n.pathClosed) {
    const cur = nodes[id];
    if (cur?.type === "path") nodes[id] = normalizePathNode(cur);
  }

  let childOrder = s.childOrder;
  const styleRefresh = new Set<string>();
  if (
    n.parentId &&
    (fp.width != null || fp.height != null) &&
    (n.type === "text" ? patchAffectsTextLayout(patch) : true)
  ) {
    styleRefresh.add(n.parentId);
  }
  if (!instRoot && isMasterComponentEdit(nodes, id)) {
    const styleKeys = Object.keys(finalPatch) as (keyof EditorNode)[];
    const propagated = applyComponentPropagationToStoreResult(
      nodes,
      childOrder,
      styleRefresh,
      id,
      styleKeys,
    );
    nodes = propagated.nodes;
    childOrder = propagated.childOrder;
  }
  if (styleRefresh.size > 0) {
    nodes = relayoutParentsWithAutoLayout(nodes, childOrder, styleRefresh);
  }
  if (n.type === "text" && patchAffectsTextLayout(patch)) {
    clearCanonicalTextLayoutCache(id);
    bumpTextLayoutEpoch();
  }
  return { nodes, childOrder, ui: {} };
}

/** Keep inspector/canvas aspect-locked W/H on non-text layers. Text uses resize modes instead. */
function mergeTextLayoutPatchWithAspectLock(
  node: EditorNode,
  input: Partial<EditorNode>,
  layoutPatch: Partial<EditorNode>,
  aspectLocked: boolean,
): Partial<EditorNode> {
  if (node.type === "text") return layoutPatch;
  if (!aspectLocked) return layoutPatch;
  if (input.width != null && input.height != null) {
    return { ...layoutPatch, width: input.width, height: input.height };
  }
  if (input.width != null) {
    return {
      ...layoutPatch,
      ...applyAspectLockedDimensions(
        { width: node.width, height: node.height },
        "width",
        input.width,
        true,
      ),
    };
  }
  if (input.height != null) {
    return {
      ...layoutPatch,
      ...applyAspectLockedDimensions(
        { width: node.width, height: node.height },
        "height",
        input.height,
        true,
      ),
    };
  }
  return layoutPatch;
}

function buildUpdateNodeResult(
  s: EditorState,
  id: string,
  patch: Partial<EditorNode>,
  opts?: { allowZeroGeometry?: boolean },
): StructuralDocumentResult | null {
  const n = s.nodes[id];
  if (!n || n.locked) return null;
  const allowZeroGeometry = opts?.allowZeroGeometry === true;
  const geomMin = allowZeroGeometry ? 0 : 1;
  const rotationOnlyInput =
    patch.rotation != null &&
    Object.keys(patch).every((k) => k === "rotation" || k === "x" || k === "y");
  const rotateGeomLock = isRotateGeometryLockActive(s);
  const patchForApply =
    s.transformInteractionMode === "rotate" || rotateGeomLock || rotationOnlyInput
      ? {
          ...(patch.rotation != null ? { rotation: patch.rotation } : {}),
          ...(patch.x != null ? { x: patch.x } : {}),
          ...(patch.y != null ? { y: patch.y } : {}),
        }
      : patch;
  const instRoot = findInstanceRoot(s.nodes, id);
  let nodes = { ...s.nodes };
  const stylePart: Partial<EditorNode> = {};
  const directPart: Partial<EditorNode> = {};

  const layoutBase =
    n.type === "text" && instRoot && instRoot !== id
      ? mergeInstanceOverrides(n, s.nodes)
      : n;
  let layoutAwarePatch =
    n.type === "text" ? withTextLayoutPatch(layoutBase, patchForApply) : patchForApply;
  if (n.type === "text") {
    layoutAwarePatch = mergeTextLayoutPatchWithAspectLock(
      layoutBase,
      patchForApply,
      layoutAwarePatch,
      s.inspectorAspectRatioLocked,
    );
  }

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
      const updatedRoot = recordInstanceOverrideForNode(
        nodes,
        instRoot,
        id,
        stylePart as InstanceOverridePatch,
      );
      if (updatedRoot) nodes[instRoot] = updatedRoot;
    }
  } else {
    Object.assign(directPart, layoutAwarePatch);
  }

  if (Object.keys(directPart).length > 0) {
    nodes[id] = { ...n, ...directPart };
  }

  let merged = nodes[id]!;
  const rotateSnap = rotateGeomSnapshotForNode(s, id);
  if (rotateSnap) {
    merged = applyRotateGeometryLock(
      merged,
      rotateSnap,
      s.rotateGeomSnapshot?.nodeId === id,
    );
    nodes[id] = merged;
  } else {
    merged = sanitizeNodeGeometry(merged, n, { minDimension: geomMin });
    nodes[id] = merged;
  }
  if (
    s.transformInteractionMode !== "rotate" &&
    (merged.type === "line" || merged.type === "arrow")
  ) {
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
      nodes[id] = {
        ...merged,
        ...linePatchFromEndpoints(ep.x1, ep.y1, ep.x2, ep.y2, merged, allowZeroGeometry ? 0 : undefined),
      };
    } else if (boxTouched) {
      nodes[id] = { ...merged, ...lineEndpointsPatchFromBoxResize(n, merged) };
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
  if (isStarNode(merged)) {
    const touchesBox =
      layoutAwarePatch.width != null ||
      layoutAwarePatch.height != null ||
      layoutAwarePatch.x != null ||
      layoutAwarePatch.y != null;
    if (touchesBox) {
      nodes[id] = {
        ...merged,
        ...starGeometryPatch(merged, {
          starPoints: merged.starPoints,
          starInnerRadius: merged.starInnerRadius,
          cornerRadius: merged.cornerRadius,
        }),
      };
      merged = nodes[id]!;
    }
  }
  if (
    merged.type === "path" &&
    (layoutAwarePatch.width != null ||
      layoutAwarePatch.height != null ||
      layoutAwarePatch.x != null ||
      layoutAwarePatch.y != null)
  ) {
    const pathPatch = syncEditablePathAfterBoxChange(n, merged);
    if (pathPatch.pathPoints) {
      nodes[id] = { ...merged, ...pathPatch };
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
    if (
      merged.parentId &&
      !isUnderBridgeCaptureScreen(s.nodes, merged.parentId, s.childOrder)
    ) {
      refresh.add(merged.parentId);
    }
    if (
      (merged.type === "frame" || merged.type === "group") &&
      (merged.layoutMode ?? "none") !== "none" &&
      !isUnderBridgeCaptureScreen(s.nodes, id, s.childOrder)
    ) {
      refresh.add(id);
    }
  }
  if (
    n.type === "text" &&
    patchAffectsTextLayout(patch) &&
    (layoutAwarePatch.width != null || layoutAwarePatch.height != null) &&
    n.parentId &&
    !isUnderBridgeCaptureScreen(s.nodes, n.parentId, s.childOrder)
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
  let childOrder = s.childOrder;
  if (!rotationOnly && isMasterComponentEdit(nodes, id)) {
    const propagated = applyComponentPropagationToStoreResult(
      nodes,
      childOrder,
      refresh,
      id,
      keys as (keyof EditorNode)[],
    );
    nodes = propagated.nodes;
    childOrder = propagated.childOrder;
  }
  if (!rotationOnly) {
    nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);
  }
  const finalNode = nodes[id];
  if (finalNode) {
    const snap = rotateGeomSnapshotForNode(s, id);
    if (snap) {
      nodes[id] = applyRotateGeometryLock(
        finalNode,
        snap,
        s.rotateGeomSnapshot?.nodeId === id,
      );
    } else {
      nodes[id] = sanitizeNodeGeometry(finalNode, n, { minDimension: geomMin });
    }
  }
  if (geom && !allowZeroGeometry) {
    warnInvalidNodeGeometry("updateNode", id, nodes[id] ?? merged, nodes);
  }
  if (n.type === "text" && patchAffectsTextLayout(patchForApply)) {
    clearCanonicalTextLayoutCache(id);
    bumpTextLayoutEpoch();
  }
  return { nodes, childOrder, ui: {} };
}

function buildUpdateNodesResult(
  s: EditorState,
  patches: Record<string, Partial<EditorNode>>,
): StructuralDocumentResult | null {
  const ids = Object.keys(patches);
  if (ids.length === 0) return null;
  let nodes = { ...s.nodes };
  let childOrder = s.childOrder;
  const refresh = new Set<string>();
  let changed = false;
  let rotationOnlyBatch = true;
  let textLayoutEpochBump = false;
  for (const id of ids) {
    const n = nodes[id];
    const patch = patches[id];
    if (!n || !patch || n.locked) continue;
    const rotationOnlyInput =
      patch.rotation != null &&
      Object.keys(patch).every((k) => k === "rotation" || k === "x" || k === "y");
    const rotateGeomLock = isRotateGeometryLockActive(s);
    const patchForApply =
      s.transformInteractionMode === "rotate" || rotateGeomLock || rotationOnlyInput
        ? {
            ...(patch.rotation != null ? { rotation: patch.rotation } : {}),
            ...(patch.x != null ? { x: patch.x } : {}),
            ...(patch.y != null ? { y: patch.y } : {}),
          }
        : patch;
    let layoutAwarePatch = n.type === "text" ? withTextLayoutPatch(n, patchForApply) : patchForApply;
    if (n.type === "text") {
      layoutAwarePatch = mergeTextLayoutPatchWithAspectLock(
        n,
        patchForApply,
        layoutAwarePatch,
        s.inspectorAspectRatioLocked,
      );
    }
    let merged = { ...n, ...layoutAwarePatch };
    const rotateSnap = rotateGeomSnapshotForNode(s, id);
    if (rotateSnap) {
      merged = applyRotateGeometryLock(
        merged,
        rotateSnap,
        s.rotateGeomSnapshot?.nodeId === id,
      );
    }
    nodes[id] = merged;
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
    if (n.type === "text" && patchAffectsTextLayout(patch)) {
      clearCanonicalTextLayoutCache(id);
      textLayoutEpochBump = true;
    }
  }
  if (!changed) return null;
  if (textLayoutEpochBump) bumpTextLayoutEpoch();

  beginComponentUpdateTransaction("batch-update");
  for (const id of ids) {
    const patch = patches[id];
    if (!patch) continue;
    if (isMasterComponentEdit(nodes, id)) {
      const masterRootId = findMasterRootForNode(nodes, id);
      if (masterRootId) {
        recordMasterMutation(
          masterRootId,
          id,
          nodes[masterRootId]?.componentLayerStableIds?.[id] ?? null,
          Object.keys(patch) as (keyof EditorNode)[],
        );
      }
    }
  }
  if (!rotationOnlyBatch) {
    const propagated = applyComponentPropagationToStoreResult(
      nodes,
      s.childOrder,
      refresh,
      ids[0]!,
      Object.keys(patches[ids[0]!] ?? {}) as (keyof EditorNode)[],
    );
    nodes = propagated.nodes;
    childOrder = propagated.childOrder;
  }

  if (!rotationOnlyBatch) {
    nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);
  }
  if (isRotateGeometryLockActive(s)) {
    for (const id of ids) {
      const merged = nodes[id];
      const snap = rotateGeomSnapshotForNode(s, id);
      if (merged && snap) {
        nodes[id] = applyRotateGeometryLock(
          merged,
          snap,
          s.rotateGeomSnapshot?.nodeId === id,
        );
      }
    }
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
  return { nodes, childOrder, ui: {} };
}

type ResizeNodeOpts = {
  fixedWorld?: { x: number; y: number } | null;
  pointerWorld?: { x: number; y: number };
  startPointerWorld?: { x: number; y: number };
  startPathPoints?: import("@/lib/pathGeometry").PathPoint[];
  startNodesSnapshot?: Record<string, EditorNode>;
};

function buildResizeNodeResult(
  s: EditorState,
  id: string,
  handle: ResizeHandle,
  startBounds: Bounds,
  currentPoint: { x: number; y: number },
  modifiers: ResizeModifiers,
  opts?: ResizeNodeOpts,
): StructuralDocumentResult | null {
  if (isRotateGeometryLockActive(s)) return null;
  const n = s.nodes[id];
  if (!n || n.locked || !n.visible) return null;
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
  const centerProportional =
    modifiers.shiftKey &&
    modifiers.altKey &&
    isCornerHandle(handle) &&
    opts?.pointerWorld &&
    opts?.startPointerWorld &&
    opts?.fixedWorld;
  const localStart: Bounds = {
    x: 0,
    y: 0,
    width: startBounds.width,
    height: startBounds.height,
  };
  const next = centerProportional
    ? centerProportionalScaleFromWorld(
        startBounds,
        opts!.fixedWorld!,
        opts!.startPointerWorld!,
        opts!.pointerWorld!,
      )
    : computeResizedBounds(
        handle,
        localStart,
        clampResizePointerLocal(currentPoint, localStart, true),
        modifiers,
        kind,
      );
  const clamped = clampNodeDimensions(
    next.width,
    next.height,
    startBounds.width,
    startBounds.height,
    RESIZE_MIN_DIMENSION,
  );
  let width = clamped.width;
  let height = clamped.height;
  let x: number;
  let y: number;
  if (centerProportional) {
    x = finiteCoord(next.x, n.x);
    y = finiteCoord(next.y, n.y);
  } else if (rotated) {
    x = n.x;
    y = n.y;
  } else {
    x = finiteCoord(startBounds.x + next.x, n.x);
    y = finiteCoord(startBounds.y + next.y, n.y);
  }
  const pos = clampNodePosition(x, y, { x: n.x, y: n.y });
  x = pos.x;
  y = pos.y;

  if (opts?.fixedWorld) {
    const scaleFromCenter = modifiers.altKey;
    const anchorLocal = scaleFromCenter
      ? { x: width / 2, y: height / 2 }
      : getResizeAnchorLocal(handle, width, height);
    const solved = solveNodeXYForAnchorWorld(
      n,
      s.nodes,
      width,
      height,
      anchorLocal,
      opts.fixedWorld,
      { x, y },
    );
    x = solved.x;
    y = solved.y;
  }

  const content = buildResizeContentPatches(
    n,
    startBounds,
    { x, y, width, height },
    handle,
    modifiers,
    buildResizeContentOpts(id, {
      startPathPoints: opts?.startPathPoints,
      startNodesSnapshot: opts?.startNodesSnapshot,
    }),
  );
  let nodePatch: Partial<EditorNode> = { x, y, width, height, ...content };
  if (
    n.type === "path" &&
    !isPolygonNode(n) &&
    !isStarNode(n) &&
    (n.pathPoints?.length || n.flattenedPathData?.trim()) &&
    (width !== startBounds.width || height !== startBounds.height)
  ) {
    const resizeOpts = buildResizeContentOpts(id, {
      startPathPoints: opts?.startPathPoints,
      startNodesSnapshot: opts?.startNodesSnapshot,
    });
    const startPts = resizeOpts?.startPathPoints ?? n.pathPoints;
    Object.assign(
      nodePatch,
      pathContentPatchFromBoxResize(
        {
          type: "path",
          width: startBounds.width,
          height: startBounds.height,
          pathPoints: startPts,
          flattenedPathData: resizeOpts?.startFlattenedPathData ?? n.flattenedPathData,
        },
        width,
        height,
      ),
    );
  }
  if (n.type === "text") {
    const textPatch = buildTextResizeGeometryPatch(n, startBounds, {
      x,
      y,
      width,
      height,
    });
    nodePatch = { ...nodePatch, ...textPatch };
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
      const childPatches = scaleSubtreeContentPatches(
        id,
        nodes,
        s.childOrder,
        sx,
        sy,
        uniform,
        opts?.startNodesSnapshot,
      );
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
  nodes[id] = sanitizeNodeGeometry(nodes[id]!, n);
  let merged = nodes[id]!;
  if (merged.type === "line" || merged.type === "arrow") {
    nodes[id] = { ...merged, ...lineEndpointsPatchFromBoxResize(n, merged) };
    merged = nodes[id]!;
  }
  warnInvalidNodeGeometry("resizeNode", id, merged, nodes);

  let childOrder = s.childOrder;
  if (isMasterComponentEdit(nodes, id)) {
    const refresh = new Set<string>();
    const propagated = applyMasterComponentDocumentChanges(nodes, childOrder, refresh, {
      changedNodeIds: [id],
      changedKeysByNode: {
        [id]: ["width", "height", "x", "y", "layoutSizingHorizontal", "layoutSizingVertical"],
      },
      reason: "resize",
    });
    nodes = propagated.nodes;
    childOrder = propagated.childOrder;
    if (refresh.size > 0) {
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);
    }
  }

  return { nodes, childOrder, ui: {} };
}

function buildResizeFrameWithConstraintsResult(
  s: Pick<EditorState, "nodes" | "childOrder">,
  frameId: string,
  newBounds: { x?: number; y?: number; width: number; height: number },
  opts?: { skipParentRelayout?: boolean },
): StructuralDocumentResult | null {
  const n = s.nodes[frameId];
  if (!n || n.locked || (n.type !== "frame" && n.type !== "group")) return null;
  let nodes = ensureManualScreenLayout(s.nodes, s.childOrder, frameId);
  const base = nodes[frameId]!;
  const oldW = base.width;
  const oldH = base.height;
  const W = Math.max(RESIZE_MIN_DIMENSION, newBounds.width);
  const H = Math.max(RESIZE_MIN_DIMENSION, newBounds.height);
  const next: EditorNode = {
    ...base,
    width: W,
    height: H,
    ...(newBounds.x !== undefined ? { x: newBounds.x } : {}),
    ...(newBounds.y !== undefined ? { y: newBounds.y } : {}),
  };
  nodes = { ...nodes, [frameId]: next };
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
  return { nodes, childOrder: s.childOrder, ui: {} };
}

type ResponsivePreviewGeomBackup = Record<
  string,
  { x: number; y: number; width: number; height: number }
>;

function restoreNodesFromGeomBackup(
  nodes: Record<string, EditorNode>,
  geomBackup: ResponsivePreviewGeomBackup,
): Record<string, EditorNode> {
  const out = { ...nodes };
  for (const [bid, g] of Object.entries(geomBackup)) {
    const nn = out[bid];
    if (nn) out[bid] = { ...nn, ...g };
  }
  return out;
}

function buildOpenResponsivePreviewResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "responsivePreview">,
  frameId: string,
): StructuralDocumentResult {
  let nodes = { ...s.nodes };
  if (s.responsivePreview) {
    nodes = restoreNodesFromGeomBackup(nodes, s.responsivePreview.geomBackup);
  }
  const n = nodes[frameId];
  if (!n || n.locked || (n.type !== "frame" && n.type !== "group")) {
    return { nodes, childOrder: s.childOrder, ui: { responsivePreview: null } };
  }
  const subtree = collectSubtreeIds(frameId, s.childOrder);
  const geomBackup: ResponsivePreviewGeomBackup = {};
  for (const tid of subtree) {
    const t = nodes[tid];
    if (!t) continue;
    geomBackup[tid] = { x: t.x, y: t.y, width: t.width, height: t.height };
  }
  return {
    nodes,
    childOrder: s.childOrder,
    ui: {
      responsivePreview: {
        frameId,
        geomBackup,
        draftWidth: n.width,
        draftHeight: n.height,
      },
    },
  };
}

function buildUpdateResponsivePreviewBoundsResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "responsivePreview">,
  width: number,
  height: number,
): StructuralDocumentResult | null {
  const rp = s.responsivePreview;
  if (!rp) return null;
  let nodes = restoreNodesFromGeomBackup(s.nodes, rp.geomBackup);
  const fr = nodes[rp.frameId];
  if (!fr || fr.locked) {
    return { nodes, childOrder: s.childOrder, ui: { responsivePreview: null } };
  }
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
    childOrder: s.childOrder,
    ui: { responsivePreview: { ...rp, draftWidth: W, draftHeight: H } },
  };
}

function buildResetResponsivePreviewResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "responsivePreview">,
): StructuralDocumentResult | null {
  const rp = s.responsivePreview;
  if (!rp) return null;
  const nodes = restoreNodesFromGeomBackup(s.nodes, rp.geomBackup);
  const og = rp.geomBackup[rp.frameId]!;
  return {
    nodes,
    childOrder: s.childOrder,
    ui: { responsivePreview: { ...rp, draftWidth: og.width, draftHeight: og.height } },
  };
}

function buildCancelResponsivePreviewResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "responsivePreview">,
): StructuralDocumentResult | null {
  const rp = s.responsivePreview;
  if (!rp) return null;
  return {
    nodes: restoreNodesFromGeomBackup(s.nodes, rp.geomBackup),
    childOrder: s.childOrder,
    ui: { responsivePreview: null },
  };
}

function buildRestoreResponsivePreviewGeomResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "responsivePreview">,
): StructuralDocumentResult | null {
  const rp = s.responsivePreview;
  if (!rp) return null;
  return {
    nodes: restoreNodesFromGeomBackup(s.nodes, rp.geomBackup),
    childOrder: s.childOrder,
    ui: { responsivePreview: null },
  };
}

function buildEndMultiRotateInteractionResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "rotateGeomSnapshots">,
): StructuralDocumentResult | null {
  const snapshots = s.rotateGeomSnapshots;
  if (!snapshots || Object.keys(snapshots).length === 0) return null;
  const nodes = { ...s.nodes };
  for (const [nodeId, snap] of Object.entries(snapshots)) {
    const n = nodes[nodeId];
    if (!n || n.locked) continue;
    nodes[nodeId] = sanitizeNodeGeometry(
      {
        ...n,
        x: n.x,
        y: n.y,
        rotation: n.rotation ?? 0,
        width: snap.width,
        height: snap.height,
      },
      { width: snap.width, height: snap.height },
    );
  }
  return {
    nodes,
    childOrder: s.childOrder,
    ui: { transformInteractionMode: "none", rotateGeomSnapshot: null, rotateGeomSnapshots: null },
  };
}

function buildEndRotateInteractionResult(
  s: Pick<EditorState, "nodes" | "childOrder" | "rotateGeomSnapshot">,
  nodeId: string,
  rotation: number,
): StructuralDocumentResult | null {
  const snap = s.rotateGeomSnapshot;
  if (!snap || snap.nodeId !== nodeId) return null;
  const n = s.nodes[nodeId];
  if (!n || n.locked) return null;
  const nodes = {
    ...s.nodes,
    [nodeId]: sanitizeNodeGeometry(
      {
        ...n,
        rotation,
        x: snap.x,
        y: snap.y,
        width: snap.width,
        height: snap.height,
      },
      { width: snap.width, height: snap.height },
    ),
  };
  return {
    nodes,
    childOrder: s.childOrder,
    ui: { transformInteractionMode: "none", rotateGeomSnapshot: null, rotateGeomSnapshots: null },
  };
}

function cloneTopLevelSelectionState(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  worldOffset: CloneWorldOffset | null,
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
    const rootOffset = inAutoLayout ? null : worldOffset;

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
    Object.assign(childOrder, insertDuplicatedSiblingInChildOrder(childOrder, P, rootId, newRootId));
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
  "clipChildren",
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
  "strokeSidesCustomColors",
  "strokeStartPoint",
  "strokeEndPoint",
  "cornerRadius",
  "cornerRadii",
  "textColor",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "lineHeightUnit",
  "letterSpacing",
  "letterSpacingUnit",
  "textResizeMode",
  "autoResize",
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
    lineHeightUnit: n.lineHeightUnit,
    letterSpacing: n.letterSpacing,
    letterSpacingUnit: n.letterSpacingUnit,
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
  return applyTextReflowAfterAutoLayout(next, nodes);
}

/** Recompute wrapped text height when auto-layout changes a text child's width. */
function applyTextReflowAfterAutoLayout(
  nodes: Record<string, EditorNode>,
  before: Record<string, EditorNode>,
): Record<string, EditorNode> {
  let next = { ...nodes };
  for (const id of Object.keys(next)) {
    const node = next[id];
    if (!node || node.type !== "text") continue;
    const prev = before[id];
    if (!prev || node.width === prev.width) continue;
    const patch = ensureTextModeForExplicitWidth(node, "auto-layout", {
      previousWidth: prev.width,
    });
    if (Object.keys(patch).length > 0) {
      next[id] = { ...node, ...patch };
    }
  }
  return next;
}

function relayoutParentsWithAutoLayout(
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  parentKeys: Iterable<string>,
): Record<string, EditorNode> {
  const keys = filterBridgeCaptureRelayoutParents(nodes, childOrder, parentKeys);
  if (keys.length === 0) return nodes;
  let layoutMap = toLayoutMap(nodes);
  for (const pk of keys) {
    if (pk === ROOT) continue;
    layoutMap = markLayoutDirty(layoutMap, pk);
  }
  layoutMap = relayoutDirtyTree(layoutMap, childOrder, keys);
  return mergeLayoutMapIntoNodes(nodes, layoutMap);
}

function textStyleFromSelection(
  s: Pick<EditorState, "nodes" | "selectedIds" | "canvasBackgroundColor">,
) {
  const defaultColor = defaultCanvasForegroundColor();
  for (const id of s.selectedIds) {
    const n = s.nodes[id];
    if (n?.type === "text") {
      return {
        fontFamily: n.fontFamily ?? DEFAULT_TEXT_FONT_FAMILY,
        fontSize: n.fontSize ?? DEFAULT_TEXT_FONT_SIZE,
        fontWeight: n.fontWeight ?? 500,
        lineHeight: n.lineHeight,
        lineHeightUnit: n.lineHeightUnit ?? (n.lineHeight != null ? "percent" : "auto"),
        letterSpacing: n.letterSpacing ?? 0,
        letterSpacingUnit: n.letterSpacingUnit ?? "percent",
        fill: n.fill ?? defaultColor,
        textColor: n.textColor ?? n.fill ?? defaultColor,
      };
    }
  }
  return {
    fontFamily: DEFAULT_TEXT_FONT_FAMILY,
    fontSize: DEFAULT_TEXT_FONT_SIZE,
    fontWeight: 500,
    lineHeightUnit: "auto" as const,
    letterSpacing: 0,
    letterSpacingUnit: "percent" as const,
    fill: defaultColor,
    textColor: defaultColor,
  };
}

/** Document fields written to `.paytmcraft.json` / API — excludes UI overlays, modals, history, and transient tool state. */
export function toPersistSlice(s: EditorState): EditorPersistSlice {
  const { pages, pageOrder } = pagesWithActiveCaptured(s);
  return {
    nodes: clearEphemeralInteractiveFields(s.nodes),
    childOrder: s.childOrder,
    assets: s.assets,
    fontAssets: s.fontAssets,
    designTokens: s.designTokens,
    fileName: s.fileName,
    selectedIds: s.selectedIds,
    zoom: s.zoom,
    pan: s.pan,
    showGrid: s.showGrid,
    showRulers: s.showRulers,
    canvasBackgroundColor: s.canvasBackgroundColor,
    canvasColorMode: s.canvasColorMode,
    comments: s.comments,
    pages,
    pageOrder,
    activePageId: s.activePageId,
    activeSubPageId: s.activeSubPageId,
    codeRoundTripLink: s.codeRoundTripLink ?? null,
    projectCssSources: s.projectCssSources,
    storybookUrl: s.storybookUrl,
    storybookCatalogHash: s.storybookCatalogHash,
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
    rotateGeomSnapshot: null,
    rotateGeomSnapshots: null,
    isMovingSelection: false,
    rotateHandleHovered: false,
    rotateHandleHoverHandle: null,
    objectEditModeNodeId: null,
    selectedPathPointIds: [],
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
    apiFileRevision: undefined,
    isApiBackedFile: false,
    apiCommentsStatus: "idle" as ApiCommentsStatus,
    versionHistoryOpen: false,
    apiVersionsStatus: "idle" as ApiVersionsStatus,
    apiFileVersions: [],
    editorMode: "design",
    tool: "move",
    leftTab: "layers",
    documentSaveStatus: "saved",
    realtimeSyncStatus: "idle" as RealtimeSyncStatus,
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
    rotateGeomSnapshot: null,
    rotateGeomSnapshots: null,
    isMovingSelection: false,
    rotateHandleHovered: false,
    rotateHandleHoverHandle: null,
    objectEditModeNodeId: null,
    selectedPathPointIds: [],
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
    apiFileRevision: s.apiFileRevision,
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

/** Selected frame → paste inside it; otherwise keep the copied layer's original parent. */
function resolvePasteParentId(
  s: Pick<EditorState, "nodes" | "childOrder" | "selectedIds">,
  payload: EditorClipboardPayloadV1,
  rootId: string,
): string | null {
  const tops = topLevelSelectedIds(s.selectedIds, s.nodes).filter((id) => {
    const n = s.nodes[id];
    return n && !n.locked && n.visible;
  });
  if (tops.length === 1) {
    const n = s.nodes[tops[0]!];
    if (n?.type === "frame") return tops[0]!;
  }
  const copiedRoot = payload.nodes[rootId];
  const originalParent = copiedRoot?.parentId ?? null;
  if (originalParent && s.nodes[originalParent]) return originalParent;
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
    selectedPathPointIds: [],
    historyPast: [],
    historyFuture: [],
  };
}

export const useEditorStore = create<EditorState>((set, get) => {
  const scheduleWorkspacePersist = () => {
    queueMicrotask(() => {
      const st = get();
      if (st.figImportInProgress || st.craftBridgeInboundActive) return;
      st.saveToLocal();
    });
  };

  // Always seed empty on first paint so SSR and client markup match; local doc loads in EditorDocumentPersistence.
  const initialDoc = createEmptyDocumentFields();

  return {
  tool: "move",
  lastShapeTool: "rect",
  framePresetId: DEFAULT_FRAME_PRESET_ID,
  editorMode: "design",
  leftTab: "layers",
  rightPanelTab: "design",
  codePanelFormat: "react",
  selectedIds: initialDoc.selectedIds,
  zoom: initialDoc.zoom,
  pan: initialDoc.pan,
  nodes: initialDoc.nodes,
  childOrder: initialDoc.childOrder,
  pages: initialDoc.pages,
  pageOrder: initialDoc.pageOrder,
  activePageId: initialDoc.activePageId,
  activeSubPageId:
    initialDoc.activeSubPageId ??
    initialDoc.pages[initialDoc.activePageId]?.activeSubPageId ??
    `${initialDoc.activePageId}-sp-1`,
  assets: initialDoc.assets,
  fontAssets: initialDoc.fontAssets ?? {},
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
  showRulers: initialDoc.showRulers ?? false,
  canvasBackgroundColor: initialDoc.canvasBackgroundColor,
  canvasColorMode: initialDoc.canvasColorMode ?? "light",
  projectCssSources: initialDoc.projectCssSources ?? [],
  storybookUrl: initialDoc.storybookUrl,
  storybookCatalogHash: initialDoc.storybookCatalogHash,
  comments: initialDoc.comments,
  commentsPanelOpen: false,
  activeCommentId: null,
  isPlacingComment: false,
  penDrawingNodeId: null,
  pencilDrawingNodeId: null,
  shapeDrawingSession: null,
  frameDrawingSession: null,
  textDrawingSession: null,
  pencilStrokeWidth: 2,
  pathEditModeNodeId: null,
  shapeEditModeNodeId: null,
  transformInteractionMode: "none",
  rotateGeomSnapshot: null,
  rotateGeomSnapshots: null,
  isMovingSelection: false,
  rotateHandleHovered: false,
  rotateHandleHoverHandle: null,
  objectEditModeNodeId: null,
  selectedPathPointIds: [],
  editingTextId: null,
  textEditSelection: null,
  hoveredCanvasId: null,
  contextMenu: null,
  layerRenameId: null,
  placingComponentMasterId: null,
  prototypeWireDrag: null,
  selectedPrototypeLinkId: null,
  prototypePreview: null,
  componentInteractionPreview: false,
  activeSlotEdit: null,
  responsivePreview: null,
  documentSaveStatus: "saved",
  realtimeSyncStatus: "idle" as RealtimeSyncStatus,
  documentHydrating: false,
  documentHydrationRevision: 0,
  apiFileId: undefined,
  apiWorkspaceId: undefined,
  apiFileRevision: undefined,
  isApiBackedFile: false,
  apiCommentsStatus: "idle" as ApiCommentsStatus,
  versionHistoryOpen: false,
  apiVersionsStatus: "idle" as ApiVersionsStatus,
  apiFileVersions: [],
  historyPast: [],
  historyFuture: [],
  wasmHistoryCanUndo: false,
  wasmHistoryCanRedo: false,
  isApplyingHistory: false,
  isApplyingWasmMirror: false,

  applyWasmDocumentPatch: (patch) => {
    const s = get();
    if (s.isApplyingWasmMirror || s.isApplyingHistory) return;
    if (
      JSON.stringify(s.nodes) === JSON.stringify(patch.nodes) &&
      JSON.stringify(s.childOrder) === JSON.stringify(patch.childOrder)
    ) {
      return;
    }
    set((state) => {
      const merged = {
        isApplyingWasmMirror: true,
        nodes: patch.nodes,
        childOrder: patch.childOrder,
      };
      return { ...merged, ...syncActivePageRecord({ ...state, ...merged }) };
    });
    set({ isApplyingWasmMirror: false });
  },

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
  inspectorAspectRatioLocked: false,
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
  setInspectorAspectRatioLocked: (locked) => set({ inspectorAspectRatioLocked: locked }),
  toggleInspectorAspectRatioLocked: () =>
    set((s) => ({ inspectorAspectRatioLocked: !s.inspectorAspectRatioLocked })),

  aiModalOpen: false,
  aiModalSource: null,
  aiGenerateActive: false,
  aiGenerateStep: null,
  aiGenerateJobSeq: 0,
  aiGenerateJob: null,
  aiGenerateError: null,
  aiGenerateFailedJob: null,
  openAIModal: (source) =>
    set(() => ({
      aiModalOpen: true,
      aiModalSource: source,
      aiGenerateError: null,
      aiGenerateFailedJob: null,
      commandMenuOpen: false,
      shortcutOverlayOpen: false,
      pluginMarketplaceOpen: false,
      activePluginId: undefined,
      shareModalOpen: false,
      workspacePickerOpen: false,
      teamInviteModalOpen: false,
    })),
  closeAIModal: () => set({ aiModalOpen: false, aiModalSource: null }),

  queueAIGenerate: (payload) => {
    const id = get().aiGenerateJobSeq + 1;
    const queuedAt = Date.now();
    set({
      aiGenerateJobSeq: id,
      aiGenerateJob: { ...payload, id, queuedAt },
      aiGenerateActive: true,
      aiGenerateStep: payload.initialStep,
      aiGenerateError: null,
      aiGenerateFailedJob: null,
      aiModalOpen: false,
      aiModalSource: null,
    });

    const skeleton = buildAIGenerateSkeletonSlice({
      prompt: payload.prompt,
      preset: payload.preset,
      style: payload.style,
      model: payload.model,
      contextPrompt: payload.contextPrompt,
      contextAttachmentCount: payload.contextAttachmentCount,
      contextImages: payload.contextImages,
    });
    void get().applyGeneratedDesign(skeleton.slice, "replace", {
      recordHistory: payload.source === "editor",
      zoomToFit: true,
    });

    return id;
  },
  setAIGenerateStep: (step) => set({ aiGenerateStep: step }),
  finishAIGenerate: () =>
    set({
      aiGenerateActive: false,
      aiGenerateStep: null,
      aiGenerateJob: null,
      aiGenerateError: null,
      aiGenerateFailedJob: null,
    }),
  failAIGenerate: (error, job) =>
    set({
      aiGenerateActive: false,
      aiGenerateStep: null,
      aiGenerateJob: null,
      aiGenerateError: error,
      aiGenerateFailedJob: {
        prompt: job.prompt,
        preset: job.preset,
        style: job.style,
        model: job.model,
        contextPrompt: job.contextPrompt,
        contextAttachmentCount: job.contextAttachmentCount,
        contextImages: job.contextImages,
        source: job.source,
      },
      aiModalOpen: true,
      aiModalSource: job.source,
    }),
  cancelAIGenerate: () =>
    set({
      aiGenerateActive: false,
      aiGenerateStep: null,
      aiGenerateJob: null,
    }),
  clearAIGenerateError: () => set({ aiGenerateError: null, aiGenerateFailedJob: null }),

  importHubOpen: false,
  importWebModalOpen: false,
  importFigmaModalOpen: false,
  figImportInProgress: false,
  figImportStatus: null,
  figImportToast: null,
  setFigImportToast: (message) => set({ figImportToast: message }),
  figFidelityCaptures: null,
  figFidelityReport: null,
  figFidelityOverlayEnabled: false,
  setFigFidelityOverlayEnabled: (enabled) => set({ figFidelityOverlayEnabled: enabled }),
  refreshFigFidelityReport: () => {
    const { figFidelityCaptures, nodes } = get();
    if (!figFidelityCaptures) return;
    void import("@/lib/figImport/runFigFidelityInspection").then(({ runFigFidelityInspection }) => {
      set({ figFidelityReport: runFigFidelityInspection(figFidelityCaptures, nodes) });
    });
  },
  svgImportNotice: null,
  setSvgImportNotice: (notice) => set({ svgImportNotice: notice }),
  clearSvgImportNotice: () => set({ svgImportNotice: null }),
  codeRoundTripOpen: false,
  codeRoundTripTab: "export",
  codeRoundTripSourceHeader: null,
  setCodeRoundTripSourceHeader: (header) => set({ codeRoundTripSourceHeader: header }),
  codeRoundTripLink: null,
  setCodeRoundTripLink: (link) =>
    set((s) => ({
      codeRoundTripLink: normalizeCodeRoundTripLink(link),
      documentSaveStatus: s.documentSaveStatus === "saved-api" ? "unsaved" : "unsaved",
    })),
  updateCodeRoundTripLink: (patch) =>
    set((s) => {
      const prev = s.codeRoundTripLink;
      if (!prev) return s;
      const { syncMode: _syncIgnored, ...rest } = patch;
      return {
        codeRoundTripLink: normalizeCodeRoundTripLink({ ...prev, ...rest }),
        documentSaveStatus: "unsaved",
      };
    }),
  craftBridgeSyncStatus: "idle",
  craftBridgeSyncError: null,
  setCraftBridgeSyncStatus: (status, error = null) =>
    set({ craftBridgeSyncStatus: status, craftBridgeSyncError: error }),
  storybookSyncMessage: null,
  setStorybookSyncMessage: (message) => set({ storybookSyncMessage: message }),
  craftBridgeInboundActive: false,
  setCraftBridgeInboundActive: (active) => set({ craftBridgeInboundActive: active }),
  craftBridgeConflict: null,
  setCraftBridgeConflict: (conflict) => set({ craftBridgeConflict: conflict }),
  clearCraftBridgeConflict: () => set({ craftBridgeConflict: null }),
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
    const result = buildApplyPluginLoremResult(get());
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  applyPluginRenameSelection: () => {
    const result = buildApplyPluginRenameResult(get());
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  applyPluginIconInSelection: () => {
    const result = buildApplyPluginIconResult(get());
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  clearHistory: () => {
    if (isWasmDocumentAuthority()) {
      runCraftEngineAccess(() => {
        try {
          getActiveCraftEngine()?.clearHistory();
        } catch {
          /* engine not ready */
        }
      });
    }
    set({
      historyPast: [],
      historyFuture: [],
      wasmHistoryCanUndo: false,
      wasmHistoryCanRedo: false,
    });
  },

  pushHistory: (_label) => {
    const s = get();
    if (s.isApplyingHistory) return;
    if (isWasmDocumentAuthority()) {
      runCraftEngineAccess(() => {
        const engine = getActiveCraftEngine();
        if (!engine) return;
        try {
          engine.pushHistorySnapshot();
        } catch {
          /* engine not ready */
        }
        set({
          wasmHistoryCanUndo: engine.canUndo(),
          wasmHistoryCanRedo: engine.canRedo(),
        });
      });
      return;
    }
    const snap = editorStateToHistorySnapshot({
      fileName: s.fileName,
      nodes: s.nodes,
      childOrder: s.childOrder,
      assets: s.assets,
      fontAssets: s.fontAssets,
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
    if (s.isApplyingHistory) return;

    if (isWasmDocumentAuthority()) {
      const wasmPatch = craftEngineAuthorityUndo();
      if (!wasmPatch) return;
      const mergedPatch = mergeWasmSnapshotWithStore(s.nodes, wasmPatch);
      set((state) => {
        const merged = {
          isApplyingHistory: true,
          nodes: mergedPatch.nodes,
          childOrder: mergedPatch.childOrder,
          wasmHistoryCanUndo: craftEngineAuthorityCanUndo(),
          wasmHistoryCanRedo: craftEngineAuthorityCanRedo(),
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
          shapeDrawingSession: null,
          frameDrawingSession: null,
          textDrawingSession: null,
          pathEditModeNodeId: null,
          objectEditModeNodeId: null,
          selectedPathPointIds: [],
          responsivePreview: null,
        };
        return {
          ...merged,
          ...syncActivePageRecord({ ...state, ...merged }),
        };
      });
      set({ isApplyingHistory: false });
      return;
    }

    if (s.historyPast.length === 0) return;
    const prevSnap = s.historyPast[s.historyPast.length - 1]!;
    const currentSnap = editorStateToHistorySnapshot({
      fileName: s.fileName,
      nodes: s.nodes,
      childOrder: s.childOrder,
      assets: s.assets,
      fontAssets: s.fontAssets,
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
        shapeDrawingSession: null,
        frameDrawingSession: null,
        textDrawingSession: null,
        pathEditModeNodeId: null,
  objectEditModeNodeId: null,
        selectedPathPointIds: [],
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
    if (s.isApplyingHistory) return;

    if (isWasmDocumentAuthority()) {
      const wasmPatch = craftEngineAuthorityRedo();
      if (!wasmPatch) return;
      const mergedPatch = mergeWasmSnapshotWithStore(s.nodes, wasmPatch);
      set((state) => {
        const merged = {
          isApplyingHistory: true,
          nodes: mergedPatch.nodes,
          childOrder: mergedPatch.childOrder,
          wasmHistoryCanUndo: craftEngineAuthorityCanUndo(),
          wasmHistoryCanRedo: craftEngineAuthorityCanRedo(),
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
          shapeDrawingSession: null,
          frameDrawingSession: null,
          textDrawingSession: null,
          pathEditModeNodeId: null,
          objectEditModeNodeId: null,
          selectedPathPointIds: [],
          responsivePreview: null,
        };
        return {
          ...merged,
          ...syncActivePageRecord({ ...state, ...merged }),
        };
      });
      set({ isApplyingHistory: false });
      return;
    }

    if (s.historyFuture.length === 0) return;
    const nextSnap = s.historyFuture[0]!;
    const currentSnap = editorStateToHistorySnapshot({
      fileName: s.fileName,
      nodes: s.nodes,
      childOrder: s.childOrder,
      assets: s.assets,
      fontAssets: s.fontAssets,
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
        shapeDrawingSession: null,
        frameDrawingSession: null,
        textDrawingSession: null,
        pathEditModeNodeId: null,
  objectEditModeNodeId: null,
        selectedPathPointIds: [],
        responsivePreview: null,
      };
      return {
        ...merged,
        ...syncActivePageRecord({ ...s, ...merged }),
      };
    });
    set({ isApplyingHistory: false });
  },

  setEditingTextId: (editingTextId, selection) => {
    const prev = get().editingTextId;
    if (editingTextId && !prev) get().pushHistory();

    const deleteEmptyTextLayer = (textId: string): boolean => {
      const node = get().nodes[textId];
      if (node?.type !== "text" || node.content?.length) return false;
      get().pushHistory();
      commitStructuralResult(buildDeleteEmptyTextOnEditEndResult(get(), textId));
      return true;
    };

    if (prev && prev !== editingTextId && deleteEmptyTextLayer(prev)) {
      if (!editingTextId) return;
    }

    if (!editingTextId && prev) {
      if (deleteEmptyTextLayer(prev)) return;
    }

    set((s) => {
      if (!editingTextId) {
        return { editingTextId: null, textEditSelection: null };
      }
      const node = s.nodes[editingTextId];
      const len = node?.type === "text" ? (node.content?.length ?? 0) : 0;
      const anchor = selection?.anchor ?? len;
      const focus = selection?.focus ?? len;
      return {
        editingTextId,
        textEditSelection: { anchor, focus },
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
      const drawNode = before.nodes[before.penDrawingNodeId];
      const pointCount =
        drawNode?.type === "path" ? (drawNode.pathPoints?.length ?? 0) : 0;
      if (pointCount >= 2) {
        get().finishPath(false);
      } else {
        get().cancelPath();
      }
    }
    if (before.pencilDrawingNodeId && tool !== "pencil") {
      get().cancelPencilStroke();
    }
    if (before.shapeDrawingSession) {
      const nextShape = toolToShapeType(tool);
      if (!nextShape || before.tool !== tool) {
        get().cancelShapeFromDrag();
      }
    }
    if (before.frameDrawingSession && tool !== "frame") {
      get().cancelFrameFromDrag();
    }
    if (before.textDrawingSession && tool !== "text") {
      get().cancelTextFromDrag();
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
        ...(isShapeTool(tool) ? { lastShapeTool: tool } : {}),
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
      selectedPathPointIds:
        editorMode === "prototype" || editorMode === "inspect" ? [] : s.selectedPathPointIds,
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
    commitStructuralResult(buildFinishPrototypeConnectionResult(get(), targetFrameId));
  },

  cancelPrototypeConnection: () => set({ prototypeWireDrag: null }),

  updatePrototypeLink: (linkId, patch) => {
    const s0 = get();
    const own = findPrototypeLinkOwner(s0.nodes, linkId);
    if (!own) return;
    get().pushHistory();
    commitStructuralResult(buildUpdatePrototypeLinkResult(get(), linkId, patch));
  },

  deletePrototypeLink: (linkId) => {
    const s0 = get();
    const own = findPrototypeLinkOwner(s0.nodes, linkId);
    if (!own) return;
    get().pushHistory();
    commitStructuralResult(buildDeletePrototypeLinkResult(get(), linkId));
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

  select: (id, additive) => {
    set((s) => {
      if (!id)
        return {
          selectedIds: [],
          selectedLayoutGuideId: null,
          selectedPrototypeLinkId: null,
          pathEditModeNodeId: null,
          shapeEditModeNodeId: null,
          objectEditModeNodeId: null,
          selectedPathPointIds: [],
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
          selectedPathPointIds: [],
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
        selectedPathPointIds: [],
      };
    });
    const st = get();
    syncDuplicateRepeatSelection(st.selectedIds, st.nodes);
    if (id && !additive) {
      const selected = st.nodes[id];
      if (selected?.isComponentSet && (selected.layoutMode ?? "none") === "none") {
        const migrated = reflowComponentSetContainer(st.nodes, st.childOrder, id);
        set({ nodes: migrated.nodes, childOrder: migrated.childOrder });
      }
    }
  },

  clearSelection: () => {
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
        selectedPathPointIds: [],
        prototypeWireDrag: null,
      };
      return { ...next, ...syncActivePageRecord({ ...s, ...next }) };
    });
    resetDuplicateRepeatOffset();
  },

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
      selectedPathPointIds: [],
      prototypeWireDrag: null,
    }),

  removeLayoutGuide: (id) => {
    get().pushHistory();
    commitStructuralResult(buildRemoveLayoutGuideResult(get(), id));
  },

  updateLayoutGuidePosition: (id, pos, opts) => {
    if (!opts?.skipHistory) get().pushHistory();
    commitStructuralResult(buildUpdateLayoutGuidePositionResult(get(), id, pos));
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
    commitStructuralResult(buildUpdateNodeResult(get(), id, patch, opts));
    if (patch.x != null || patch.y != null) {
      const st = get();
      refreshDuplicateStepAfterMove(st.selectedIds, st.nodes, st.childOrder);
    }
    const after = get().nodes[id];
    if (after && !isRotateGeometryLockActive(get())) {
      const mirrored = mirrorNodeGeometryToWasm(id, patch, after);
      if (!mirrored) syncWasmDocumentAfterStoreUpdate();
    }
  },

  updateNodes: (patches, opts) => {
    const ids = Object.keys(patches);
    if (ids.length === 0) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const pre = get();
      if (ids.some((id) => pre.nodes[id] && !pre.nodes[id]!.locked)) get().pushHistory();
    }
    commitStructuralResult(buildUpdateNodesResult(get(), patches));
    const st = get();
    const entries = ids
      .map((nodeId) => {
        const node = st.nodes[nodeId];
        const nodePatch = patches[nodeId];
        if (!node || !nodePatch) return null;
        return { nodeId, patch: nodePatch, node };
      })
      .filter((e): e is NonNullable<typeof e> => e != null);
    if (!isRotateGeometryLockActive(get())) {
      const mirrored = mirrorGeometryPatchesToWasm(entries);
      if (!mirrored) syncWasmDocumentAfterStoreUpdate();
    }
  },

  updateNodeStyle: (id, patch, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const pre = get();
      const n0 = pre.nodes[id];
      if (n0 && !n0.locked) get().pushHistory();
    }
    commitStructuralResult(buildUpdateNodeStyleResult(get(), id, patch));
  },

  setTextResizeMode: (id, mode, opts) => {
    const pre = get();
    const layoutBase = resolveTextNodeFromStore(pre.nodes, id);
    if (!layoutBase || layoutBase.locked) return;

    const before = textResizeModeSnapshot(layoutBase);
    const afterPatch = textResizeModeStylePatch(layoutBase, mode);

    if (!opts?.skipHistory && !pre.isApplyingHistory) {
      const n0 = pre.nodes[id];
      if (n0 && !n0.locked) get().pushHistory();
    }

    commitStructuralResult(buildUpdateNodeStyleResult(get(), id, afterPatch as NodeStylePatch));

    const post = get();
    const afterNode = resolveTextNodeFromStore(post.nodes, id);
    if (!afterNode) return;

    logTextResizeModeClick({
      clickedMode: mode,
      selectedNodeId: id,
      before,
      afterPatch,
      afterStoreNode: textResizeModeSnapshot(afterNode),
      layout: textResizeLayoutSnapshot(afterNode),
    });
  },

  setNodeFillHex: (nodeId, hex, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const n0 = get().nodes[nodeId];
      if (n0 && !n0.locked) get().pushHistory();
    }
    commitStructuralResult(buildSetNodeFillHexResult(get(), nodeId, hex));
  },

  setNodeTextColorHex: (nodeId, hex, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const n0 = get().nodes[nodeId];
      if (n0 && !n0.locked) get().pushHistory();
    }
    commitStructuralResult(buildSetNodeTextColorHexResult(get(), nodeId, hex));
  },

  setSelectionFillHex: (hex, opts) => {
    const tops = topLevelSelectedIds(get().selectedIds, get().nodes).filter((id) => {
      const n = get().nodes[id];
      return n && !n.locked && n.visible && nodeSupportsFillColor(n);
    });
    if (tops.length === 0) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    commitStructuralResult(buildSetSelectionFillHexResult(get(), hex));
  },

  updateSelectionStyle: (patch, opts) => {
    const tops = topLevelSelectedIds(get().selectedIds, get().nodes).filter((id) => {
      const n = get().nodes[id];
      return n && !n.locked;
    });
    if (tops.length === 0) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    commitStructuralResult(buildUpdateSelectionStyleResult(get(), patch));
  },

  updateSelectionNodes: (patch, opts) => {
    const tops = topLevelSelectedIds(get().selectedIds, get().nodes).filter((id) => {
      const n = get().nodes[id];
      return n && !n.locked;
    });
    if (tops.length === 0) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    commitStructuralResult(buildUpdateSelectionNodesResult(get(), patch));
    const st = get();
    const entries = tops
      .map((nodeId) => {
        const node = st.nodes[nodeId];
        if (!node) return null;
        return { nodeId, patch, node };
      })
      .filter((e): e is NonNullable<typeof e> => e != null);
    if (!isRotateGeometryLockActive(get())) {
      const mirrored = mirrorGeometryPatchesToWasm(entries);
      if (!mirrored) syncWasmDocumentAfterStoreUpdate();
    }
  },

  setNodeVisible: (id, visible) => {
    get().pushHistory();
    commitStructuralResult(buildPatchNodeWithParentRelayoutResult(get(), id, { visible }));
  },

  setNodeLocked: (id, locked) => {
    get().pushHistory();
    commitStructuralResult(buildPatchNodeWithParentRelayoutResult(get(), id, { locked }));
  },

  toggleVisible: (id) => {
    const n = get().nodes[id];
    if (!n) return;
    get().pushHistory();
    commitStructuralResult(buildPatchNodeWithParentRelayoutResult(get(), id, { visible: !n.visible }));
  },

  toggleLock: (id) => {
    const n = get().nodes[id];
    if (!n) return;
    get().pushHistory();
    commitStructuralResult(buildPatchNodeWithParentRelayoutResult(get(), id, { locked: !n.locked }));
  },

  toggleExpanded: (id) => {
    get().pushHistory();
    commitStructuralResult(buildToggleExpandedResult(get(), id));
  },

  renameNode: (id, name) => {
    get().pushHistory();
    commitStructuralResult(buildRenameNodeResult(get(), id, name));
  },

  addRectangle: () => {
    get().pushHistory();
    commitStructuralResult(buildAddRectangleToolbarResult(get()));
  },

  addText: () => {
    get().pushHistory();
    commitStructuralResult(buildAddTextToolbarResult(get()));
  },

  addRectangleAt: (worldX, worldY) => {
    get().pushHistory();
    const result = buildAddRectangleResult(get(), worldX, worldY);
    commitDocumentMutation(result, (built) => {
      set({
        nodes: built.nodes,
        childOrder: built.childOrder,
        ...(built.ui as {
          selectedIds: string[];
          tool: Tool;
          editingTextId: string | null;
        }),
      });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  addTextAt: (worldX, worldY) => {
    get().pushHistory();
    const result = buildAddTextAtResult(get(), worldX, worldY);
    commitDocumentMutation(result, (built) => {
      set({
        nodes: built.nodes,
        childOrder: built.childOrder,
        ...(built.ui as {
          selectedIds: string[];
          tool: Tool;
          editingTextId: string | null;
          textEditSelection: { anchor: number; focus: number };
        }),
      });
      syncWasmDocumentAfterStoreUpdate();
    });
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLTextAreaElement>(`[data-text-editor="${get().editingTextId}"]`);
      el?.focus();
    });
  },

  createTextBoxFromDrag: (start, end, modifiers) => {
    get().pushHistory();
    const result = buildCreateTextBoxFromDragResult(get(), start, end, modifiers);
    commitDocumentMutation(result, (built) => {
      set({
        nodes: built.nodes,
        childOrder: built.childOrder,
        ...(built.ui as {
          selectedIds: string[];
          tool: Tool;
          editingTextId: string | null;
          textEditSelection: { anchor: number; focus: number };
        }),
      });
      syncWasmDocumentAfterStoreUpdate();
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
      const asset = await resolveImageAssetFromFile(file, {
        workspaceId: get().apiWorkspaceId,
      });
      get().pushHistory();
      commitStructuralResult(buildImportImageAssetResult(get(), asset));
      return asset.id;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not import image.");
      return null;
    }
  },

  importVideoAsset: async (file) => {
    const msg = validateVideoImportFile(file);
    if (msg) {
      window.alert(msg);
      return null;
    }
    try {
      const asset = await buildEditorVideoAssetFromFile(file);
      get().pushHistory();
      commitStructuralResult(buildImportImageAssetResult(get(), asset));
      return asset.id;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not import video.");
      return null;
    }
  },

  importFontFile: async (file) => {
    try {
      const asset = await buildEditorFontAssetFromFile(file);
      get().pushHistory();
      commitStructuralResult(buildImportFontAssetResult(get(), asset));
      return asset.id;
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not import font.");
      return null;
    }
  },

  addImageNodeAt: (assetId, worldX, worldY) => {
    get().pushHistory();
    const result = buildAddImageNodeResult(get(), assetId, worldX, worldY);
    commitDocumentMutation(result, (built) => {
      set({
        nodes: built.nodes,
        childOrder: built.childOrder,
        ...(built.ui as { selectedIds: string[]; tool: Tool }),
      });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  placeImageFilesOnCanvas: async (files, worldX, worldY) => {
    const valid: File[] = [];
    for (const file of files) {
      const msg = validateImageImportFile(file);
      if (msg) {
        window.alert(msg);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return 0;

    const svgImports: Awaited<ReturnType<typeof importSvgFileToEditorGraph>>[] = [];
    const rasterFiles: File[] = [];
    for (const file of valid) {
      if (isSvgLayerImportFile(file)) {
        try {
          const imported = await importSvgFileToEditorGraph(file);
          if (imported) {
            svgImports.push(imported);
            const diag = imported.diagnostics;
            const notes = [
              ...(diag.warnings ?? []),
              ...(diag.unsupportedElements ?? []),
            ];
            if (notes.length > 0) {
              console.warn(`[svg-import] ${file.name}`, notes);
              get().setSvgImportNotice({
                title: `SVG import: ${file.name} — ${notes.length} note${notes.length === 1 ? "" : "s"}`,
                details: notes.slice(0, 12),
              });
            }
          } else {
            window.alert(`Could not import layers from ${file.name}. The SVG may be empty, too large, or unsupported.`);
          }
        } catch (e) {
          window.alert(e instanceof Error ? e.message : `Could not import ${file.name}.`);
        }
        continue;
      }
      rasterFiles.push(file);
    }

    const assetsToAdd: EditorAsset[] = [];
    for (const file of rasterFiles) {
      try {
        assetsToAdd.push(
          await resolveImageAssetFromFile(file, { workspaceId: get().apiWorkspaceId }),
        );
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Could not import image.");
      }
    }

    if (svgImports.length === 0 && assetsToAdd.length === 0) return 0;

    get().pushHistory();
    const result = buildPlaceImportedFilesResult(get(), svgImports, assetsToAdd, worldX, worldY);
    commitStructuralResult(result);
    return (result.ui.selectedIds as string[]).length;
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
      const asset = await resolveImageAssetFromFile(file, {
        workspaceId: get().apiWorkspaceId,
      });
      get().pushHistory();
      commitStructuralResult(buildReplaceImageAssetResult(get(), nodeId, asset));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not replace image.");
    }
  },

  replaceAsset: async (assetId, file) => {
    const msg = validateImageImportFile(file);
    if (msg) {
      window.alert(msg);
      return;
    }
    if (!get().assets[assetId]) return;
    try {
      const asset = await resolveImageAssetFromFile(file, {
        workspaceId: get().apiWorkspaceId,
      });
      get().pushHistory();
      commitStructuralResult(buildReplaceAssetResult(get(), assetId, asset));
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not replace image.");
    }
  },

  deleteAsset: (assetId) => {
    const result = buildDeleteAssetResult(get(), assetId);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  createColorTokenFromSelection: (name) => {
    const result = buildCreateColorTokenFromSelectionResult(get(), name);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  createGradientTokenFromSelection: (name) => {
    const result = buildCreateGradientTokenFromSelectionResult(get(), name);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  createTypographyTokenFromSelection: (name) => {
    const result = buildCreateTypographyTokenFromSelectionResult(get(), name);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  createSpacingToken: (name, value) => {
    const result = buildCreateSpacingTokenResult(get(), name, value);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  createColorToken: (name, hex, opacity = 1) => {
    const result = buildCreateColorTokenResult(get(), name, hex, opacity);
    if (!result) return null;
    get().pushHistory();
    commitStructuralResult(result);
    return (result.ui._createdColorTokenId as string) ?? null;
  },

  seedDesignSystemColorPalette: () => {
    get().pushHistory();
    commitStructuralResult(buildSeedDesignSystemColorPaletteResult(get()));
  },

  updateDesignToken: (id, patch) => {
    const result = buildUpdateDesignTokenResult(get(), id, patch);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  deleteDesignToken: (id) => {
    const result = buildDeleteDesignTokenResult(get(), id);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  applyTokenToSelection: (tokenId) => {
    if (!get().designTokens[tokenId]) return;
    get().pushHistory();
    commitStructuralResult(buildApplyTokenToSelectionResult(get(), tokenId));
  },

  detachTokenFromSelection: (tokenType) => {
    get().pushHistory();
    commitStructuralResult(buildDetachTokenFromSelectionResult(get(), tokenType));
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
    commitStructuralResult(buildAddEffectResult(get(), nodeId, type));
  },

  updateEffect: (nodeId, effectId, patch, opts) => {
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
    if (!opts?.skipHistory) get().pushHistory();
    commitStructuralResult(buildUpdateEffectResult(get(), nodeId, effectId, patch));
  },

  deleteEffect: (nodeId, effectId, opts) => {
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
    if (!opts?.skipHistory) get().pushHistory();
    commitStructuralResult(buildDeleteEffectResult(get(), nodeId, effectId));
  },

  toggleEffect: (nodeId, effectId, opts) => {
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
    if (!opts?.skipHistory) get().pushHistory();
    commitStructuralResult(buildToggleEffectResult(get(), nodeId, effectId));
  },

  createEffectTokenFromSelection: (name) => {
    const result = buildCreateEffectTokenFromSelectionResult(get(), name);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
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
    commitStructuralResult(buildCreateFrameWithBoundsResult(get(), x, y, width, height, opts));
    get().setTool("move");
  },

  addEllipseAt: (worldX, worldY) => {
    get().pushHistory();
    commitStructuralResult(buildAddEllipseResult(get(), worldX, worldY));
  },

  addLineAt: (worldX, worldY) => {
    get().pushHistory();
    commitStructuralResult(buildAddLineResult(get(), worldX, worldY));
  },

  addTriangleAt: (worldX, worldY) => {
    get().pushHistory();
    commitStructuralResult(buildAddTriangleResult(get(), worldX, worldY));
  },

  createShapeFromDrag: (shapeType, start, end, modifiers, style) => {
    get().pushHistory();
    commitStructuralResult(
      buildCreateShapeFromDragResult(get(), shapeType, start, end, modifiers, style),
    );
    get().setTool("move");
  },

  startShapeFromDrag: (shapeType, start, modifiers, style) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    if (s0.frameDrawingSession) get().cancelFrameFromDrag();
    if (s0.textDrawingSession) get().cancelTextFromDrag();
    if (s0.shapeDrawingSession) get().cancelShapeFromDrag();
    get().pushHistory();
    commitStructuralResult(buildStartShapeFromDragResult(get(), shapeType, start, style));
  },

  updateShapeFromDrag: (end, modifiers) => {
    const session = get().shapeDrawingSession;
    if (!session) return;
    const { nodes, childOrder } = get();
    const node = nodes[session.nodeId];
    if (!node) return;
    const drag = worldDragPairInParentSpace(
      node.parentId,
      nodes,
      childOrder,
      session.start,
      end,
    );
    const patch = shapeGeometryPatchFromDrag(
      session.shapeType,
      drag.start,
      drag.end,
      modifiers,
      session.style,
      "live",
    );
    get().updateNode(session.nodeId, patch, { skipHistory: true, allowZeroGeometry: true });
  },

  finishShapeFromDrag: (end, modifiers) => {
    const session = get().shapeDrawingSession;
    if (!session) return;
    const { nodeId, shapeType, start, style } = session;
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    let finalEnd = end;
    let finalMods = modifiers;
    const clickOnly = dist < 4;
    if (clickOnly) {
      finalEnd =
        shapeType === "line" || shapeType === "arrow"
          ? { x: start.x + 120, y: start.y }
          : { x: start.x + 120, y: start.y + 80 };
      finalMods = { shiftKey: false, altKey: false };
    }
    const { nodes, childOrder } = get();
    const node = nodes[nodeId];
    const drag = node
      ? worldDragPairInParentSpace(node.parentId, nodes, childOrder, start, finalEnd)
      : { start, end: finalEnd };
    const patch = shapeGeometryPatchFromDrag(
      shapeType,
      drag.start,
      drag.end,
      finalMods,
      style,
      clickOnly ? "commit" : "live",
    );
    get().updateNode(nodeId, patch, {
      skipHistory: true,
      allowZeroGeometry: !clickOnly,
    });
    if (!clickOnly) {
      const n = get().nodes[nodeId];
      if (n && isZeroAreaDraftNode(n)) {
        get().cancelShapeFromDrag();
        return;
      }
    }
    commitStructuralResult(buildFinishShapeDragResult(get(), nodeId));
    get().setTool("move");
  },

  cancelShapeFromDrag: () => {
    const session = get().shapeDrawingSession;
    if (!session) return;
    commitStructuralResult(
      buildRemoveDraftNodeResult(get(), session.nodeId, "shapeDrawingSession"),
    );
  },

  startFrameFromDrag: (start) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    if (s0.shapeDrawingSession) get().cancelShapeFromDrag();
    if (s0.textDrawingSession) get().cancelTextFromDrag();
    if (s0.frameDrawingSession) get().cancelFrameFromDrag();
    get().pushHistory();
    commitStructuralResult(buildStartFrameFromDragResult(get(), start));
  },

  updateFrameFromDrag: (end, modifiers) => {
    const session = get().frameDrawingSession;
    if (!session) return;
    const { nodes, childOrder } = get();
    const node = nodes[session.nodeId];
    if (!node) return;
    const drag = worldDragPairInParentSpace(
      node.parentId,
      nodes,
      childOrder,
      session.start,
      end,
    );
    const patch = frameGeometryPatchFromDrag(drag.start, drag.end, modifiers, "live");
    get().updateNode(session.nodeId, patch, { skipHistory: true, allowZeroGeometry: true });
  },

  finishFrameFromDrag: (end, modifiers) => {
    const session = get().frameDrawingSession;
    if (!session) return;
    const { nodeId, start } = session;
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist < 4) {
      get().cancelFrameFromDrag();
      get().createFrameAt(start.x, start.y);
      return;
    }
    const { nodes, childOrder } = get();
    const node0 = nodes[nodeId];
    const drag = node0
      ? worldDragPairInParentSpace(node0.parentId, nodes, childOrder, start, end)
      : { start, end };
    const patch = frameGeometryPatchFromDrag(drag.start, drag.end, modifiers, "live");
    get().updateNode(nodeId, patch, { skipHistory: true, allowZeroGeometry: true });
    const n = get().nodes[nodeId];
    if (n && isZeroAreaDraftNode(n)) {
      get().cancelFrameFromDrag();
      return;
    }
    commitStructuralResult(buildFinishFrameDragResult(get(), nodeId));
    get().setTool("move");
  },

  cancelFrameFromDrag: () => {
    const session = get().frameDrawingSession;
    if (!session) return;
    commitStructuralResult(
      buildRemoveDraftNodeResult(get(), session.nodeId, "frameDrawingSession"),
    );
  },

  startTextFromDrag: (start) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    if (s0.shapeDrawingSession) get().cancelShapeFromDrag();
    if (s0.frameDrawingSession) get().cancelFrameFromDrag();
    if (s0.textDrawingSession) get().cancelTextFromDrag();
    get().pushHistory();
    commitStructuralResult(buildStartTextFromDragResult(get(), start));
  },

  updateTextFromDrag: (end, modifiers) => {
    const session = get().textDrawingSession;
    if (!session) return;
    const { nodes, childOrder } = get();
    const node = nodes[session.nodeId];
    if (!node) return;
    const drag = worldDragPairInParentSpace(
      node.parentId,
      nodes,
      childOrder,
      session.start,
      end,
    );
    const patch = textGeometryPatchFromDrag(drag.start, drag.end, modifiers, "live");
    get().updateNode(session.nodeId, patch, { skipHistory: true, allowZeroGeometry: true });
  },

  finishTextFromDrag: (end, modifiers) => {
    const session = get().textDrawingSession;
    if (!session) return;
    const { nodeId, start } = session;
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    const result =
      dist < 4
        ? buildFinishTextDragClickResult(get(), nodeId, start)
        : buildFinishTextDragBoxResult(get(), nodeId, start, end, modifiers);
    if (!result) {
      get().cancelTextFromDrag();
      return;
    }
    commitStructuralResult(result);
    get().setTool("move");
    requestAnimationFrame(() => {
      focusActiveTextEditField(get().editingTextId);
    });
  },

  cancelTextFromDrag: () => {
    const session = get().textDrawingSession;
    if (!session) return;
    commitStructuralResult(
      buildRemoveDraftNodeResult(get(), session.nodeId, "textDrawingSession"),
    );
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
    commitStructuralResult(buildCreateBooleanGroupResult(get(), operation));
  },

  updateBooleanOperation: (groupId, operation) => {
    const g = get().nodes[groupId];
    if (!g?.isBooleanGroup || g.locked) return;
    get().pushHistory();
    commitStructuralResult(buildUpdateBooleanOperationResult(get(), groupId, operation));
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
    commitStructuralResult(buildFlattenBooleanGroupResult(get(), result));
  },

  outlineStrokeSelection: (nodeId?: string) => {
    const s0 = get();
    if (s0.editorMode !== "design") {
      window.alert("Select one shape with a visible stroke to outline.");
      return;
    }
    const id = nodeId ?? s0.selectedIds[0];
    if (!id || (s0.selectedIds.length !== 1 && !nodeId)) {
      window.alert("Select one shape with a visible stroke to outline.");
      return;
    }
    const node = s0.nodes[id];
    if (!node) return;
    if (!canOutlineStroke(node)) {
      window.alert("Select a layer with a visible stroke to outline.");
      return;
    }
    if (node.type === "text") {
      void (async () => {
        try {
          let outlineSeq = 0;
          const converted = await convertTextToOutlineVectorGroup(
            node,
            get().fontAssets,
            (prefix) =>
              `${prefix}-${Date.now()}-${++outlineSeq}-${Math.random().toString(36).slice(2, 7)}`,
          );
          if (!converted) {
            window.alert("Could not outline this text.");
            return;
          }
          const result = buildOutlineTextToVectorsResult(
            get(),
            id,
            converted.group,
            converted.vectors,
          );
          if (!result) {
            window.alert("Could not outline this text.");
            return;
          }
          get().pushHistory();
          commitStructuralResult(result);
        } catch {
          window.alert("Could not outline this text.");
        }
      })();
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
    commitStructuralResult(buildOutlineStrokeSelectionResult(get(), id, converted, removeKids));
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
    const result = buildUseSelectionAsMaskResult(get());
    if (!result) {
      window.alert("Mask requires shapes on the same level.");
      return;
    }
    get().pushHistory();
    commitStructuralResult(result);
  },

  releaseMask: (maskGroupId) => {
    const result = buildReleaseMaskResult(get(), maskGroupId);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  setNodeAsMask: (nodeId, isMask) => {
    const n = get().nodes[nodeId];
    if (!n || n.locked) return;
    get().pushHistory();
    commitStructuralResult(buildSetNodeAsMaskResult(get(), nodeId, isMask));
  },

  duplicateSelection: () => {
    if (editableTopLevelSelection(get()).length === 0) return;
    get().pushHistory();
    const s = get();
    const tops = editableTopLevelSelection(s);
    if (!selectionMatchesDuplicateChain(tops)) {
      resetDuplicateRepeatOffset();
    }
    const result = buildDuplicateSelectionResult(s, getDuplicateStepOffset(tops));
    commitStructuralResult(result);
    if (result) {
      recordDuplicateCreated(
        result.ui.selectedIds as string[],
        result.nodes,
        result.childOrder,
      );
    }
  },

  cloneSelectionInPlace: () => {
    if (editableTopLevelSelection(get()).length === 0) return [];
    const s = get();
    // Option/Alt drag: always clone on top of the selection (no Cmd+D repeat step).
    const result = buildDuplicateSelectionResult(s, null);
    commitStructuralResult(result);
    return get().selectedIds;
  },

  alignSelection: (direction) => {
    if (!canAlignSelection(get().selectedIds, get().nodes, get().childOrder)) return;
    get().pushHistory();
    commitStructuralResult(buildAlignSelectionResult(get(), direction));
  },

  alignSelectionToGrid: (row, col) => {
    if (!canAlignSelection(get().selectedIds, get().nodes, get().childOrder)) return;
    get().pushHistory();
    commitStructuralResult(buildAlignSelectionGridResult(get(), row, col));
  },

  distributeSelection: (axis) => {
    const tops0 = alignableSelectionIds(get().selectedIds, get().nodes);
    if (tops0.length < 3) return;
    get().pushHistory();
    commitStructuralResult(buildDistributeSelectionResult(get(), axis));
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
        selectedPathPointIds: [],
      };
    }),

  toggleLockSelection: () => {
    if (!get().selectedIds.length) return;
    get().pushHistory();
    commitStructuralResult(buildToggleLockSelectionResult(get()));
  },

  toggleVisibleSelection: () => {
    if (!get().selectedIds.length) return;
    get().pushHistory();
    commitStructuralResult(buildToggleVisibleSelectionResult(get()));
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
    get().pushHistory();
    commitStructuralResult(
      buildPasteSelectionResult(get(), payload, opts?.inPlace ? 0 : 24),
    );
  },

  deleteSelection: (opts) => {
    const edit = get().activeSlotEdit;
    if (edit) {
      const tops = editableTopLevelSelection(get()).filter((id) =>
        isDeletableDuringSlotEdit(get().nodes, edit, id),
      );
      if (tops.length === 0) return;
      if (tops.length !== get().selectedIds.length) {
        set({ selectedIds: tops });
      }
    }
    if (editableTopLevelSelection(get()).length === 0) return;
    if (!opts?.skipHistory) get().pushHistory();
    const result = buildDeleteSelectionResult(get());
    commitDocumentMutation(result, (built) => {
      set({
        nodes: built.nodes,
        childOrder: built.childOrder,
        ...(built.ui as {
          selectedIds: string[];
          editingTextId: string | null;
          pathEditModeNodeId: string | null;
          selectedPathPointIds: string[];
        }),
      });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  bringForward: () => {
    if (editableTopLevelSelection(get()).length === 0) return;
    get().pushHistory();
    const result = buildZOrderResult(get(), "forward");
    commitDocumentMutation(result, (built) => {
      set({ nodes: built.nodes, childOrder: built.childOrder });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  sendBackward: () => {
    if (editableTopLevelSelection(get()).length === 0) return;
    get().pushHistory();
    const result = buildZOrderResult(get(), "backward");
    commitDocumentMutation(result, (built) => {
      set({ nodes: built.nodes, childOrder: built.childOrder });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  bringToFront: () => {
    if (editableTopLevelSelection(get()).length === 0) return;
    get().pushHistory();
    const result = buildZOrderResult(get(), "front");
    commitDocumentMutation(result, (built) => {
      set({ nodes: built.nodes, childOrder: built.childOrder });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  sendToBack: () => {
    if (editableTopLevelSelection(get()).length === 0) return;
    get().pushHistory();
    const result = buildZOrderResult(get(), "back");
    commitDocumentMutation(result, (built) => {
      set({ nodes: built.nodes, childOrder: built.childOrder });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  nudgeSelection: (dx, dy) => {
    const result = buildNudgeSelectionResult(get(), dx, dy);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
    const st = get();
    refreshDuplicateStepAfterMove(st.selectedIds, st.nodes, st.childOrder);
  },

  setPencilStrokeWidth: (width) => {
    set({ pencilStrokeWidth: clampStrokeWidth(width) });
  },

  setSelectionStrokeWidth: (width) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    const tops = topLevelSelectedIds(s0.selectedIds, s0.nodes).filter((id) => {
      const n = s0.nodes[id];
      return n && !n.locked && n.visible && nodeSupportsStrokeWidth(n);
    });
    if (tops.length === 0) return;
    get().pushHistory();
    commitStructuralResult(buildSetSelectionStrokeWidthResult(get(), width));
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
    commitStructuralResult(buildNudgeSelectionStrokeWidthResult(get(), delta));
  },

  reorderAutoLayoutChildByArrow: (arrowCode, shiftKey = false) => {
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
      shiftKey,
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
    commitStructuralResult(buildSwapAutoLayoutSiblingsResult(get(), idA, idB));
  },

  groupSelection: () => {
    const result = buildGroupSelectionResult(get());
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  addAutoLayoutToSelection: () => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    if (!canAddAutoLayoutToSelection(s0.selectedIds, s0.nodes)) return;
    const result = applyAutoLayoutToSelection(s0.nodes, s0.childOrder, s0.selectedIds);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(buildAutoLayoutMutationResult(result));
  },

  addAutoLayoutToContainer: (containerId) => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    const n = s0.nodes[containerId];
    if (!n || n.locked || !n.visible || (n.type !== "frame" && n.type !== "group")) return;
    const result = applyAutoLayoutToContainer(s0.nodes, s0.childOrder, containerId);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(buildAutoLayoutMutationResult(result));
  },

  wrapSelectionInFrame: () => {
    const s0 = get();
    if (s0.editorMode !== "design") return;
    if (!canAddAutoLayoutToSelection(s0.selectedIds, s0.nodes)) return;
    const result = applyWrapSelectionInFrame(s0.nodes, s0.childOrder, s0.selectedIds);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(buildAutoLayoutMutationResult(result));
  },

  ungroupSelection: () => {
    const result = buildUngroupSelectionResult(get());
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  toggleSelectNode: (id) => {
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((x) => x !== id)
        : [...s.selectedIds, id],
    }));
    const st = get();
    syncDuplicateRepeatSelection(st.selectedIds, st.nodes);
  },

  setSelection: (ids) => {
    set({
      selectedIds: ids,
      selectedLayoutGuideId: null,
      editingTextId: null,
      contextMenu: null,
      selectedPrototypeLinkId: null,
      pathEditModeNodeId: null,
      objectEditModeNodeId: null,
      selectedPathPointIds: [],
    });
    const st = get();
    syncDuplicateRepeatSelection(st.selectedIds, st.nodes);
  },

  setGuides: (guides) => set({ guides, dragMeasurements: [] }),
  setSnapOverlay: (guides, dragMeasurements) =>
    set((s) => {
      if (
        s.guides === guides &&
        s.dragMeasurements === dragMeasurements
      ) {
        return s;
      }
      if (
        s.guides.length === guides.length &&
        s.dragMeasurements.length === dragMeasurements.length &&
        s.guides.every(
          (g, i) =>
            g.axis === guides[i]?.axis &&
            g.pos === guides[i]?.pos &&
            g.from === guides[i]?.from &&
            g.to === guides[i]?.to,
        ) &&
        s.dragMeasurements.every(
          (m, i) =>
            m.x1 === dragMeasurements[i]?.x1 &&
            m.y1 === dragMeasurements[i]?.y1 &&
            m.x2 === dragMeasurements[i]?.x2 &&
            m.y2 === dragMeasurements[i]?.y2 &&
            m.distance === dragMeasurements[i]?.distance,
        )
      ) {
        return s;
      }
      return { guides, dragMeasurements };
    }),
  setSwapDragIndicator: (swapDragIndicator) => set({ swapDragIndicator }),
  setAutoLayoutReorderIndicator: (autoLayoutReorderIndicator) =>
    set({ autoLayoutReorderIndicator }),
  setLayoutGuideDraft: (layoutGuideDraft) => set({ layoutGuideDraft }),
  cancelLayoutGuideDraft: () => set({ layoutGuideDraft: null }),
  commitLayoutGuide: () => {
    const result = buildCommitLayoutGuideResult(get());
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  reorderNode: (id, targetParentId, targetIndex) => {
    const result = buildReorderNodeResult(get(), id, targetParentId, targetIndex);
    commitDocumentMutation(result, (built) => {
      set({ nodes: built.nodes, childOrder: built.childOrder });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  moveNodeToParent: (id, newParentId, index) => {
    const result = buildMoveNodeToParentResult(get(), id, newParentId, index);
    commitDocumentMutation(result, (built) => {
      set({ nodes: built.nodes, childOrder: built.childOrder });
      syncWasmDocumentAfterStoreUpdate();
    });
  },

  updateLayout: (id, patch) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked || (n0.type !== "frame" && n0.type !== "group")) return;
    get().pushHistory();
    commitStructuralResult(buildUpdateLayoutResult(get(), id, patch));
  },

  updateLayoutSizing: (id, axis, mode) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked) return;
    get().pushHistory();
    commitStructuralResult(buildUpdateLayoutSizingResult(get(), id, axis, mode));
  },

  updateLayoutPositioning: (id, positioning) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked) return;
    get().pushHistory();
    commitStructuralResult(buildUpdateLayoutPositioningResult(get(), id, positioning));
  },

  updateConstraints: (id, patch) => {
    const s0 = get();
    const n0 = s0.nodes[id];
    if (!n0 || n0.locked) return;
    get().pushHistory();
    commitStructuralResult(buildUpdateConstraintsResult(get(), id, patch));
  },

  applyAutoLayout: (parentId) => {
    const s0 = get();
    const p0 = s0.nodes[parentId];
    if (!p0 || (p0.type !== "frame" && p0.type !== "group")) return;
    get().pushHistory();
    commitStructuralResult(buildApplyAutoLayoutResult(get(), parentId));
  },

  createComponentFromSelection: () => {
    const result = buildCreateComponentFromSelectionResult(get());
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  createComponentSetFromSelection: () => {
    const s = get();
    const result = buildCreateComponentSetFromSelectionResult(
      s.nodes,
      s.childOrder,
      s.selectedIds,
    );
    if (!result) return;
    get().pushHistory();
    commitStructuralResult({
      nodes: result.nodes,
      childOrder: result.childOrder,
      ui: {
        selectedIds: [result.setContainerId],
        leftTab: "components" as LeftTab,
      },
    });
  },

  combineAsVariants: () => {
    get().createComponentSetFromSelection();
  },

  createInstance: (componentKey, worldX, worldY) => {
    const result = buildCreateInstanceResult(get(), componentKey, worldX, worldY);
    if (!result) return;
    const masterId = resolveMasterRootId(result.nodes, componentKey);
    if (masterId) recordRecentComponent(masterId);
    get().pushHistory();
    commitStructuralResult(result);
  },

  detachInstance: (instanceRootId) => {
    const result = buildDetachInstanceResult(get(), instanceRootId);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  updateInstanceOverride: (instanceRootId, targetNodeId, patch) => {
    const result = buildUpdateInstanceOverrideResult(get(), instanceRootId, targetNodeId, patch);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  createVariantFromComponent: (componentKey) => {
    const result = buildCreateVariantFromComponentResult(get(), componentKey);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  updateVariantProperties: (componentKey, properties) => {
    const result = buildUpdateVariantPropertiesResult(get(), componentKey, properties);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  addVariantPropertyAxis: (masterId, axis, defaultValue) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || master.locked) return;
    get().pushHistory();
    if (!master.variantGroupId) {
      const vg = newVariantGroupId();
      set({
        nodes: {
          ...get().nodes,
          [masterId]: {
            ...master,
            variantGroupId: vg,
            variantProperties: { ...(master.variantProperties ?? {}), [axis]: defaultValue },
          },
        },
      });
      return;
    }
    set({
      nodes: addPropertyToSet(get().nodes, master.variantGroupId, axis, defaultValue) ?? get().nodes,
    });
  },

  renameVariantProperty: (masterId, oldName, newName) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || !master.variantGroupId || master.locked) return;
    const next = renamePropertyInSet(get().nodes, master.variantGroupId, oldName, newName);
    if (!next) return;
    get().pushHistory();
    set({ nodes: next });
  },

  deleteVariantProperty: (masterId, propertyName) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || !master.variantGroupId || master.locked) return;
    const next = deletePropertyFromSet(get().nodes, master.variantGroupId, propertyName);
    if (!next) return;
    get().pushHistory();
    set({ nodes: next });
  },

  addVariantPropertyValue: (masterId, propertyName, value) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || master.locked) return;
    const result = addVariantForPropertyValue(get().nodes, get().childOrder, masterId, propertyName, value);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult({
      nodes: result.nodes,
      childOrder: result.childOrder,
      ui: { selectedIds: [result.newMasterId] },
    });
  },

  duplicateVariantMaster: (masterId) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || master.locked) return;
    const result = buildDuplicateVariantMasterResult(get().nodes, get().childOrder, masterId);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult({
      nodes: result.nodes,
      childOrder: result.childOrder,
      ui: { selectedIds: [result.newMasterId] },
    });
  },

  deleteVariantMaster: (masterId) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || master.locked) return;
    const result = buildDeleteVariantMasterResult(get().nodes, get().childOrder, masterId);
    if (!result) return;
    const remaining = Object.values(result.nodes).find(
      (n) => n.isComponent && n.variantGroupId === master.variantGroupId,
    );
    get().pushHistory();
    commitStructuralResult({
      ...result,
      ui: { selectedIds: remaining ? [remaining.id] : [] },
    });
  },

  goToMainComponent: (instanceRootId) => {
    const masterId = buildGoToMainComponentSelection(get().nodes, instanceRootId);
    if (!masterId) return;
    get().select(masterId, false);
  },

  resetInstanceOverrides: (instanceRootId, stableId, propertyPath) => {
    const next = buildResetInstanceOverridesResult(get().nodes, instanceRootId, stableId, propertyPath);
    if (!next) return;
    const resolved = resolveComponentInstance(next, get().childOrder, instanceRootId, { force: true });
    get().pushHistory();
    set({ nodes: resolved.nodes, childOrder: resolved.childOrder });
  },

  swapInstanceComponent: (instanceRootId, newMasterKey) => {
    const result = buildSwapInstanceComponentResult(get().nodes, get().childOrder, instanceRootId, newMasterKey);
    if (!result) return;
    const resolved = resolveComponentInstance(result.nodes, result.childOrder, result.newRootId, {
      force: true,
    });
    get().pushHistory();
    commitStructuralResult({
      ...result,
      nodes: resolved.nodes,
      childOrder: resolved.childOrder,
      ui: { selectedIds: [result.newRootId] },
    });
  },

  setInstanceVariant: (instanceRootId, variantProperties) => {
    const result = buildSetInstanceVariantResult(get().nodes, get().childOrder, instanceRootId, variantProperties);
    if (!result) return;
    const resolved = resolveComponentInstance(result.nodes, result.childOrder, result.newRootId, {
      force: true,
    });
    get().pushHistory();
    commitStructuralResult({
      ...result,
      nodes: resolved.nodes,
      childOrder: resolved.childOrder,
      ui: { selectedIds: [result.newRootId] },
    });
  },

  pushInstanceChangesToMain: (instanceRootId) => {
    const out = pushInstanceOverridesToMaster(get().nodes, instanceRootId);
    if (!out) return;
    const layerNodeId = get().nodes[instanceRootId]?.sourceComponentId;
    const refresh = new Set<string>();
    let nodes = out.nodes;
    let childOrder = get().childOrder;
    if (layerNodeId) {
      const propagated = applyMasterComponentDocumentChanges(nodes, childOrder, refresh, {
        changedNodeIds: [layerNodeId],
        reason: "push-to-main",
      });
      nodes = propagated.nodes;
      childOrder = propagated.childOrder;
      if (refresh.size > 0) {
        nodes = relayoutParentsWithAutoLayout(nodes, childOrder, refresh);
      }
    }
    get().pushHistory();
    set({ nodes, childOrder });
  },

  setComponentDescription: (masterId, description) => {
    const n = get().nodes[masterId];
    if (!n?.isComponent) return;
    get().pushHistory();
    set({ nodes: { ...get().nodes, [masterId]: { ...n, componentDescription: description } } });
  },

  addComponentProperty: (masterId, property) => {
    const n = get().nodes[masterId];
    if (!n?.isComponent) return;
    const defs = [...(n.componentPropertyDefs ?? []), property];
    get().pushHistory();
    set({ nodes: { ...get().nodes, [masterId]: { ...n, componentPropertyDefs: defs } } });
  },

  setComponentPropertyValue: (instanceRootId, propertyKey, value) => {
    const root = get().nodes[instanceRootId];
    if (!root?.sourceComponentId) return;
    const master = get().nodes[root.sourceComponentId];
    const defs = master?.componentPropertyDefs ?? [];
    const def = defs.find((d) => d.key === propertyKey);
    if (!def) return;
    const values = { ...(root.componentPropertyValues ?? {}), [propertyKey]: value };

    let nextNodes: Record<string, EditorNode>;
    if (def.kind === "instanceSwap") {
      nextNodes = {
        ...get().nodes,
        [instanceRootId]: { ...root, componentPropertyValues: values },
      };
    } else if (def.kind === "slot") {
      return;
    } else {
      const overrideMap = applyComponentPropertyDefs({ ...root, componentPropertyValues: values }, values, defs);
      nextNodes = {
        ...get().nodes,
        [instanceRootId]: writeInstanceOverrideState({ ...root, componentPropertyValues: values }, overrideMap),
      };
    }

    const resolved = resolveComponentInstance(nextNodes, get().childOrder, instanceRootId, { force: true });
    get().pushHistory();
    set({ nodes: resolved.nodes, childOrder: resolved.childOrder });
  },

  resetComponentPropertyValue: (instanceRootId, propertyKey) => {
    const root = get().nodes[instanceRootId];
    const master = root?.sourceComponentId ? get().nodes[root.sourceComponentId] : null;
    const def = master?.componentPropertyDefs?.find((d) => d.key === propertyKey);
    const next =
      def?.kind === "slot"
        ? buildResetSlotContentResult(get().nodes, instanceRootId, propertyKey)
        : buildResetComponentPropertyValueResult(get().nodes, instanceRootId, propertyKey);
    if (!next) return;
    const resolved = resolveComponentInstance(next, get().childOrder, instanceRootId, { force: true });
    get().pushHistory();
    set({ nodes: resolved.nodes, childOrder: resolved.childOrder });
  },

  createInstanceSwapPropertyFromSelection: (masterId, nestedInstanceNodeId, label) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || master.locked) return;
    const def = buildInstanceSwapPropertyForNestedInstance(
      get().nodes,
      masterId,
      nestedInstanceNodeId,
      label,
    );
    if (!def) return;
    const defs = [...(master.componentPropertyDefs ?? []), def];
    get().pushHistory();
    set({ nodes: { ...get().nodes, [masterId]: { ...master, componentPropertyDefs: defs } } });
  },

  updateComponentProperty: (masterId, propertyId, patch) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || master.locked) return;
    const defs = (master.componentPropertyDefs ?? []).map((d) =>
      d.id === propertyId ? { ...d, ...patch } : d,
    );
    get().pushHistory();
    set({ nodes: { ...get().nodes, [masterId]: { ...master, componentPropertyDefs: defs } } });
  },

  createSlotPropertyFromSelection: (masterId, containerNodeId, label) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || master.locked) return;
    const def = buildSlotPropertyForContainer(
      get().nodes,
      get().childOrder,
      masterId,
      containerNodeId,
      label,
    );
    if (!def) return;
    const defs = [...(master.componentPropertyDefs ?? []), def];
    get().pushHistory();
    set({ nodes: { ...get().nodes, [masterId]: { ...master, componentPropertyDefs: defs } } });
  },

  setSlotContent: (instanceRootId, propertyKey, snapshot) => {
    const next = buildSetSlotContentResult(get().nodes, get().childOrder, instanceRootId, propertyKey, snapshot);
    if (!next) return;
    const resolved = resolveComponentInstance(next, get().childOrder, instanceRootId, { force: true });
    get().pushHistory();
    set({ nodes: resolved.nodes, childOrder: resolved.childOrder });
  },

  resetSlotContent: (instanceRootId, propertyKey) => {
    get().resetComponentPropertyValue(instanceRootId, propertyKey);
  },

  enterSlotEditMode: (instanceRootId, propertyKey, priorBreadcrumb) => {
    const scope = resolveSlotEditScope(get().nodes, get().childOrder, instanceRootId, propertyKey);
    if (!scope) return;
    const baseline = captureSlotContentFromInstance(
      get().nodes,
      get().childOrder,
      instanceRootId,
      propertyKey,
    );
    const breadcrumb = buildSlotEditBreadcrumb(get().nodes, scope, priorBreadcrumb ?? []);
    set({
      activeSlotEdit: {
        instanceRootId,
        propertyKey,
        containerId: scope.containerId,
        baselineSignature: snapshotContentSignature(
          baseline ?? { version: 1, nodes: {}, childOrder: {}, rootChildIds: [] },
        ),
        breadcrumb,
      },
      objectEditModeNodeId: scope.containerId,
      selectedIds: [scope.containerId],
      pathEditModeNodeId: null,
      shapeEditModeNodeId: null,
      componentInteractionPreview: false,
    });
  },

  exitSlotEditMode: (save = true) => {
    const edit = get().activeSlotEdit;
    if (!edit) return;
    if (save) {
      const snapshot = captureSlotContentFromInstance(
        get().nodes,
        get().childOrder,
        edit.instanceRootId,
        edit.propertyKey,
      );
      const changed = slotContentChanged(edit.baselineSignature, snapshot);
      if (changed && snapshot) {
        const next = buildSetSlotContentResult(
          get().nodes,
          get().childOrder,
          edit.instanceRootId,
          edit.propertyKey,
          snapshot,
        );
        if (next) {
          const resolved = resolveComponentInstance(next, get().childOrder, edit.instanceRootId, {
            force: true,
          });
          get().pushHistory();
          set({
            nodes: resolved.nodes,
            childOrder: resolved.childOrder,
            activeSlotEdit: null,
            objectEditModeNodeId: null,
          });
          return;
        }
      }
    }
    set({ activeSlotEdit: null, objectEditModeNodeId: null });
  },

  navigateSlotEditBreadcrumb: (index) => {
    const edit = get().activeSlotEdit;
    if (!edit) return;
    const crumb = edit.breadcrumb[index];
    if (!crumb) return;
    const prior = edit.breadcrumb.slice(0, index);
    get().exitSlotEditMode(true);
    get().enterSlotEditMode(crumb.instanceRootId, crumb.propertyKey, prior);
  },

  pasteIntoActiveSlot: () => {
    if (!get().activeSlotEdit) {
      get().pasteSelection();
      return;
    }
    get().pasteSelection({ inPlace: true });
  },

  setComponentInteractionPreview: (enabled) => {
    if (!enabled) {
      set({
        componentInteractionPreview: false,
        nodes: clearEphemeralInteractiveFields(get().nodes),
      });
      return;
    }
    set({ componentInteractionPreview: true });
  },

  setComponentInteractions: (masterId, interactions) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || !master.variantGroupId || master.locked) return;
    get().pushHistory();
    set({
      nodes: syncInteractionsToVariantGroup(get().nodes, master.variantGroupId, interactions),
    });
  },

  addComponentInteraction: (masterId, interaction) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || !master.variantGroupId || master.locked) return;
    const existing = master.componentInteractions ?? [];
    get().pushHistory();
    set({
      nodes: syncInteractionsToVariantGroup(get().nodes, master.variantGroupId, [...existing, interaction]),
    });
  },

  updateComponentInteraction: (masterId, interactionId, patch) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || !master.variantGroupId || master.locked) return;
    const existing = master.componentInteractions ?? [];
    const next = existing.map((it) => (it.id === interactionId ? { ...it, ...patch } : it));
    get().pushHistory();
    set({
      nodes: syncInteractionsToVariantGroup(get().nodes, master.variantGroupId, next),
    });
  },

  removeComponentInteraction: (masterId, interactionId) => {
    const master = get().nodes[masterId];
    if (!master?.isComponent || !master.variantGroupId || master.locked) return;
    const existing = master.componentInteractions ?? [];
    get().pushHistory();
    set({
      nodes: syncInteractionsToVariantGroup(
        get().nodes,
        master.variantGroupId,
        existing.filter((it) => it.id !== interactionId),
      ),
    });
  },

  triggerInstanceInteraction: (instanceRootId, trigger) => {
    const result = applyInstanceInteractionTrigger(get().nodes, get().childOrder, instanceRootId, trigger);
    if (!result) return;
    const parentId = result.nodes[result.newRootId]?.parentId;
    let nodes = result.nodes;
    let childOrder = result.childOrder;
    if (parentId) {
      nodes = relayoutParentsWithAutoLayout(nodes, childOrder, [parentId]);
    }
    set({ nodes, childOrder, selectedIds: get().selectedIds.map((id) => (id === instanceRootId ? result.newRootId : id)) });
  },

  clearInteractiveInstanceStates: () => {
    set({ nodes: clearEphemeralInteractiveFields(get().nodes) });
  },

  duplicateSingle: (id) => {
    const s0 = get();
    const tops0 = topLevelSelectedIds([id], s0.nodes).filter((tid) => {
      const nn = s0.nodes[tid];
      return nn && !nn.locked && nn.visible;
    });
    if (tops0.length === 0) return;
    if (!s0.nodes[tops0[0]!]) return;
    if (!selectionMatchesDuplicateChain(tops0)) {
      resetDuplicateRepeatOffset();
    }
    const result = buildDuplicateSingleResult(s0, id, getDuplicateStepOffset(tops0));
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
    recordDuplicateCreated(result.ui.selectedIds as string[], result.nodes, result.childOrder);
  },

  deleteSingle: (id) => {
    if (!isDeletableDuringSlotEdit(get().nodes, get().activeSlotEdit, id)) return;
    const result = buildDeleteSingleResult(get(), id);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  resizeNode: (id, handle, startBounds, currentPoint, modifiers, opts) => {
    if (get().transformInteractionMode === "rotate") return;
    if (isRotateGeometryLockActive(get())) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const pre = get();
      const n0 = pre.nodes[id];
      if (n0 && !n0.locked && n0.visible) get().pushHistory();
    }
    const result = buildResizeNodeResult(
      get(),
      id,
      handle,
      startBounds,
      currentPoint,
      modifiers,
      opts,
    );
    if (!result) return;
    const isLiveResizePreview =
      Boolean(opts?.skipHistory) && get().transformInteractionMode === "resize";
    if (isLiveResizePreview) {
      applyResizePreviewToStore(result);
      return;
    }
    commitStructuralResult(result);
  },

  resizeFrameWithConstraints: (frameId, newBounds, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) {
      const n0 = get().nodes[frameId];
      if (n0 && !n0.locked) get().pushHistory();
    }
    commitStructuralResult(buildResizeFrameWithConstraintsResult(get(), frameId, newBounds, opts));
  },

  openResponsivePreview: (frameId) => {
    commitStructuralResult(buildOpenResponsivePreviewResult(get(), frameId));
  },

  updateResponsivePreviewBounds: (width, height) => {
    const nodesBefore = get().nodes;
    const rp = get().responsivePreview;
    const result = buildUpdateResponsivePreviewBoundsResult(get(), width, height);
    if (!result) return;
    commitStructuralResult(result);
    if (!rp) return;
    const stAfter = get();
    const nodesAfter = stAfter.nodes;
    const candidateIds = new Set<string>([rp.frameId]);
    const stack = [rp.frameId];
    while (stack.length > 0) {
      const pid = stack.pop()!;
      for (const cid of stAfter.childOrder[pid] ?? []) {
        candidateIds.add(cid);
        stack.push(cid);
      }
    }
    const entries: Array<{ nodeId: string; patch: Partial<EditorNode>; node: EditorNode }> = [];
    for (const nodeId of candidateIds) {
      const before = nodesBefore[nodeId];
      const after = nodesAfter[nodeId];
      if (!after) continue;
      const patch: Partial<EditorNode> = {};
      if (before?.x !== after.x) patch.x = after.x;
      if (before?.y !== after.y) patch.y = after.y;
      if (before?.width !== after.width) patch.width = after.width;
      if (before?.height !== after.height) patch.height = after.height;
      if (Object.keys(patch).length === 0) continue;
      entries.push({ nodeId, patch, node: after });
    }
    if (entries.length > 0) {
      const mirrored = mirrorGeometryPatchesToWasm(entries);
      if (!mirrored) syncWasmDocumentAfterStoreUpdate();
    }
  },

  resetResponsivePreview: () => {
    commitStructuralResult(buildResetResponsivePreviewResult(get()));
  },

  cancelResponsivePreview: () => {
    commitStructuralResult(buildCancelResponsivePreviewResult(get()));
  },

  applyResponsivePreview: () => {
    const rp = get().responsivePreview;
    if (!rp) return;
    const { frameId, draftWidth, draftHeight } = rp;
    commitStructuralResult(buildRestoreResponsivePreviewGeomResult(get()));
    get().pushHistory();
    get().resizeFrameWithConstraints(frameId, { width: draftWidth, height: draftHeight }, { skipHistory: true });
  },

  toggleGrid: () => {
    get().pushHistory();
    commitStructuralResult(buildToggleGridResult(get()));
  },

  toggleRulers: () => {
    get().pushHistory();
    commitStructuralResult(buildToggleRulersResult(get()));
  },

  setCanvasBackgroundColor: (hex, opts) => {
    const normalized = normalizeHex(hex.startsWith("#") ? hex : `#${hex}`);
    if (!normalized) return;
    const s = get();
    if (s.canvasBackgroundColor === normalized) return;
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    commitStructuralResult(buildSetCanvasBackgroundColorResult(get(), hex));
  },

  setCanvasColorMode: (mode) => {
    const s = get();
    if (s.canvasColorMode === mode) return;
    set({ canvasColorMode: mode });
    bumpTextLayoutEpoch();
  },

  rehydrateProjectColorTokensIfNeeded: async () => {
    const s = get();
    if (!s.codeRoundTripLink?.repoRoot && s.projectCssSources.length === 0) return;
    try {
      const patch = await rehydrateProjectColorContext({
        nodes: s.nodes,
        designTokens: s.designTokens,
        projectCssSources: s.projectCssSources,
        codeRoundTripLink: s.codeRoundTripLink,
        canvasColorMode: s.canvasColorMode,
      });
      if (!patch) return;
      set((state) => {
        const merged = {
          ...state,
          nodes: patch.nodes,
          designTokens: patch.designTokens,
          projectCssSources: patch.projectCssSources,
        };
        return { ...merged, ...syncActivePageRecord(merged) };
      });
      bumpTextLayoutEpoch();
    } catch (e) {
      console.warn("[Paytm Craft] project color rehydrate failed", e);
    }
  },

  importStorybookComponents: async (opts = {}) => {
    const s = get();
    if (!s.codeRoundTripLink?.repoRoot && !s.storybookUrl) {
      return {
        ok: false,
        message: "Connect a linked repo and run Storybook (npm run storybook, usually port 6006).",
      };
    }
    try {
      type ImportBody =
        | {
            ok: true;
            slice: EditorPersistSlice;
            message: string;
            imported: number;
            remaining: number;
            storyCount: number;
            totalImported: number;
          }
        | { error: string };

      let slice = toPersistSlice(s);
      let lastBody: Extract<ImportBody, { ok: true }> | null = null;
      let importedTotal = 0;

      for (let batch = 0; batch < 12; batch++) {
        const res = await bridgeFetch("/api/craft-bridge/import-storybook-components", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            slice,
            link: s.codeRoundTripLink,
            storybookUrl: s.storybookUrl,
            force: opts.force ?? true,
          }),
        });
        const body = (await res.json()) as ImportBody;
        if (!res.ok || !("slice" in body)) {
          const message = "error" in body ? body.error : `Storybook import failed (${res.status})`;
          set({ storybookSyncMessage: message });
          return {
            ok: false,
            message,
          };
        }
        lastBody = body;
        importedTotal += body.imported;
        slice = body.slice;
        if (body.remaining <= 0 || body.imported <= 0) break;
      }

      if (!lastBody) {
        return { ok: false, message: "Storybook import failed." };
      }

      set((state) => {
        const merged = {
          ...state,
          nodes: lastBody.slice.nodes,
          childOrder: lastBody.slice.childOrder,
          assets: lastBody.slice.assets ?? state.assets,
          designTokens: lastBody.slice.designTokens ?? state.designTokens,
          projectCssSources: lastBody.slice.projectCssSources ?? state.projectCssSources,
          storybookUrl: lastBody.slice.storybookUrl,
          storybookCatalogHash: lastBody.slice.storybookCatalogHash,
          leftTab: "components" as LeftTab,
          storybookSyncMessage: lastBody.message,
        };
        return { ...merged, ...syncActivePageRecord(merged) };
      });
      bumpTextLayoutEpoch();
      get().saveToLocal();
      return {
        ok: true,
        message: lastBody.message,
        imported: importedTotal,
        remaining: lastBody.remaining,
        storyCount: lastBody.storyCount,
        totalImported: lastBody.totalImported,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Storybook import failed.";
      set({ storybookSyncMessage: message });
      return {
        ok: false,
        message,
      };
    }
  },

  rehydrateProjectStorybookComponentsIfNeeded: async () => {
    const s = get();
    if (!s.codeRoundTripLink?.repoRoot && !s.storybookUrl) return;
    try {
      const res = await bridgeFetch("/api/craft-bridge/rehydrate-storybook-components", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodes: s.nodes,
          childOrder: s.childOrder,
          assets: s.assets,
          designTokens: s.designTokens,
          projectCssSources: s.projectCssSources,
          codeRoundTripLink: s.codeRoundTripLink,
          canvasColorMode: s.canvasColorMode,
          storybookUrl: s.storybookUrl,
          storybookCatalogHash: s.storybookCatalogHash,
        }),
      });
      const body = (await res.json()) as
        | {
            ok: true;
            patch: {
              nodes: typeof s.nodes;
              childOrder: typeof s.childOrder;
              assets: typeof s.assets;
              storybookUrl?: string;
              storybookCatalogHash?: string;
            } | null;
            hint?: string;
          }
        | { error: string };
      if (!res.ok || !("ok" in body)) {
        const message = "error" in body ? body.error : "Storybook rehydrate failed.";
        set({ storybookSyncMessage: message });
        return;
      }
      if (body.hint && !body.patch) {
        set({ storybookSyncMessage: body.hint });
        return;
      }
      if (!body.patch) return;
      const patch = body.patch;
      set({ storybookSyncMessage: null });
      set((state) => {
        const merged = {
          ...state,
          nodes: patch.nodes,
          childOrder: patch.childOrder,
          assets: patch.assets,
          storybookUrl: patch.storybookUrl,
          storybookCatalogHash: patch.storybookCatalogHash,
        };
        return { ...merged, ...syncActivePageRecord(merged) };
      });
      bumpTextLayoutEpoch();
    } catch (e) {
      console.warn("[Paytm Craft] Storybook component rehydrate failed", e);
    }
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
    const result = buildAddCommentResult(get(), point, parentNodeIdOverride);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
    const localId = result.ui._newCommentId as string;
    const next = get().comments.find((c) => c.id === localId);
    if (!next) return;

    const st2 = get();
    if (!isPaytmCraftHttpApiMode() || !st2.isApiBackedFile || !st2.apiFileId) return;

    const fileId = st2.apiFileId;
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
    const result = buildUpdateCommentResult(get(), id, body);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
    if (!isPaytmCraftHttpApiMode() || !get().isApiBackedFile) return;
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
    const result = buildAddCommentReplyResult(get(), commentId, body);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  resolveComment: (id) => {
    const result = buildResolveCommentResult(get(), id, true);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
    if (!isPaytmCraftHttpApiMode() || !get().isApiBackedFile) return;
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
    const result = buildResolveCommentResult(get(), id, false);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
    if (!isPaytmCraftHttpApiMode() || !get().isApiBackedFile) return;
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
    commitStructuralResult(buildDeleteCommentResult(get(), id, opts));
    if (!isPaytmCraftHttpApiMode() || !get().isApiBackedFile) return;
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
    commitStructuralResult(buildStartPathAtResult(get(), worldPoint));
  },

  addPathPoint: (worldPoint) => {
    const s0 = get();
    const drawId = s0.penDrawingNodeId;
    if (!drawId || s0.tool !== "pen") return;
    const path = s0.nodes[drawId];
    if (!path || path.type !== "path" || !path.pathPoints?.length) return;
    const origin = getRenderedWorldTopLeft(drawId, s0.nodes, s0.childOrder);
    const first = path.pathPoints[0]!;
    const firstWorld = { x: origin.x + first.x, y: origin.y + first.y };
    if (path.pathPoints.length >= 2 && canClosePathAt(worldPoint, firstWorld, path.pathPoints.length, s0.zoom)) {
      get().finishPath(true);
      return;
    }
    commitStructuralResult(buildAddPathPointResult(get(), drawId, worldPoint));
  },

  addPathPointDrag: (anchorWorld, dragWorld) => {
    const s0 = get();
    const drawId = s0.penDrawingNodeId;
    if (!drawId || s0.tool !== "pen") return;
    const path = s0.nodes[drawId];
    if (!path || path.type !== "path" || !path.pathPoints?.length) return;

    const origin = getRenderedWorldTopLeft(drawId, s0.nodes, s0.childOrder);
    const first = path.pathPoints[0]!;
    const firstWorld = { x: origin.x + first.x, y: origin.y + first.y };
    if (path.pathPoints.length >= 2 && canClosePathAt(anchorWorld, firstWorld, path.pathPoints.length, s0.zoom)) {
      get().finishPath(true);
      return;
    }

    commitStructuralResult(buildAddPathPointDragResult(get(), drawId, anchorWorld, dragWorld));
  },

  finishPath: (asClosed) => {
    const id = get().penDrawingNodeId;
    if (!id) return;
    commitStructuralResult(buildFinishPathResult(get(), id, Boolean(asClosed)));
  },

  cancelPath: () => {
    const id = get().penDrawingNodeId;
    if (!id) return;
    commitStructuralResult(buildCancelPathResult(get(), id));
  },

  startPencilStroke: (worldPoint) => {
    const s0 = get();
    if (s0.editorMode !== "design" || s0.tool !== "pencil") return;
    if (s0.pencilDrawingNodeId) get().cancelPencilStroke();
    get().pushHistory();
    commitStructuralResult(buildStartPencilStrokeResult(get(), worldPoint));
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
    commitStructuralResult(buildExtendPencilStrokeResult(get(), drawId, worldPoints));
  },

  finishPencilStroke: () => {
    const id = get().pencilDrawingNodeId;
    if (!id) return;
    const path = get().nodes[id];
    if (!path || path.type !== "path" || !path.pathPoints?.length) {
      get().cancelPencilStroke();
      return;
    }
    commitStructuralResult(buildFinishPencilStrokeResult(get(), id));
    get().setTool("move");
  },

  cancelPencilStroke: () => {
    const id = get().pencilDrawingNodeId;
    if (!id) return;
    commitStructuralResult(buildCancelPencilStrokeResult(get(), id));
  },

  updatePathPoint: (nodeId, pointId, patch, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    commitStructuralResult(
      buildUpdatePathPointResult(get(), nodeId, pointId, patch, {
        breakHandleMirror: opts?.breakHandleMirror,
      }),
    );
  },

  deletePathPoint: (nodeId, pointId) => {
    get().pushHistory();
    commitStructuralResult(buildDeletePathPointResult(get(), nodeId, pointId));
  },

  togglePathClosed: (nodeId) => {
    get().pushHistory();
    commitStructuralResult(buildTogglePathClosedResult(get(), nodeId));
  },

  setPathEditMode: (nodeId) =>
    set((s) => {
      if (s.pathEditModeNodeId === nodeId) return s;
      return {
        pathEditModeNodeId: nodeId,
        shapeEditModeNodeId: null,
        selectedPathPointIds:
          nodeId === null || s.pathEditModeNodeId !== nodeId ? [] : s.selectedPathPointIds,
      };
    }),

  selectPathPoint: (nodeId, pointId) =>
    set({
      pathEditModeNodeId: nodeId,
      shapeEditModeNodeId: null,
      selectedIds: [nodeId],
      selectedPathPointIds: pointId ? [pointId] : [],
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
        selectedPathPointIds: [],
        objectEditModeNodeId: null,
      });
      return;
    }
    if (!canEnterParametricShapeEdit(n)) return;
    set({
      shapeEditModeNodeId: id,
      pathEditModeNodeId: null,
      selectedIds: [id],
      selectedPathPointIds: [],
      objectEditModeNodeId: null,
    });
  },

  exitShapeEditMode: () => set({ shapeEditModeNodeId: null }),

  exitAllEditModes: () =>
    set({
      shapeEditModeNodeId: null,
      pathEditModeNodeId: null,
      editingTextId: null,
      selectedPathPointIds: [],
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

  setTransformInteractionMode: (mode) => {
    set({
      transformInteractionMode: mode,
      ...(mode === "none"
        ? { rotateGeomSnapshot: null, rotateGeomSnapshots: null }
        : {}),
    });
    if (mode === "none") flushDeferredWasmReconcile();
  },

  setRotateGeomSnapshot: (snapshot) => set({ rotateGeomSnapshot: snapshot }),

  beginRotateInteraction: (nodeId, snapshot) =>
    set({
      transformInteractionMode: "rotate",
      rotateGeomSnapshot: { nodeId, ...snapshot },
      rotateGeomSnapshots: { [nodeId]: snapshot },
    }),

  beginMultiRotateInteraction: (snapshots) =>
    set({
      transformInteractionMode: "rotate",
      rotateGeomSnapshot: null,
      rotateGeomSnapshots: snapshots,
    }),

  endRotateInteraction: (nodeId, rotation) => {
    const snap = get().rotateGeomSnapshot;
    if (!snap || snap.nodeId !== nodeId) {
      set({
        transformInteractionMode: "none",
        rotateGeomSnapshot: null,
        rotateGeomSnapshots: null,
      });
      return;
    }
    const before = get().nodes[nodeId];
    const result = buildEndRotateInteractionResult(get(), nodeId, rotation);
    if (!result) {
      set({
        transformInteractionMode: "none",
        rotateGeomSnapshot: null,
        rotateGeomSnapshots: null,
      });
      return;
    }
    commitStructuralResult(result);
    const after = get().nodes[nodeId];
    let mirrored = false;
    if (after && before) {
      const patch: Partial<EditorNode> = {};
      if (before.rotation !== after.rotation) patch.rotation = after.rotation;
      if (before.x !== after.x) patch.x = after.x;
      if (before.y !== after.y) patch.y = after.y;
      if (before.width !== after.width) patch.width = after.width;
      if (before.height !== after.height) patch.height = after.height;
      if (Object.keys(patch).length > 0) {
        mirrored = mirrorNodeGeometryToWasm(nodeId, patch, after);
        if (!mirrored) syncWasmDocumentAfterStoreUpdate();
      }
    }
    if (mirrored) {
      clearDeferredWasmReconcile();
    } else {
      flushDeferredWasmReconcile();
    }
  },

  endMultiRotateInteraction: () => {
    const s = get();
    const snapshots = s.rotateGeomSnapshots;
    if (!snapshots || Object.keys(snapshots).length === 0) {
      set({
        transformInteractionMode: "none",
        rotateGeomSnapshot: null,
        rotateGeomSnapshots: null,
      });
      flushDeferredWasmReconcile();
      return;
    }
    const beforeNodes = s.nodes;
    const result = buildEndMultiRotateInteractionResult(s);
    if (!result) {
      set({
        transformInteractionMode: "none",
        rotateGeomSnapshot: null,
        rotateGeomSnapshots: null,
      });
      flushDeferredWasmReconcile();
      return;
    }
    commitStructuralResult(result);
    const afterNodes = get().nodes;
    const entries = Object.keys(snapshots)
      .map((nodeId) => {
        const before = beforeNodes[nodeId];
        const after = afterNodes[nodeId];
        if (!before || !after) return null;
        const patch: Partial<EditorNode> = {};
        if (before.rotation !== after.rotation) patch.rotation = after.rotation;
        if (before.x !== after.x) patch.x = after.x;
        if (before.y !== after.y) patch.y = after.y;
        if (before.width !== after.width) patch.width = after.width;
        if (before.height !== after.height) patch.height = after.height;
        if (Object.keys(patch).length === 0) return null;
        return { nodeId, patch, node: after };
      })
      .filter((e): e is NonNullable<typeof e> => e != null);
    let mirrored = false;
    if (entries.length > 0) {
      mirrored = mirrorGeometryPatchesToWasm(entries);
      if (!mirrored) syncWasmDocumentAfterStoreUpdate();
    }
    if (mirrored) {
      clearDeferredWasmReconcile();
    } else {
      flushDeferredWasmReconcile();
    }
  },

  setIsMovingSelection: (active) => {
    set({ isMovingSelection: active });
    if (!active) flushDeferredWasmReconcile();
  },

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
    if (!raw || !isVectorEditableShape(raw)) return;
    if (s.editingTextId || s.penDrawingNodeId || s.pencilDrawingNodeId) return;
    const needsConvert = needsVectorPathConversion(raw);
    if (needsConvert) get().pushHistory();
    commitStructuralResult(buildEnterVectorEditModeResult(get(), nodeId));
  },

  setPathHandleMirroring: (mode) => {
    const id = get().pathEditModeNodeId ?? get().selectedIds[0];
    if (!id) return;
    get().pushHistory();
    commitStructuralResult(buildSetPathHandleMirroringResult(get(), id, mode));
  },

  setSelectedPathPointIds: (ids) => set({ selectedPathPointIds: ids }),

  togglePathPointSelection: (pointId, additive) =>
    set((s) => {
      const next = additive
        ? s.selectedPathPointIds.includes(pointId)
          ? s.selectedPathPointIds.filter((id) => id !== pointId)
          : [...s.selectedPathPointIds, pointId]
        : [pointId];
      return { selectedPathPointIds: next };
    }),

  updatePathPoints: (nodeId, patches, opts) => {
    if (!opts?.skipHistory && !get().isApplyingHistory) get().pushHistory();
    commitStructuralResult(buildUpdatePathPointsResult(get(), nodeId, patches));
  },

  deletePathPoints: (nodeId, pointIds) => {
    if (pointIds.length === 0) return;
    get().pushHistory();
    commitStructuralResult(buildDeletePathPointsResult(get(), nodeId, pointIds));
  },

  setApiFileSession: (fileId, workspaceId) => {
    pendingCommentCreateByLocalId.clear();
    abortedCommentCreates.clear();
    setActiveApiFileId(fileId);
    set({
      apiFileId: fileId,
      apiWorkspaceId: workspaceId,
      apiFileRevision: undefined,
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
    setActiveApiFileId(null);
    setActiveApiRevision(null);
    set({
      apiFileId: undefined,
      apiWorkspaceId: undefined,
      apiFileRevision: undefined,
      isApiBackedFile: false,
      apiCommentsStatus: "idle" as ApiCommentsStatus,
      versionHistoryOpen: false,
      apiVersionsStatus: "idle" as ApiVersionsStatus,
      apiFileVersions: [],
    });
  },

  saveCurrentDocumentAsApiFile: async () => {
    if (!isPaytmCraftHttpApiMode()) return;
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
        apiFileRevision: created.revision,
        isApiBackedFile: true,
        documentSaveStatus: "saved-api" as DocumentSaveStatus,
        versionHistoryOpen: false,
        apiVersionsStatus: "idle" as ApiVersionsStatus,
        apiFileVersions: [],
      });
      setActiveApiFileId(created.id);
      setActiveApiRevision(created.revision ?? null);
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
    if (!isPaytmCraftHttpApiMode() || !st.isApiBackedFile || !st.apiFileId) {
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
    if (!isPaytmCraftHttpApiMode() || !get().isApiBackedFile || !get().apiFileId) return;
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
    if (!isPaytmCraftHttpApiMode() || !get().isApiBackedFile) return;
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
    if (!isPaytmCraftHttpApiMode() || !st.isApiBackedFile || !st.apiFileId) {
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
        selectedPathPointIds: [],
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
        apiFileRevision: file.revision,
        documentHydrationRevision: s.documentHydrationRevision + 1,
        historyFuture: [],
      }));
      setActiveApiRevision(file.revision ?? null);
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
    const viaApi =
      isPaytmCraftHttpApiMode() && st.isApiBackedFile && Boolean(st.apiFileId);

    void getSyncProvider()
      .saveDocument(doc)
      .then(() => {
        set({
          documentSaveStatus: viaApi ? ("saved-api" as DocumentSaveStatus) : "saved",
          ...(viaApi ? { apiFileRevision: getActiveApiRevision() ?? undefined } : {}),
        });
      })
      .catch((e) => {
        console.warn("[Paytm Craft] saveDocument failed", e);
        if (viaApi && isApiSaveConflictError(e)) {
          set({ documentSaveStatus: "api-conflict" as DocumentSaveStatus });
          return;
        }
        set({
          documentSaveStatus: viaApi ? ("api-save-failed" as DocumentSaveStatus) : "unsaved",
        });
      });
  },

  reloadApiFileFromServer: async () => {
    const st = get();
    if (!isPaytmCraftHttpApiMode() || !st.apiFileId) return;
    try {
      const detail = await apiClient.getFile(st.apiFileId);
      if (!detail) return;
      const slice = persistSliceFromApiFileDetail(detail);
      await get().loadWorkspaceFromPersist(slice, {
        apiFileId: detail.id,
        apiWorkspaceId: detail.workspaceId,
        apiRevision: detail.revision,
      });
      void get().loadApiComments();
    } catch (e) {
      console.warn("[Paytm Craft] reloadApiFileFromServer failed", e);
    }
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
        ...preferLayoutGridOffWhenEmpty(documentToEditorPatch(localDoc)),
        documentHydrating: false,
        documentHydrationRevision: s.documentHydrationRevision + 1,
        documentSaveStatus: "saved",
        historyPast: [],
        historyFuture: [],
      });
      return;
    }

    set({
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
      aiGenerateActive: false,
      aiGenerateStep: null,
      aiGenerateJob: null,
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
      fontAssets: sliceFromDoc.fontAssets,
      designTokens: sliceFromDoc.designTokens,
      fileName: sliceFromDoc.fileName,
      selectedIds: sliceFromDoc.selectedIds,
      zoom: sliceFromDoc.zoom,
      pan: sliceFromDoc.pan,
      showGrid: sliceFromDoc.showGrid,
      showRulers: sliceFromDoc.showRulers,
      canvasBackgroundColor: sliceFromDoc.canvasBackgroundColor,
      canvasColorMode: sliceFromDoc.canvasColorMode,
      comments: sliceFromDoc.comments,
      pages: sliceFromDoc.pages,
      pageOrder: sliceFromDoc.pageOrder,
      activePageId: sliceFromDoc.activePageId,
      activeSubPageId: sliceFromDoc.activeSubPageId,
      codeRoundTripLink: normalizeCodeRoundTripLink(sliceFromDoc.codeRoundTripLink ?? null),
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
      if (isFigImportCancelled(importGen)) return;
      const bytes = new Uint8Array(await file.arrayBuffer());
      let lastProgressAt = 0;
      const onProgress = (message: string) => {
        if (isFigImportCancelled(importGen)) return;
        const now = Date.now();
        if (now - lastProgressAt < 100) return;
        lastProgressAt = now;
        useEditorStore.setState({ figImportStatus: message });
      };
      const result = await convertFigFileAsync(bytes, file.name, onProgress);
      if (isFigImportCancelled(importGen)) return;
      if (!result.ok) {
        throw new Error(result.error);
      }
      set({ figImportStatus: "Applying to canvas…" });
      const prepared = prepareDocumentForEditorImport(result.document);
      if (isFigImportCancelled(importGen)) return;
      const { finalizeFigmaImportToEditor } = await import("@/lib/figImport/finalizeFigmaImport");
      await finalizeFigmaImportToEditor({
        prepared,
        fileName: result.document.name || file.name.replace(/\.fig$/i, ""),
        runPostLayout: false,
        importGen,
        figFidelityCaptures: result.figFidelityCaptures,
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
      fontAssets: slice.fontAssets ?? {},
      designTokens: slice.designTokens ?? {},
      fileName: slice.fileName,
      selectedIds: slice.selectedIds,
      zoom: slice.zoom,
      pan: slice.pan,
      showGrid: slice.showGrid,
      showRulers: slice.showRulers,
      canvasBackgroundColor: slice.canvasBackgroundColor,
      canvasColorMode: slice.canvasColorMode ?? "light",
      comments: slice.comments,
      pages: slice.pages,
      pageOrder: slice.pageOrder,
      activePageId: slice.activePageId,
      activeSubPageId:
        slice.activeSubPageId ??
        slice.pages[slice.activePageId]?.activeSubPageId ??
        `${slice.activePageId}-sp-1`,
      layoutGuides: slice.layoutGuides ?? slice.pages[slice.activePageId]?.layoutGuides ?? [],
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
      selectedPathPointIds: [],
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
      apiFileRevision: backed ? apiSession!.apiRevision : undefined,
      isApiBackedFile: backed,
      apiCommentsStatus: (backed ? "loading" : "idle") as ApiCommentsStatus,
      versionHistoryOpen: false,
      apiVersionsStatus: "idle" as ApiVersionsStatus,
      apiFileVersions: [],
      editorMode: "design",
      tool: "move",
      leftTab: "layers",
      documentSaveStatus: (backed ? "saved-api" : "saved") as DocumentSaveStatus,
      documentHydrating: false,
      documentHydrationRevision: s.documentHydrationRevision + 1,
      historyPast: [],
      historyFuture: [],
    }));
    setActiveApiFileId(backed ? apiSession!.apiFileId : null);
    setActiveApiRevision(backed ? apiSession!.apiRevision ?? null : null);
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
            } else {
              useEditorStore.setState({
                documentSaveStatus: "saved-api",
                apiFileRevision: getActiveApiRevision() ?? undefined,
              });
            }
          })
          .catch((e) => {
            console.warn("[Paytm Craft] persist save failed", e);
            if (get().isApiBackedFile && isApiSaveConflictError(e)) {
              useEditorStore.setState({ documentSaveStatus: "api-conflict" });
              return;
            }
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
    if (mode === "replace") {
      appliedSlice = prepareImportedSliceForCanvas(slice, {
        preserveCaptureGeometry: opts?.preserveCaptureGeometry === true,
      });
    }
    if (zoomToFit) {
      const el =
        typeof document !== "undefined"
          ? document.querySelector<HTMLElement>("[data-canvas-viewport]")
          : null;
      const roots = appliedSlice.childOrder[ROOT] ?? [];
      const vp = viewportForRootNodes(
        appliedSlice.nodes,
        roots,
        el?.clientWidth ?? 1200,
        el?.clientHeight ?? 800,
      );
      if (vp) {
        appliedSlice = {
          ...appliedSlice,
          zoom: vp.zoom,
          pan: vp.pan,
          pages: Object.fromEntries(
            Object.entries(appliedSlice.pages ?? {}).map(([id, page]) => [
              id,
              id === appliedSlice.activePageId ? { ...page, zoom: vp.zoom, pan: vp.pan } : page,
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
      selectedPathPointIds: [],
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
      apiFileRevision: undefined,
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
          canvasColorMode: appliedSlice.canvasColorMode ?? s.canvasColorMode,
          projectCssSources: appliedSlice.projectCssSources ?? s.projectCssSources ?? [],
          comments: appliedSlice.comments,
          pages: appliedSlice.pages,
          pageOrder: appliedSlice.pageOrder,
          activePageId: appliedSlice.activePageId,
          activeSubPageId:
            appliedSlice.activeSubPageId ??
            appliedSlice.pages[appliedSlice.activePageId]?.activeSubPageId ??
            `${appliedSlice.activePageId}-sp-1`,
          codeRoundTripLink:
            normalizeCodeRoundTripLink(appliedSlice.codeRoundTripLink ?? s.codeRoundTripLink),
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
          canvasColorMode: merged.canvasColorMode ?? s.canvasColorMode,
          projectCssSources: merged.projectCssSources ?? s.projectCssSources ?? [],
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

    requestCraftEngineForceFullSync();
    syncWasmDocumentAfterStoreUpdate();
    bumpTextLayoutEpoch();

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
    if (
      s.documentSaveStatus === "unsaved" ||
      s.documentSaveStatus === "api-save-failed" ||
      s.documentSaveStatus === "api-conflict"
    ) {
      if (!window.confirm("Discard unsaved changes and create a new file?")) return;
    }
    const empty = createEmptyDocumentFields();
    set({
      nodes: empty.nodes,
      childOrder: empty.childOrder,
      pages: empty.pages,
      pageOrder: empty.pageOrder,
      activePageId: empty.activePageId,
      activeSubPageId: empty.activeSubPageId,
      assets: empty.assets,
      fontAssets: empty.fontAssets ?? {},
      designTokens: empty.designTokens,
      fileName: empty.fileName,
      selectedIds: empty.selectedIds,
      zoom: empty.zoom,
      pan: empty.pan,
      showGrid: empty.showGrid,
      showRulers: empty.showRulers ?? false,
      canvasBackgroundColor: empty.canvasBackgroundColor,
      canvasColorMode: empty.canvasColorMode ?? "light",
      comments: empty.comments,
      commentsPanelOpen: false,
      activeCommentId: null,
      isPlacingComment: false,
      penDrawingNodeId: null,
      pencilDrawingNodeId: null,
      pathEditModeNodeId: null,
  objectEditModeNodeId: null,
      selectedPathPointIds: [],
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
      apiFileRevision: undefined,
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
      wasmHistoryCanUndo: false,
      wasmHistoryCanRedo: false,
    });
    if (isWasmDocumentAuthority()) {
      runCraftEngineAccess(() => {
        try {
          getActiveCraftEngine()?.clearHistory();
        } catch {
          /* engine not ready */
        }
      });
      requestCraftEngineWasmBootstrap();
    }
    void getSyncProvider()
      .saveDocument(editorStateToDocument(toPersistSlice(get())))
      .catch((e) => {
        console.warn("[Paytm Craft] persist save failed", e);
        useEditorStore.setState({ documentSaveStatus: "unsaved" });
      });
  },

  setDocumentName: (name) => {
    const result = buildSetDocumentNameResult(get(), name);
    if (!result) return;
    get().pushHistory();
    commitStructuralResult(result);
  },

  setActivePage: (pageId) => {
    const s = get();
    if (pageId === s.activePageId || !s.pages[pageId]) return;
    const captured = pagesWithActiveCaptured(s);
    const nextMaster = ensurePageHasSubPages(captured.pages[pageId]!);
    captured.pages[pageId] = nextMaster;
    const nextSubId = nextMaster.activeSubPageId ?? nextMaster.subPageOrder?.[0]!;
    const nextSub = resolveActiveSubPage(nextMaster, nextSubId);
    set({
      pages: captured.pages,
      activePageId: pageId,
      activeSubPageId: nextSubId,
      ...editorPatchFromSubPage(nextSub),
      ...pageSwitchUiReset(),
    });
    scheduleWorkspacePersist();
  },

  setActiveSubPage: (subPageId) => {
    const s = get();
    const master = s.pages[s.activePageId];
    if (!master) return;
    const captured = pagesWithActiveCaptured(s);
    const ensuredMaster = ensurePageHasSubPages(captured.pages[s.activePageId]!);
    if (!ensuredMaster.subPages?.[subPageId] || subPageId === s.activeSubPageId) return;
    captured.pages[s.activePageId] = ensuredMaster;
    const nextSub = ensuredMaster.subPages[subPageId]!;
    set({
      pages: captured.pages,
      activeSubPageId: subPageId,
      ...editorPatchFromSubPage(nextSub),
      ...pageSwitchUiReset(),
    });
    scheduleWorkspacePersist();
  },

  addPage: () => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = nextPageName(captured.pages, captured.pageOrder);
    const page = createEmptyPage(id, name);
    const subId = page.activeSubPageId ?? page.subPageOrder?.[0]!;
    const sub = resolveActiveSubPage(page, subId);
    set({
      pages: { ...captured.pages, [id]: page },
      pageOrder: [...captured.pageOrder, id],
      activePageId: id,
      activeSubPageId: subId,
      ...editorPatchFromSubPage(sub),
      ...pageSwitchUiReset(),
    });
    scheduleWorkspacePersist();
  },

  addSubPage: () => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const masterId = s.activePageId;
    const master = ensurePageHasSubPages(captured.pages[masterId]!);
    const subId = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = nextSubPageName(master.subPages ?? {}, master.subPageOrder ?? []);
    const sub = createEmptySubPage(subId, name);
    const nextMaster: EditorPage = {
      ...master,
      subPages: { ...master.subPages, [subId]: sub },
      subPageOrder: [...(master.subPageOrder ?? []), subId],
      activeSubPageId: subId,
      ...editorPatchFromSubPage(sub),
    };
    set({
      pages: { ...captured.pages, [masterId]: nextMaster },
      activeSubPageId: subId,
      ...editorPatchFromSubPage(sub),
      ...pageSwitchUiReset(),
    });
    scheduleWorkspacePersist();
  },

  duplicatePage: (pageId) => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const sourceId = pageId ?? s.activePageId;
    const source = ensurePageHasSubPages(captured.pages[sourceId]!);
    if (!source) return;
    const id = `page-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const subPages: Record<string, EditorSubPage> = {};
    const subPageOrder: string[] = [];
    for (const [index, oldSubId] of (source.subPageOrder ?? []).entries()) {
      const oldSub = source.subPages?.[oldSubId];
      if (!oldSub) continue;
      const newSubId = `sub-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
      const cloned = cloneSubPageCanvas(oldSub);
      subPages[newSubId] = {
        ...oldSub,
        id: newSubId,
        nodes: cloned.nodes,
        childOrder: cloned.childOrder,
        selectedIds: cloned.selectedIds,
        layoutGuides: (oldSub.layoutGuides ?? []).map((g) => ({
          ...g,
          id: `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        })),
      };
      subPageOrder.push(newSubId);
    }
    const activeSubId = subPageOrder[0] ?? `${id}-sp-1`;
    const activeSub = subPages[activeSubId] ?? createEmptySubPage(activeSubId, "Page 1");
    const page: EditorPage = {
      id,
      name: `${source.name} copy`,
      subPages,
      subPageOrder: subPageOrder.length > 0 ? subPageOrder : [activeSubId],
      activeSubPageId: activeSubId,
      ...editorPatchFromSubPage(activeSub),
    };
    set({
      pages: { ...captured.pages, [id]: page },
      pageOrder: [...captured.pageOrder, id],
      activePageId: id,
      activeSubPageId: activeSubId,
      ...editorPatchFromSubPage(activeSub),
      ...pageSwitchUiReset(),
    });
    scheduleWorkspacePersist();
  },

  duplicateSubPage: (subPageId) => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const masterId = s.activePageId;
    const master = ensurePageHasSubPages(captured.pages[masterId]!);
    const source = master.subPages?.[subPageId];
    if (!source) return;
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const cloned = cloneSubPageCanvas(source);
    const sub: EditorSubPage = {
      ...source,
      id,
      name: `${source.name} copy`,
      nodes: cloned.nodes,
      childOrder: cloned.childOrder,
      selectedIds: cloned.selectedIds,
      layoutGuides: (source.layoutGuides ?? []).map((g) => ({
        ...g,
        id: `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      })),
    };
    const nextMaster: EditorPage = {
      ...master,
      subPages: { ...master.subPages, [id]: sub },
      subPageOrder: [...(master.subPageOrder ?? []), id],
      activeSubPageId: id,
      ...editorPatchFromSubPage(sub),
    };
    set({
      pages: { ...captured.pages, [masterId]: nextMaster },
      activeSubPageId: id,
      ...editorPatchFromSubPage(sub),
      ...pageSwitchUiReset(),
    });
    scheduleWorkspacePersist();
  },

  deletePage: (pageId, opts) => {
    const s = get();
    if (s.pageOrder.length <= 1) return;
    const captured = pagesWithActiveCaptured(s);
    const page = captured.pages[pageId];
    if (!page) return;
    if (
      !opts?.skipConfirm &&
      !window.confirm(`Delete "${page.name}"? This page and all of its content will be removed.`)
    ) {
      return;
    }
    const restPages = { ...captured.pages };
    delete restPages[pageId];
    const newOrder = captured.pageOrder.filter((id) => id !== pageId);
    if (pageId === s.activePageId) {
      const nextId = newOrder[newOrder.length - 1] ?? newOrder[0]!;
      const nextMaster = ensurePageHasSubPages(restPages[nextId]!);
      restPages[nextId] = nextMaster;
      const nextSubId = nextMaster.activeSubPageId ?? nextMaster.subPageOrder?.[0]!;
      const nextSub = resolveActiveSubPage(nextMaster, nextSubId);
      set({
        pages: restPages,
        pageOrder: newOrder,
        activePageId: nextId,
        activeSubPageId: nextSubId,
        ...editorPatchFromSubPage(nextSub),
        ...pageSwitchUiReset(),
      });
      scheduleWorkspacePersist();
      return;
    }
    set({ pages: restPages, pageOrder: newOrder });
    scheduleWorkspacePersist();
  },

  deleteSubPage: (subPageId, opts) => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const masterId = s.activePageId;
    const master = ensurePageHasSubPages(captured.pages[masterId]!);
    const sub = master.subPages?.[subPageId];
    if (!sub || (master.subPageOrder?.length ?? 0) <= 1) return;
    if (
      !opts?.skipConfirm &&
      !window.confirm(`Delete "${sub.name}"? This page and all of its content will be removed.`)
    ) {
      return;
    }
    const restSubPages = { ...master.subPages };
    delete restSubPages[subPageId];
    const newSubOrder = (master.subPageOrder ?? []).filter((id) => id !== subPageId);
    if (subPageId === s.activeSubPageId) {
      const nextSubId = newSubOrder[newSubOrder.length - 1] ?? newSubOrder[0]!;
      const nextSub = restSubPages[nextSubId]!;
      const nextMaster: EditorPage = {
        ...master,
        subPages: restSubPages,
        subPageOrder: newSubOrder,
        activeSubPageId: nextSubId,
        ...editorPatchFromSubPage(nextSub),
      };
      set({
        pages: { ...captured.pages, [masterId]: nextMaster },
        activeSubPageId: nextSubId,
        ...editorPatchFromSubPage(nextSub),
        ...pageSwitchUiReset(),
      });
      scheduleWorkspacePersist();
      return;
    }
    set({
      pages: {
        ...captured.pages,
        [masterId]: {
          ...master,
          subPages: restSubPages,
          subPageOrder: newSubOrder,
        },
      },
    });
    scheduleWorkspacePersist();
  },

  closePage: (pageId) => {
    const s = get();
    const captured = pagesWithActiveCaptured(s);
    const page = ensurePageHasSubPages(captured.pages[pageId]!);
    if (!page) return { emptied: false };

    const workspaceId =
      typeof window !== "undefined" ? getActiveMockWorkspace().id : "ws-personal";
    addDashboardSavedFile({
      id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: page.name,
      savedAt: new Date().toISOString(),
      workspaceId,
      document: paytmCraftDocumentFromPage(page, {
        assets: s.assets,
        fontAssets: s.fontAssets,
        designTokens: s.designTokens,
        comments: s.comments,
        codeRoundTripLink: s.codeRoundTripLink ?? null,
      }),
    });

    const restPages = { ...captured.pages };
    delete restPages[pageId];
    const newOrder = captured.pageOrder.filter((id) => id !== pageId);

    const persist = () => {
      void getSyncProvider()
        .saveDocument(editorStateToDocument(toPersistSlice(get())))
        .catch((err) => {
          console.warn("[Paytm Craft] persist after close page failed", err);
        });
    };

    if (newOrder.length === 0) {
      const empty = createEmptyDocumentFields();
      set({
        nodes: empty.nodes,
        childOrder: empty.childOrder,
        pages: empty.pages,
        pageOrder: empty.pageOrder,
        activePageId: empty.activePageId,
        activeSubPageId: empty.activeSubPageId,
        assets: empty.assets,
        fontAssets: empty.fontAssets ?? {},
        designTokens: empty.designTokens,
        fileName: empty.fileName,
        selectedIds: empty.selectedIds,
        zoom: empty.zoom,
        pan: empty.pan,
        showGrid: empty.showGrid,
        showRulers: empty.showRulers ?? false,
        canvasBackgroundColor: empty.canvasBackgroundColor,
        canvasColorMode: empty.canvasColorMode ?? "light",
        comments: empty.comments,
        layoutGuides: empty.pages[empty.activePageId]?.layoutGuides ?? [],
        documentSaveStatus: "saved",
        documentHydrationRevision: s.documentHydrationRevision + 1,
        historyPast: [],
        historyFuture: [],
        ...pageSwitchUiReset(),
      });
      persist();
      return { emptied: true };
    }

    if (pageId === s.activePageId) {
      const nextId = newOrder[newOrder.length - 1] ?? newOrder[0]!;
      const nextMaster = ensurePageHasSubPages(restPages[nextId]!);
      restPages[nextId] = nextMaster;
      const nextSubId = nextMaster.activeSubPageId ?? nextMaster.subPageOrder?.[0]!;
      const nextSub = resolveActiveSubPage(nextMaster, nextSubId);
      set({
        pages: restPages,
        pageOrder: newOrder,
        activePageId: nextId,
        activeSubPageId: nextSubId,
        ...editorPatchFromSubPage(nextSub),
        ...pageSwitchUiReset(),
        documentSaveStatus:
          s.documentSaveStatus === "saved" || s.documentSaveStatus === "saved-api"
            ? "unsaved"
            : s.documentSaveStatus,
      });
      persist();
      return { emptied: false };
    }

    set({
      pages: restPages,
      pageOrder: newOrder,
      documentSaveStatus:
        s.documentSaveStatus === "saved" || s.documentSaveStatus === "saved-api"
          ? "unsaved"
          : s.documentSaveStatus,
    });
    persist();
    return { emptied: false };
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
      const captured = pagesWithActiveCaptured(s);
      const page = captured.pages[pageId];
      if (!page || page.name === trimmed) return s;
      const documentSaveStatus =
        s.documentSaveStatus === "saved" || s.documentSaveStatus === "saved-api"
          ? "unsaved"
          : s.documentSaveStatus;
      return {
        pages: { ...captured.pages, [pageId]: { ...page, name: trimmed } },
        documentSaveStatus,
      };
    });
    scheduleWorkspacePersist();
  },

  renameSubPage: (subPageId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    set((s) => {
      const captured = pagesWithActiveCaptured(s);
      const master = ensurePageHasSubPages(captured.pages[s.activePageId]!);
      const sub = master.subPages?.[subPageId];
      if (!sub || sub.name === trimmed) return s;
      const documentSaveStatus =
        s.documentSaveStatus === "saved" || s.documentSaveStatus === "saved-api"
          ? "unsaved"
          : s.documentSaveStatus;
      const nextSub = { ...sub, name: trimmed };
      return {
        pages: {
          ...captured.pages,
          [s.activePageId]: {
            ...master,
            subPages: { ...master.subPages, [subPageId]: nextSub },
          },
        },
        documentSaveStatus,
      };
    });
    scheduleWorkspacePersist();
  },
  };
});
