"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Boxes,
  Component,
  Copy,
  LayoutTemplate,
  Link2,
  Monitor,
  Unlink,
} from "lucide-react";
import { canAlignSelection } from "@/lib/alignSelection";
import { AlignControls } from "./AlignControls";
import { PropertiesSection } from "./PropertiesSection";
import { TypographySection } from "./design-panel/TypographySection";
import { TextResizingSection } from "./design-panel/TextResizingSection";
import { PropertyNumberInput, PropertyTextInput } from "./PropertyInput";
import { shouldClipChildren } from "@/lib/clipChildren";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "./EditorHoverHint";
import { appFieldClassCompact } from "@/lib/appFieldStyles";
import {
  useEditorStore,
  type EditorNode,
  type NodeStylePatch,
  type StrokePosition,
  type ConstraintHorizontal,
  type ConstraintVertical,
} from "@/stores/useEditorStore";
import { findInstanceRoot } from "@/lib/componentModel";
import {
  resolveNodeWithDesignTokens,
  type EffectTokenValue,
} from "@/lib/designTokens";
import { inferAutoLayoutGap, type LayoutNode } from "@/lib/autoLayout";
import {
  LAYOUT_GAP_MAX,
  sanitizeLayoutGap,
  sanitizeLayoutGapForFrame,
} from "@/lib/autoLayout/spacingPaddingDrag";
import { computeMinLayoutGap } from "@/lib/layoutEngine/minLayoutGap";
import type { LayoutEngineNode } from "@/lib/layoutEngine/types";
import { isStarNode, starGeometryPatch } from "@/lib/shapes/starGeometry";
import {
  lineAngleDegrees,
  lineEndpointsFromNode,
  lineLength,
} from "@/lib/shapes/lineGeometry";
import {
  arrowEndpointStylePatch,
  arrowHeadToStrokeEndpoint,
  resolveArrowEndKind,
  resolveArrowStartKind,
  strokeEndpointToArrowHead,
} from "@/lib/shapes/arrowGeometry";
import { isPolygonNode, polygonGeometryPatch } from "@/lib/shapes/polygonGeometry";
import {
  cornerRadiiStylePatch,
  pathSupportsCornerRadius,
} from "@/lib/shapes/shapeToPath";
import {
  getShapeVertexCornerRadii,
  polygonCornerRadiusLabels,
  shapeSupportsIndividualCornerRadius,
  starCornerRadiusLabels,
} from "@/lib/shapes/parametricCornerRadii";
import {
  isMaskGroup,
} from "@/lib/booleanGeometry";
import { LayoutSizingControls } from "./LayoutSizingControls";
import { AppearanceSection } from "./design-panel/AppearanceSection";
import { StrokeSection } from "./design-panel/StrokeSection";
import { EffectsSection } from "./design-panel/EffectsSection";
import { FillSection } from "./design-panel/FillSection";
import { InspectorSegmented } from "./design-panel/InspectorPrimitives";
import { PositionSection } from "./design-panel/PositionSection";
import { InspectorLayerHeaderActions } from "./design-panel/InspectorLayerHeaderActions";
import { InspectorExportSection } from "./design-panel/InspectorExportSection";
import { AutoLayoutInspectorPanel } from "./design-panel/AutoLayoutInspectorPanel";
import { resolveStrokeEndPoint } from "@/lib/strokeEndpoints";
import {
  downloadNodePdf,
  downloadNodePng,
  saveTextWithDialog,
  nodeToSvg,
  pngExportFilename,
} from "@/lib/inspectExport";

const field =
  "h-6 min-h-[24px] px-1.5 py-0 text-ui leading-4";

function typeLabel(t: EditorNode["type"]): string {
  switch (t) {
    case "frame":
      return "Frame";
    case "group":
      return "Group";
    case "rectangle":
      return "Rectangle";
    case "ellipse":
      return "Ellipse";
    case "path":
      return "Path";
    case "text":
      return "Text";
    case "image":
      return "Image";
    default:
      return "Layer";
  }
}

export function DesignInspector({ node }: { node: EditorNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const updateLayout = useEditorStore((s) => s.updateLayout);
  const updateLayoutPositioning = useEditorStore((s) => s.updateLayoutPositioning);
  const addAutoLayoutToSelection = useEditorStore((s) => s.addAutoLayoutToSelection);
  const addAutoLayoutToContainer = useEditorStore((s) => s.addAutoLayoutToContainer);
  const updateConstraints = useEditorStore((s) => s.updateConstraints);
  const renameNode = useEditorStore((s) => s.renameNode);
  const parent = useEditorStore((s) => (node.parentId ? s.nodes[node.parentId!] : null));
  const nodesAll = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const createVariantFromComponent = useEditorStore((s) => s.createVariantFromComponent);
  const updateVariantProperties = useEditorStore((s) => s.updateVariantProperties);
  const detachInstance = useEditorStore((s) => s.detachInstance);
  const setPlacingComponentMasterId = useEditorStore((s) => s.setPlacingComponentMasterId);
  const togglePathClosed = useEditorStore((s) => s.togglePathClosed);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const assets = useEditorStore((s) => s.assets);
  const replaceImageAsset = useEditorStore((s) => s.replaceImageAsset);
  const designTokens = useEditorStore((s) => s.designTokens);
  const updateDesignToken = useEditorStore((s) => s.updateDesignToken);
  const pushHistory = useEditorStore((s) => s.pushHistory);
  const createColorTokenFromSelection = useEditorStore((s) => s.createColorTokenFromSelection);
  const createTypographyTokenFromSelection = useEditorStore((s) => s.createTypographyTokenFromSelection);
  const detachTokenFromSelection = useEditorStore((s) => s.detachTokenFromSelection);
  const detachEffectTokenFromSelection = useEditorStore((s) => s.detachEffectTokenFromSelection);
  const addEffect = useEditorStore((s) => s.addEffect);
  const updateEffect = useEditorStore((s) => s.updateEffect);
  const deleteEffect = useEditorStore((s) => s.deleteEffect);
  const toggleEffect = useEditorStore((s) => s.toggleEffect);
  const resizeFrameWithConstraints = useEditorStore((s) => s.resizeFrameWithConstraints);
  const openResponsivePreview = useEditorStore((s) => s.openResponsivePreview);
  const responsivePreview = useEditorStore((s) => s.responsivePreview);
  const exitObjectEditMode = useEditorStore((s) => s.exitObjectEditMode);
  const useSelectionAsMask = useEditorStore((s) => s.useSelectionAsMask);
  const releaseMask = useEditorStore((s) => s.releaseMask);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);
  const toggleVisible = useEditorStore((s) => s.toggleVisible);

  const display = useMemo(() => resolveNodeWithDesignTokens(node, designTokens), [node, designTokens]);

  const locked = node.locked;
  const id = node.id;
  const key = id;

  const [exportBusy, setExportBusy] = useState<"png" | "svg" | "pdf" | null>(null);
  const [pngScale, setPngScale] = useState(1);
  const exportSafeName = useMemo(
    () => (node.name || "layer").replace(/[^\w-]+/g, "-").slice(0, 48),
    [node.name],
  );
  const exportSvg = useMemo(
    () => nodeToSvg(node, nodesAll, childOrder, assets, designTokens),
    [node, nodesAll, childOrder, assets, designTokens],
  );

  const onExportPng = useCallback(async () => {
    setExportBusy("png");
    try {
      await downloadNodePng(
        node,
        nodesAll,
        childOrder,
        pngExportFilename(`${exportSafeName}.png`, pngScale),
        assets,
        designTokens,
        pngScale,
      );
    } finally {
      setExportBusy(null);
    }
  }, [assets, childOrder, designTokens, exportSafeName, node, nodesAll, pngScale]);

  const onExportSvg = useCallback(async () => {
    setExportBusy("svg");
    try {
      await saveTextWithDialog(`${exportSafeName}.svg`, exportSvg, "image/svg+xml;charset=utf-8", {
        description: "SVG image",
        mimeType: "image/svg+xml",
        extension: ".svg",
      });
    } finally {
      setExportBusy(null);
    }
  }, [exportSafeName, exportSvg]);

  const onExportPdf = useCallback(async () => {
    setExportBusy("pdf");
    try {
      await downloadNodePdf(
        node,
        nodesAll,
        childOrder,
        `${exportSafeName}.pdf`,
        assets,
        designTokens,
      );
    } finally {
      setExportBusy(null);
    }
  }, [assets, childOrder, designTokens, exportSafeName, node, nodesAll]);

  const canFillStroke =
    node.type === "rectangle" ||
    node.type === "frame" ||
    node.type === "ellipse" ||
    node.type === "polygon" ||
    node.type === "path" ||
    node.type === "text" ||
    Boolean(node.isBooleanGroup);
  const showStrokeSides = node.type === "rectangle" || node.type === "frame";
  const isLine = node.type === "line";
  const isArrow = node.type === "arrow";
  const isPath = node.type === "path";
  const isImage = node.type === "image";
  const canRadius = shapeSupportsIndividualCornerRadius(node);
  const cornerRadiusLabels = useMemo(() => {
    if (isStarNode(node)) return starCornerRadiusLabels(node.starPoints ?? 5);
    if (isPolygonNode(node)) return polygonCornerRadiusLabels(node.polygonSides ?? 6);
    if (node.type === "path" && pathSupportsCornerRadius(node)) {
      return (node.pathPoints ?? []).map((_, i) => String(i + 1));
    }
    return undefined;
  }, [node]);
  const isText = node.type === "text";

  const isContainer = node.type === "frame" || node.type === "group";
  const layoutMode = node.layoutMode ?? "none";
  const inAutoLayoutParent = (parent?.layoutMode ?? "none") !== "none";
  const parentAutoLayout = Boolean(parent && (parent.layoutMode ?? "none") !== "none");

  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const imagePreviewSrc =
    node.type === "image" ? node.imageSrc ?? (node.assetId ? assets[node.assetId]?.dataUrl : undefined) : undefined;

  const instRootId = findInstanceRoot(nodesAll, id);
  const instRoot = instRootId ? nodesAll[instRootId] : null;
  const sourceMaster = instRoot?.sourceComponentId ? nodesAll[instRoot.sourceComponentId] : null;

  const [textContentDraft, setTextContentDraft] = useState(node.content ?? "");
  useEffect(() => {
    setTextContentDraft(node.content ?? "");
  }, [node.content, id]);

  const patch = (p: Partial<EditorNode>) => updateNode(id, p);
  const style = (p: NodeStylePatch, opts?: { skipHistory?: boolean }) => updateNodeStyle(id, p, opts);
  const applyCornerStyle = (p: NodeStylePatch) => {
    if (!canRadius) {
      style(p);
      return;
    }
    if (p.cornerRadii != null) {
      const patched = cornerRadiiStylePatch(node, p.cornerRadii);
      const explicitPerCorner =
        p.cornerRadius === undefined &&
        p.cornerRadii.length > 0 &&
        patched.cornerRadii == null;
      if (explicitPerCorner) {
        style({
          cornerRadius: undefined,
          cornerRadii: p.cornerRadii.map((r) => Math.max(0, r ?? 0)),
        });
        return;
      }
      style({ ...p, ...patched });
      return;
    }
    if (p.cornerRadius != null) {
      const count = getShapeVertexCornerRadii(node).length;
      const radii = Array.from({ length: count }, () => p.cornerRadius ?? 0);
      style({ ...p, ...cornerRadiiStylePatch(node, radii) });
      return;
    }
    style(p);
  };

  const fillOpacity = display.fillOpacity ?? 1;
  const fillEnabled = node.fillEnabled !== false;
  const fillToken = node.fillTokenId ? designTokens[node.fillTokenId] : undefined;
  const strokePos: StrokePosition = node.strokePosition ?? "center";

  const canAlignLayer = useMemo(
    () => canAlignSelection(selectedIds, nodesAll, childOrder),
    [selectedIds, nodesAll, childOrder],
  );

  const showMakeComponent =
    !node.isComponent && !instRootId && selectedIds.length >= 1 && selectedIds[0] === id;

  return (
    <>
      <div className="border-b border-app-panel-edge px-3 py-3">
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded-md border border-app-border bg-app-hover px-2 py-0.5 text-ui font-medium text-app-muted">
            {typeLabel(node.type)}
          </span>
          {node.isComponent ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-500/35 bg-violet-500/15 px-2 py-0.5 text-ui font-medium text-violet-200">
              <Component className="h-3 w-3" strokeWidth={1.75} />
              Component
            </span>
          ) : null}
          {instRootId ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-ui font-medium text-violet-100">
              <Boxes className="h-3 w-3" strokeWidth={1.75} />
              Instance
            </span>
          ) : null}
          <InspectorLayerHeaderActions
            locked={locked}
            showMakeComponent={showMakeComponent}
          />
        </div>
        <PropertyTextInput
          label="Name"
          value={node.name}
          instanceKey={key}
          onCommit={(name) => renameNode(id, name)}
        />
      </div>

      {canAlignLayer ? (
        <PropertiesSection title="Alignment" defaultOpen>
          <AlignControls variant="panel" className="!space-y-1.5" />
        </PropertiesSection>
      ) : null}

      {node.isComponent && isContainer && (
        <PropertiesSection title="Component" defaultOpen>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={locked}
              onClick={() => setPlacingComponentMasterId(node.id)}
              className="inspector-section-action"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              Create instance
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => createVariantFromComponent(node.componentId ?? node.id)}
              className="inspector-section-action"
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Add variant
            </button>
            <PropertyTextInput
              label="Variant props (JSON)"
              value={JSON.stringify(node.variantProperties ?? {})}
              instanceKey={`${key}-vp`}
              disabled={locked}
              onCommit={(raw) => {
                try {
                  const parsed = JSON.parse(raw) as Record<string, string>;
                  if (parsed && typeof parsed === "object") {
                    updateVariantProperties(node.componentId ?? node.id, parsed);
                  }
                } catch {
                  /* ignore */
                }
              }}
            />
          </div>
        </PropertiesSection>
      )}

      {instRootId && (
        <PropertiesSection title="Instance" defaultOpen>
          <p className="mb-1.5 inspector-helper-text text-app-muted">
            Source:{" "}
            <span className="font-medium text-app-fg">{sourceMaster?.name ?? "Unknown"}</span>
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => detachInstance(instRootId)}
            className="inspector-section-action"
          >
            <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
            Detach instance
          </button>
        </PropertiesSection>
      )}

      <PositionSection
        node={node}
        instanceKey={key}
        locked={locked}
        parentAutoLayout={parentAutoLayout}
        isContainer={isContainer}
        hideDimensions={isText}
        onPatch={patch}
        onResizeFrame={(width, height) => resizeFrameWithConstraints(id, { width, height })}
      />

      {isText ? (
        <TextResizingSection
          node={node}
          instanceKey={key}
          locked={locked}
          onStyle={style}
        />
      ) : null}

      {isText ? (
        <TypographySection
          node={node}
          display={display}
          instanceKey={key}
          locked={locked}
          textContentDraft={textContentDraft}
          onTextContentDraftChange={setTextContentDraft}
          onTextContentCommit={() => {
            const cur = useEditorStore.getState().nodes[id]?.content ?? "";
            if (textContentDraft !== cur) style({ content: textContentDraft });
          }}
          designTokens={designTokens}
          onStyle={style}
          onUpdateDesignToken={updateDesignToken}
          onCreateTypographyToken={createTypographyTokenFromSelection}
          onCreateColorToken={createColorTokenFromSelection}
          onDetachTypographyToken={() => detachTokenFromSelection("typography")}
          onDetachColorToken={() => detachTokenFromSelection("color")}
        />
      ) : null}

      {inAutoLayoutParent && layoutMode === "none" ? (
        <PropertiesSection title="Layout" defaultOpen>
          <LayoutSizingControls node={node} nodes={nodesAll} locked={locked} />
          {(node.layoutSizingHorizontal === "fill" ||
            node.layoutSizingVertical === "fill" ||
            (node.layoutGrow != null && node.layoutGrow !== 1)) && (
            <div className="mt-2">
              <PropertyNumberInput
                commitOnInput={false}
                label="Grow weight"
                value={node.layoutGrow ?? 1}
                instanceKey={`${key}-grow`}
                disabled={locked}
                min={0}
                max={24}
                step={0.5}
                onCommit={(v) => patch({ layoutGrow: Math.max(0, v), layoutDirty: true })}
              />
            </div>
          )}
          {parent?.id && parentAutoLayout ? (() => {
            const frameId = parent.id;
            const frame = nodesAll[frameId];
            if (!frame) return null;
            const frameMode = frame.layoutMode === "vertical" ? "vertical" : "horizontal";
            const flowKids = (childOrder[frameId] ?? []).filter((cid) => {
              const c = nodesAll[cid];
              return c?.visible && !c.locked;
            });
            return (
              <div className="mt-3 border-t border-app-border pt-2">
                <div className="mb-0.5 flex items-center justify-between gap-1">
                  <span className="text-ui font-medium text-app-subtle">Frame gap</span>
                  <EditorHintWrap
                    title="Use spacing inferred from child positions"
                    disabled={locked || parent.locked}
                  >
                    <button
                      type="button"
                      disabled={locked || parent.locked}
                      onClick={() => {
                        const inferred =
                          flowKids.length >= 2
                            ? inferAutoLayoutGap(
                                nodesAll as Record<string, LayoutNode>,
                                flowKids,
                                frameMode,
                              )
                            : 0;
                        if (frame.layoutGapAuto) {
                          updateLayout(frameId, { layoutGapAuto: false, layoutGap: inferred });
                        } else {
                          updateLayout(frameId, { layoutGapAuto: true, layoutGap: inferred });
                        }
                      }}
                      className={cn(
                        "rounded border px-2 py-0.5 text-ui font-semibold transition-colors disabled:opacity-40",
                        frame.layoutGapAuto
                          ? "border-accent/40 bg-accent/15 text-accent"
                          : "border-app-border text-app-muted hover:bg-app-hover",
                      )}
                    >
                      Auto
                    </button>
                  </EditorHintWrap>
                </div>
                {frame.layoutGapAuto ? (
                  <div className="flex h-6 items-center rounded border border-app-border bg-app-panel px-1.5 text-ui text-app-fg">
                    Auto
                    <span className="ml-auto text-ui tabular-nums text-app-subtle">
                      {flowKids.length < 2
                        ? "—"
                        : `${inferAutoLayoutGap(
                            nodesAll as Record<string, LayoutNode>,
                            flowKids,
                            frameMode,
                          )}px`}
                    </span>
                  </div>
                ) : (
                  <PropertyNumberInput
                    commitOnInput={false}
                    label=""
                    value={sanitizeLayoutGapForFrame(
                      frameId,
                      nodesAll,
                      childOrder,
                      frame.layoutGap,
                    )}
                    instanceKey={`${frameId}-parent-gap`}
                    disabled={locked || parent.locked}
                    min={computeMinLayoutGap(
                      frameId,
                      nodesAll as Record<string, LayoutEngineNode>,
                      childOrder,
                    )}
                    max={LAYOUT_GAP_MAX}
                    onCommit={(v) =>
                      updateLayout(frameId, {
                        layoutGap: sanitizeLayoutGapForFrame(
                          frameId,
                          nodesAll,
                          childOrder,
                          v,
                        ),
                        layoutGapAuto: false,
                      })
                    }
                  />
                )}
              </div>
            );
          })() : null}
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-ui font-medium text-app-subtle">Absolute position</span>
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                updateLayoutPositioning(
                  id,
                  (node.layoutPositioning ?? "auto") === "absolute" ? "auto" : "absolute",
                )
              }
              className={cn(
                "rounded border px-2 py-0.5 text-ui font-medium transition-colors disabled:opacity-40",
                (node.layoutPositioning ?? "auto") === "absolute"
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-app-border text-app-muted hover:bg-app-hover",
              )}
            >
              {(node.layoutPositioning ?? "auto") === "absolute" ? "On" : "Off"}
            </button>
          </div>
        </PropertiesSection>
      ) : null}

      {isImage && (
        <PropertiesSection title="Image" defaultOpen>
          <div className="mb-2 overflow-hidden rounded border border-app-border bg-app-toolbar-well">
            {imagePreviewSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imagePreviewSrc}
                alt=""
                className="mx-auto max-h-[120px] w-full object-contain"
              />
            ) : (
              <div className="flex h-[100px] items-center justify-center text-ui text-[#737373]">No preview</div>
            )}
          </div>
          <p className="mb-1.5 truncate text-ui text-app-muted" title={node.imageName ?? node.name}>
            {node.imageName ?? node.name}
          </p>
          <input
            ref={replaceImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="sr-only"
            aria-hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              await replaceImageAsset(id, file);
            }}
          />
          <button
            type="button"
            disabled={locked}
            onClick={() => replaceImageInputRef.current?.click()}
            className="mb-2 inspector-section-action"
          >
            Replace image…
          </button>
          <div className="mb-1.5 text-ui font-medium text-app-subtle">Fit mode</div>
          <select
            disabled={locked}
            className={cn(
              field,
              "mb-2 w-full rounded border border-app-border bg-app-panel text-app-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            )}
            value={node.imageFitMode ?? "fill"}
            onChange={(e) => style({ imageFitMode: e.target.value as "fill" | "fit" | "crop" })}
          >
            <option value="fill">Fill</option>
            <option value="fit">Fit</option>
            <option value="crop">Crop</option>
          </select>
          <PropertyNumberInput
            commitOnInput={false}
            label="Image fill %"
            value={Math.round(fillOpacity * 100)}
            instanceKey={`${key}-img-op`}
            disabled={locked}
            min={0}
            max={100}
            onCommit={(v) => style({ fillOpacity: Math.min(1, Math.max(0, v / 100)) })}
          />
        </PropertiesSection>
      )}

      {isPath && (
        <PropertiesSection title="Path" defaultOpen>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-ui font-medium text-app-subtle">Closed path</span>
            <button
              type="button"
              disabled={locked}
              onClick={() => togglePathClosed(id)}
              className={cn(
                "rounded border px-2 py-0.5 text-ui font-medium transition-colors disabled:opacity-40",
                node.pathClosed
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-app-border text-app-muted hover:bg-app-hover",
              )}
            >
              {node.pathClosed ? "Closed" : "Open"}
            </button>
          </div>
        </PropertiesSection>
      )}

      {(isContainer || (!isContainer && !locked)) && (
        <PropertiesSection title="Layout" defaultOpen>
          {isContainer ? (
            <div className="mb-2">
              <InspectorSegmented
                options={[
                  { value: "auto" as const, label: "Auto" },
                  { value: "none" as const, label: "None" },
                ]}
                value={layoutMode === "none" ? "none" : "auto"}
                disabled={locked}
                onChange={(v) => {
                  if (v === "none") updateLayout(id, { layoutMode: "none" });
                  else if (layoutMode === "none") addAutoLayoutToContainer(id);
                }}
              />
            </div>
          ) : null}
          {!isContainer ? (
            <button
              type="button"
              disabled={locked}
              onClick={() => addAutoLayoutToSelection()}
              className={cn(
                "inspector-section-action",
                "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
              )}
            >
              <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
              Add auto layout
            </button>
          ) : layoutMode === "none" ? (
            <button
              type="button"
              disabled={locked}
              onClick={() => addAutoLayoutToContainer(id)}
              className={cn(
                "mb-2 inspector-section-action",
                "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
              )}
            >
              <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
              Add auto layout
            </button>
          ) : null}
          {isContainer && layoutMode !== "none" ? (
            <AutoLayoutInspectorPanel
              node={node}
              frameId={id}
              instanceKey={key}
              locked={locked}
              layoutMode={layoutMode}
              nodesAll={nodesAll}
              childOrder={childOrder}
              updateLayout={updateLayout}
            />
          ) : null}
          {isContainer && !node.isBooleanGroup && !node.maskId && (node.type === "frame" || node.type === "group") ? (
            <label
              className={cn(
                "mt-2 flex cursor-pointer items-center gap-2 rounded py-0.5",
                locked && "cursor-not-allowed opacity-40",
              )}
            >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-white/20 bg-app-panel accent-[#0d99ff]"
                  checked={shouldClipChildren(node)}
                  disabled={locked}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    const next: Partial<EditorNode> = { clipChildren: enabled };
                    if (enabled && layoutMode !== "none") {
                      next.layoutSizingHorizontal = "fixed";
                      next.layoutSizingVertical = "fixed";
                    }
                    patch(next);
                  }}
                />
                <span className="text-ui text-app-fg">Wrap content</span>
              </label>
          ) : null}
        </PropertiesSection>
      )}

      {isContainer && (
        <PropertiesSection title="Responsive preview" defaultOpen={false}>
          <button
            type="button"
            disabled={locked}
            onClick={() => openResponsivePreview(id)}
            className={cn(
              "flex h-7 w-full items-center justify-center gap-1.5 rounded border text-ui font-medium transition-colors disabled:opacity-40",
              "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
            )}
          >
            <Monitor className="h-3.5 w-3.5" strokeWidth={1.75} />
            Open responsive preview
          </button>
          {responsivePreview?.frameId === id ? (
            <p className="mt-1.5 text-ui font-medium text-sky-300/95">
              Preview active — use width/height sliders in the bottom panel.
            </p>
          ) : null}
        </PropertiesSection>
      )}

      {node.parentId && (
        <PropertiesSection title="Constraints" defaultOpen={false}>
          <div className="mb-0.5 text-ui font-medium text-app-subtle">Horizontal</div>
          <select
            disabled={locked}
            className={cn(
              field,
              "mb-1.5 w-full rounded border border-app-border bg-app-panel text-app-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            )}
            value={node.constraintsHorizontal ?? "left"}
            onChange={(e) =>
              updateConstraints(id, { constraintsHorizontal: e.target.value as ConstraintHorizontal })
            }
          >
            {(["left", "right", "left-right", "center", "scale"] as const).map((v) => (
              <option key={v} value={v}>
                {v === "left-right" ? "Left & right" : v}
              </option>
            ))}
          </select>
          <div className="mb-0.5 text-ui font-medium text-app-subtle">Vertical</div>
          <select
            disabled={locked}
            className={cn(
              field,
              "w-full rounded border border-app-border bg-app-panel text-app-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            )}
            value={node.constraintsVertical ?? "top"}
            onChange={(e) =>
              updateConstraints(id, { constraintsVertical: e.target.value as ConstraintVertical })
            }
          >
            {(["top", "bottom", "top-bottom", "center", "scale"] as const).map((v) => (
              <option key={v} value={v}>
                {v === "top-bottom" ? "Top & bottom" : v}
              </option>
            ))}
          </select>
        </PropertiesSection>
      )}

      <AppearanceSection
        node={node}
        instanceKey={key}
        locked={locked}
        visible={node.visible}
        layerOpacity={display.opacity ?? 1}
        canCornerRadius={canRadius}
        cornerLabels={cornerRadiusLabels}
        showArc={node.type === "ellipse"}
        onOpacityCommit={(opacity) => style({ opacity })}
        onBlendModeChange={(blendMode) => style({ blendMode })}
        onToggleVisible={() => toggleVisible(id)}
        onCornerStyle={applyCornerStyle}
        onArcStyle={style}
      />

      {canFillStroke && (
        <FillSection
          node={node}
          display={display}
          instanceKey={key}
          locked={locked}
          fillEnabled={fillEnabled}
          fillOpacity={fillOpacity}
          fillToken={fillToken}
          designTokens={designTokens}
          onStyle={style}
          onDetachToken={(kind) => detachTokenFromSelection(kind)}
          onUpdateDesignToken={(tokenId, patch) => updateDesignToken(tokenId, patch)}
        />
      )}

      {isLine ? (
        <PropertiesSection title="Line" defaultOpen>
          <PropertyNumberInput
            commitOnInput={false}
            label="Length"
            value={Math.round(lineLength(lineEndpointsFromNode(node)))}
            instanceKey={`${key}-line-len`}
            disabled
            min={0}
            onCommit={() => {}}
          />
          <div className="mt-1.5">
            <PropertyNumberInput
              commitOnInput={false}
              label="Angle °"
              value={Math.round(lineAngleDegrees(lineEndpointsFromNode(node)))}
              instanceKey={`${key}-line-ang`}
              disabled
              min={0}
              max={359}
              onCommit={() => {}}
            />
          </div>
        </PropertiesSection>
      ) : null}

      {isArrow ? (
        <PropertiesSection title="Arrow" defaultOpen>
          <PropertyNumberInput
            commitOnInput={false}
            label="Length"
            value={Math.round(lineLength(lineEndpointsFromNode(node)))}
            instanceKey={`${key}-arrow-len`}
            disabled
            min={0}
            onCommit={() => {}}
          />
          <div className="mt-1.5">
            <PropertyNumberInput
              commitOnInput={false}
              label="Angle °"
              value={Math.round(lineAngleDegrees(lineEndpointsFromNode(node)))}
              instanceKey={`${key}-arrow-ang`}
              disabled
              min={0}
              max={359}
              onCommit={() => {}}
            />
          </div>
          <div className="mt-1.5">
            <PropertyNumberInput
              commitOnInput={false}
              label="Arrowhead size"
              value={Math.round(node.arrowHeadSize ?? Math.max(10, (node.strokeWidth ?? 3) * 3))}
              instanceKey={`${key}-arrow-head-size`}
              disabled={locked}
              min={1}
              max={200}
              onCommit={(v) => style({ arrowHeadSize: Math.max(1, v) })}
            />
          </div>
        </PropertiesSection>
      ) : null}

      {(canFillStroke || isLine || isArrow) && (
        <StrokeSection
          nodeId={node.id}
          instanceKey={key}
          locked={locked}
          strokeWidth={node.strokeWidth ?? 0}
          strokeColor={node.strokeColor ?? "#000000"}
          strokeType={node.strokeType}
          strokeGradient={node.strokeGradient}
          strokeImageAssetId={node.strokeImageAssetId}
          strokeVideoAssetId={node.strokeVideoAssetId}
          strokeOpacity={node.strokeOpacity ?? 1}
          strokeEnabled={node.strokeEnabled !== false}
          strokeStyle={node.strokeStyle ?? "solid"}
          strokePosition={strokePos}
          strokeSides={node.strokeSides ?? "all"}
          strokeSidesCustom={node.strokeSidesCustom}
          strokeSidesCustomColors={node.strokeSidesCustomColors}
          showSides={showStrokeSides}
          strokeDashLength={node.strokeDashLength}
          strokeDashGap={node.strokeDashGap}
          strokeLinecap={node.strokeLinecap}
          strokeLinejoin={node.strokeLinejoin}
          strokeMiterAngle={node.strokeMiterAngle}
          strokeWidthProfile={node.strokeWidthProfile}
          strokeWidthProfileFlipped={node.strokeWidthProfileFlipped}
          strokeStartPoint={
            isArrow
              ? arrowHeadToStrokeEndpoint(resolveArrowStartKind(node))
              : node.strokeStartPoint
          }
          strokeEndPoint={
            isArrow
              ? arrowHeadToStrokeEndpoint(resolveArrowEndKind(node))
              : resolveStrokeEndPoint(node)
          }
          showEndpoints={
            node.type === "line" ||
            node.type === "arrow" ||
            (node.type === "path" && !node.pathClosed)
          }
          onStyle={(patch, opts) => {
            if (isArrow && (patch.strokeStartPoint != null || patch.strokeEndPoint != null)) {
              style({
                ...patch,
                ...arrowEndpointStylePatch({
                  ...(patch.strokeStartPoint != null
                    ? { startArrow: strokeEndpointToArrowHead(patch.strokeStartPoint) }
                    : {}),
                  ...(patch.strokeEndPoint != null
                    ? { endArrow: strokeEndpointToArrowHead(patch.strokeEndPoint) }
                    : {}),
                }),
              }, opts);
              return;
            }
            style(patch, opts);
          }}
        />
      )}

      <EffectsSection
        instanceKey={key}
        locked={locked}
        effects={display.effects ?? []}
        effectToken={
          node.effectTokenId && designTokens[node.effectTokenId]?.type === "effect"
            ? designTokens[node.effectTokenId]
            : undefined
        }
        hasEffectToken={Boolean(node.effectTokenId)}
        onAddEffect={(type) => addEffect(id, type)}
        onDetachEffectToken={() => detachEffectTokenFromSelection()}
        onToggleEffect={(effectId) => toggleEffect(id, effectId)}
        onDeleteEffect={(effectId) => deleteEffect(id, effectId)}
        onUpdateEffect={(effectId, patch) => updateEffect(id, effectId, patch)}
        onChangeEffectType={(effectId, type) => updateEffect(id, effectId, { type })}
      />

      {isPolygonNode(node) ? (
        <PropertiesSection
          title={(node.polygonSides ?? 6) === 3 ? "Triangle" : "Polygon"}
          defaultOpen
        >
          <PropertyNumberInput
            commitOnInput={false}
            label="Sides"
            value={node.polygonSides ?? 6}
            instanceKey={`${key}-sides`}
            disabled={locked}
            min={3}
            max={100}
            onCommit={(v) => {
              patch(polygonGeometryPatch(node, { polygonSides: v }));
            }}
          />
        </PropertiesSection>
      ) : null}

      {node.type === "path" && node.starPoints != null ? (
        <PropertiesSection title="Star" defaultOpen>
          <PropertyNumberInput
            commitOnInput={false}
            label="Points"
            value={node.starPoints}
            instanceKey={`${key}-star-pts`}
            disabled={locked}
            min={3}
            max={100}
            onCommit={(v) => {
              style(starGeometryPatch(node, { starPoints: v }));
            }}
          />
          <div className="mt-1.5">
            <PropertyNumberInput
              commitOnInput={false}
              label="Ratio"
              value={Math.round((node.starInnerRadius ?? 0.4) * 100)}
              instanceKey={`${key}-star-inner`}
              disabled={locked}
              min={0}
              max={100}
              onCommit={(v) => {
                style(starGeometryPatch(node, { starInnerRadius: v / 100 }));
              }}
            />
          </div>
        </PropertiesSection>
      ) : null}

      {node.isBooleanGroup && objectEditModeNodeId === id ? (
        <PropertiesSection title="Boolean" defaultOpen>
          <button
            type="button"
            className="w-full rounded border border-accent/40 py-1.5 text-ui text-accent"
            onClick={() => exitObjectEditMode()}
          >
            Exit object edit
          </button>
        </PropertiesSection>
      ) : null}

      {isMaskGroup(node) ? (
        <PropertiesSection title="Mask" defaultOpen>
          <p className="mb-2 inspector-helper-text text-[#737373]">
            Mask layer: {node.maskId ? nodesAll[node.maskId]?.name ?? "Mask" : "—"}
          </p>
          <div className="mb-3">
            <p className="mb-1.5 text-ui text-app-muted">Mask type</p>
            <InspectorSegmented
              options={[
                { value: "OUTLINE" as const, label: "Outline" },
                { value: "LUMINANCE" as const, label: "Luminance" },
                { value: "ALPHA" as const, label: "Alpha" },
              ]}
              value={
                node.figMaskType === "LUMINANCE" || node.figMaskType === "ALPHA"
                  ? node.figMaskType
                  : "OUTLINE"
              }
              disabled={locked}
              onChange={(v) => patch({ figMaskType: v })}
            />
          </div>
          <label className="mb-3 flex cursor-pointer items-center gap-2 text-ui text-app-muted">
            <input
              type="checkbox"
              className="rounded border-app-border"
              checked={Boolean(node.maskVisible)}
              disabled={locked}
              onChange={(e) => patch({ maskVisible: e.target.checked })}
            />
            Show mask layer
          </label>
          <button
            type="button"
            disabled={locked}
            className="w-full rounded border border-app-border py-1.5 text-ui font-medium text-app-muted hover:bg-white/[0.05] hover:text-app-fg disabled:opacity-40"
            onClick={() => releaseMask(id)}
          >
            Release mask
          </button>
        </PropertiesSection>
      ) : null}

      {selectedIds.length >= 2 && !node.isBooleanGroup && !isMaskGroup(node) ? (
        <PropertiesSection title="Mask" defaultOpen={false}>
          <button
            type="button"
            className="w-full rounded border border-app-border py-1.5 text-ui font-medium text-app-muted hover:bg-white/[0.05] hover:text-app-fg"
            onClick={() => useSelectionAsMask()}
          >
            Use as mask
          </button>
        </PropertiesSection>
      ) : null}

      <PropertiesSection title="Export" defaultOpen={false}>
        <InspectorExportSection
          exportBusy={exportBusy}
          pngScale={pngScale}
          onPngScaleChange={setPngScale}
          onExportPng={onExportPng}
          onExportSvg={onExportSvg}
          onExportPdf={onExportPdf}
        />
      </PropertiesSection>
    </>
  );
}
