"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  AlignHorizontalSpaceBetween,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalSpaceBetween,
  Boxes,
  Component,
  Copy,
  LayoutTemplate,
  Link2,
  Monitor,
  StretchHorizontal,
  StretchVertical,
  Unlink,
} from "lucide-react";
import { PropertiesSection } from "./PropertiesSection";
import { PropertyNumberInput, PropertyTextInput } from "./PropertyInput";
import { FontFamilyPicker } from "./FontFamilyPicker";
import { ColorInput } from "./ColorInput";
import { cn } from "@/lib/utils";
import {
  useEditorStore,
  type EditorNode,
  type NodeStylePatch,
  type StrokePosition,
  type PrimaryAxisAlign,
  type CrossAxisAlign,
  type ConstraintHorizontal,
  type ConstraintVertical,
} from "@/stores/useEditorStore";
import { canCreateComponentFromSelection, findInstanceRoot } from "@/lib/componentModel";
import {
  isGradientValue,
  isTypographyValue,
  resolveNodeWithDesignTokens,
  type TypographyTokenValue,
  type EffectTokenValue,
} from "@/lib/designTokens";
import {
  effectiveFillType,
  effectiveStrokeType,
  normalizeFillGradient,
  normalizeStrokeGradient,
  type FillGradient,
} from "@/lib/fillGradient";
import { inferAutoLayoutGap, type LayoutNode } from "@/lib/autoLayout";
import { maxStarCornerRadius, starGeometryPatch } from "@/lib/shapes/starGeometry";
import {
  lineAngleDegrees,
  lineEndpointsFromNode,
  lineLength,
} from "@/lib/shapes/lineGeometry";
import { textResizePatch, type TextResizeMode } from "@/lib/text/textNodeModel";
import {
  arrowEndpointStylePatch,
  arrowHeadToStrokeEndpoint,
  resolveArrowEndKind,
  resolveArrowStartKind,
  strokeEndpointToArrowHead,
} from "@/lib/shapes/arrowGeometry";
import {
  isPolygonNode,
  maxPolygonCornerRadius,
  polygonGeometryPatch,
} from "@/lib/shapes/polygonGeometry";
import {
  BOOLEAN_OPERATION_LABELS,
  isMaskGroup,
  type BooleanOperation,
} from "@/lib/booleanGeometry";
import { LayoutSizingControls } from "./LayoutSizingControls";
import { AppearanceSection } from "./design-panel/AppearanceSection";
import { StrokeSection } from "./design-panel/StrokeSection";
import { EffectsSection } from "./design-panel/EffectsSection";
import { FillSection } from "./design-panel/FillSection";
import { InspectorSegmented } from "./design-panel/InspectorPrimitives";
import { PositionSection } from "./design-panel/PositionSection";
import { resolveStrokeEndPoint } from "@/lib/strokeEndpoints";

const field =
  "h-6 min-h-[24px] px-1.5 py-0 text-[12px] leading-4";

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
  const updateConstraints = useEditorStore((s) => s.updateConstraints);
  const renameNode = useEditorStore((s) => s.renameNode);
  const parent = useEditorStore((s) => (node.parentId ? s.nodes[node.parentId!] : null));
  const nodesAll = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const createComponentFromSelection = useEditorStore((s) => s.createComponentFromSelection);
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
  const createGradientTokenFromSelection = useEditorStore((s) => s.createGradientTokenFromSelection);
  const createTypographyTokenFromSelection = useEditorStore((s) => s.createTypographyTokenFromSelection);
  const createEffectTokenFromSelection = useEditorStore((s) => s.createEffectTokenFromSelection);
  const detachTokenFromSelection = useEditorStore((s) => s.detachTokenFromSelection);
  const detachEffectTokenFromSelection = useEditorStore((s) => s.detachEffectTokenFromSelection);
  const addEffect = useEditorStore((s) => s.addEffect);
  const updateEffect = useEditorStore((s) => s.updateEffect);
  const deleteEffect = useEditorStore((s) => s.deleteEffect);
  const toggleEffect = useEditorStore((s) => s.toggleEffect);
  const resizeFrameWithConstraints = useEditorStore((s) => s.resizeFrameWithConstraints);
  const openResponsivePreview = useEditorStore((s) => s.openResponsivePreview);
  const responsivePreview = useEditorStore((s) => s.responsivePreview);
  const updateBooleanOperation = useEditorStore((s) => s.updateBooleanOperation);
  const flattenSelection = useEditorStore((s) => s.flattenSelection);
  const enterObjectEditMode = useEditorStore((s) => s.enterObjectEditMode);
  const exitObjectEditMode = useEditorStore((s) => s.exitObjectEditMode);
  const useSelectionAsMask = useEditorStore((s) => s.useSelectionAsMask);
  const releaseMask = useEditorStore((s) => s.releaseMask);
  const objectEditModeNodeId = useEditorStore((s) => s.objectEditModeNodeId);

  const display = useMemo(() => resolveNodeWithDesignTokens(node, designTokens), [node, designTokens]);

  const locked = node.locked;
  const id = node.id;
  const key = id;

  const canFillStroke =
    node.type === "rectangle" ||
    node.type === "frame" ||
    node.type === "ellipse" ||
    node.type === "polygon" ||
    node.type === "path" ||
    Boolean(node.isBooleanGroup);
  const showStrokeSides = node.type === "rectangle" || node.type === "frame";
  const isLine = node.type === "line";
  const isArrow = node.type === "arrow";
  const isPath = node.type === "path";
  const isImage = node.type === "image";
  const canRadius = node.type === "rectangle" || node.type === "frame";
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
  const style = (p: NodeStylePatch) => updateNodeStyle(id, p);

  const fillOpacity = display.fillOpacity ?? 1;
  const fillEnabled = node.fillEnabled !== false;
  const fillType = effectiveFillType(display);
  const fillGradient = normalizeFillGradient(
    display.fillGradient ?? node.fillGradient,
    display.fill ?? node.fill,
  );
  const fillToken = node.fillTokenId ? designTokens[node.fillTokenId] : undefined;
  const linkedFillTokenType = fillToken?.type;

  const applyFillGradient = (next: FillGradient, opts?: { skipHistory?: boolean }) => {
    const normalized = normalizeFillGradient(next, display.fill ?? node.fill);
    if (node.fillTokenId && fillToken?.type === "gradient") {
      updateDesignToken(node.fillTokenId, { value: normalized });
      return;
    }
    updateNodeStyle(
      id,
      { fillType: "gradient", fillGradient: normalized },
      { skipHistory: opts?.skipHistory },
    );
  };
  const strokePos: StrokePosition = node.strokePosition ?? "center";
  const strokeType = effectiveStrokeType(node);
  const strokeGradient = normalizeStrokeGradient(node.strokeGradient, node.strokeColor);

  const applyStrokeGradient = (next: FillGradient, opts?: { skipHistory?: boolean }) => {
    style(
      {
        strokeType: "gradient",
        strokeGradient: normalizeStrokeGradient(next, node.strokeColor),
      },
      opts,
    );
  };

  return (
    <>
      <div className="border-b border-app-border-subtle px-2 py-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded border border-app-border bg-app-hover px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-app-muted">
            {typeLabel(node.type)}
          </span>
          {node.isComponent ? (
            <span className="inline-flex items-center gap-0.5 rounded border border-violet-500/35 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">
              <Component className="h-3 w-3" strokeWidth={1.75} />
              Component
            </span>
          ) : null}
          {instRootId ? (
            <span className="inline-flex items-center gap-0.5 rounded border border-violet-400/30 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-100">
              <Boxes className="h-3 w-3" strokeWidth={1.75} />
              Instance
            </span>
          ) : null}
        </div>
        <PropertyTextInput
          label="Name"
          value={node.name}
          instanceKey={key}
          onCommit={(name) => renameNode(id, name)}
        />
      </div>

      {node.isComponent && isContainer && (
        <PropertiesSection title="Component" defaultOpen>
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              disabled={locked}
              onClick={() => setPlacingComponentMasterId(node.id)}
              className="flex h-6 items-center justify-center gap-1.5 rounded border border-app-border bg-app-panel text-[11px] font-medium text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              Create instance
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => createVariantFromComponent(node.componentId ?? node.id)}
              className="flex h-6 items-center justify-center gap-1.5 rounded border border-app-border bg-app-panel text-[11px] font-medium text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
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
          <p className="mb-1.5 text-[11px] leading-snug text-app-muted">
            Source:{" "}
            <span className="font-medium text-app-fg">{sourceMaster?.name ?? "Unknown"}</span>
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => detachInstance(instRootId)}
            className="flex h-6 w-full items-center justify-center gap-1.5 rounded border border-app-border bg-app-panel text-[11px] font-medium text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
          >
            <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
            Detach instance
          </button>
          {instRootId !== id ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-app-subtle">
              Fill, stroke, and text edits are saved as overrides on this instance.
            </p>
          ) : null}
        </PropertiesSection>
      )}

      {!node.isComponent && !instRootId && selectedIds.length >= 1 && selectedIds[0] === id ? (
        <PropertiesSection title="Make component" defaultOpen={false}>
          <button
            type="button"
            disabled={locked || !canCreateComponentFromSelection(selectedIds, nodesAll)}
            onClick={() => createComponentFromSelection()}
            className="flex h-6 w-full items-center justify-center gap-1.5 rounded border border-violet-500/35 bg-violet-500/10 text-[11px] font-medium text-violet-100 transition-colors hover:bg-violet-500/15 disabled:opacity-40"
          >
            <Component className="h-3.5 w-3.5" strokeWidth={1.75} />
            Create component
          </button>
          <p className="mt-1 text-[10px] leading-relaxed text-app-subtle">
            Turn this selection into a reusable component. It appears in the Comp panel for drag-and-drop.
          </p>
        </PropertiesSection>
      ) : null}

      {node.type === "frame" ? (
        <PropertiesSection title="Frame" defaultOpen>
          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded py-0.5",
              locked && "cursor-not-allowed opacity-40",
            )}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-white/20 bg-app-panel accent-[#0d99ff]"
              checked={node.clipChildren !== false}
              disabled={locked}
              onChange={(e) => patch({ clipChildren: e.target.checked })}
            />
            <span className="text-[11px] text-app-fg">Clip content</span>
          </label>
          <p className="mt-1 text-[10px] leading-snug text-app-subtle">
            When enabled, layers outside the frame bounds are hidden.
          </p>
        </PropertiesSection>
      ) : null}

      <PositionSection
        node={node}
        instanceKey={key}
        locked={locked}
        parentAutoLayout={parentAutoLayout}
        isContainer={isContainer}
        onPatch={patch}
        onResizeFrame={(width, height) => resizeFrameWithConstraints(id, { width, height })}
      />

      {inAutoLayoutParent && layoutMode === "none" ? (
        <PropertiesSection title="Layout" defaultOpen>
          <p className="mb-2 text-[10px] leading-snug text-app-subtle">
            Sizing in parent auto-layout frame.
          </p>
          <LayoutSizingControls node={node} nodes={nodesAll} locked={locked} />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-app-subtle">Absolute position</span>
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
                "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40",
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
              <div className="flex h-[100px] items-center justify-center text-[11px] text-[#737373]">No preview</div>
            )}
          </div>
          <p className="mb-1.5 truncate text-[11px] text-app-muted" title={node.imageName ?? node.name}>
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
            className="mb-2 flex h-6 w-full items-center justify-center gap-1.5 rounded border border-app-border bg-app-panel text-[11px] font-medium text-app-fg transition-colors hover:bg-app-hover disabled:opacity-40"
          >
            Replace image…
          </button>
          <div className="mb-1.5 text-[11px] font-medium text-app-subtle">Fit mode</div>
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
            <span className="text-[11px] font-medium text-app-subtle">Closed path</span>
            <button
              type="button"
              disabled={locked}
              onClick={() => togglePathClosed(id)}
              className={cn(
                "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40",
                node.pathClosed
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-app-border text-app-muted hover:bg-app-hover",
              )}
            >
              {node.pathClosed ? "Closed" : "Open"}
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-app-subtle">
            Double-click the path on the canvas to toggle anchor editing. With anchors shown, Backspace removes the
            selected point.
          </p>
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
                  else if (layoutMode === "none") addAutoLayoutToSelection();
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
                "flex h-6 w-full items-center justify-center gap-1.5 rounded border text-[11px] font-medium transition-colors disabled:opacity-40",
                "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
              )}
            >
              <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
              Add auto layout
            </button>
          ) : layoutMode === "none" ? (
            <p className="text-[10px] leading-snug text-app-subtle">
              Switch to Auto to enable horizontal or vertical stack (⇧A).
            </p>
          ) : (
            <>
              <div className="mb-1 text-[11px] font-medium text-app-subtle">Direction</div>
              <div className="mb-1.5 flex gap-0.5">
                {(
                  [
                    { mode: "none" as const, label: "Off" },
                    { mode: "horizontal" as const, label: "H", icon: AlignHorizontalJustifyStart },
                    { mode: "vertical" as const, label: "V", icon: AlignVerticalJustifyStart },
                  ] as const
                ).map((opt) => {
                  const Icon = "icon" in opt ? opt.icon : null;
                  const active = layoutMode === opt.mode;
                  return (
                    <button
                      key={opt.mode}
                      type="button"
                      disabled={locked}
                      onClick={() => updateLayout(id, { layoutMode: opt.mode })}
                      className={cn(
                        "flex h-6 flex-1 items-center justify-center gap-0.5 rounded border text-[10px] font-semibold transition-colors disabled:opacity-40",
                        active
                          ? "border-accent/45 bg-accent/15 text-white"
                          : "border-app-border text-app-muted hover:bg-app-hover",
                      )}
                    >
                      {Icon ? <Icon className="h-3 w-3" strokeWidth={1.75} /> : null}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <div className="mb-1.5">
                <div className="mb-0.5 flex items-center justify-between gap-1">
                  <span className="text-[11px] font-medium text-app-subtle">Gap</span>
                  <button
                    type="button"
                    disabled={locked}
                    title="Use spacing inferred from child positions"
                    onClick={() => {
                      const flowKids = (childOrder[id] ?? []).filter((cid) => {
                        const c = nodesAll[cid];
                        return c?.visible && !c.locked;
                      });
                      const inferred =
                        flowKids.length >= 2
                          ? inferAutoLayoutGap(
                              nodesAll as Record<string, LayoutNode>,
                              flowKids,
                              layoutMode,
                            )
                          : 0;
                      if (node.layoutGapAuto) {
                        updateLayout(id, { layoutGapAuto: false, layoutGap: inferred });
                      } else {
                        updateLayout(id, { layoutGapAuto: true, layoutGap: inferred });
                      }
                    }}
                    className={cn(
                      "rounded border px-2 py-0.5 text-[10px] font-semibold transition-colors disabled:opacity-40",
                      node.layoutGapAuto
                        ? "border-accent/40 bg-accent/15 text-accent"
                        : "border-app-border text-app-muted hover:bg-app-hover",
                    )}
                  >
                    Auto
                  </button>
                </div>
                {node.layoutGapAuto ? (
                  <div
                    className={cn(
                      "flex h-6 items-center rounded border border-app-border bg-app-panel px-1.5",
                      locked && "opacity-50",
                    )}
                    title="Gap is calculated from current child spacing"
                  >
                    <span className="text-[12px] font-medium text-app-fg">Auto</span>
                    <span className="ml-auto text-[10px] tabular-nums text-app-subtle">
                      {(() => {
                        const flowKids = (childOrder[id] ?? []).filter((cid) => {
                          const c = nodesAll[cid];
                          return c?.visible && !c.locked;
                        });
                        if (flowKids.length < 2) return "—";
                        return `${inferAutoLayoutGap(
                          nodesAll as Record<string, LayoutNode>,
                          flowKids,
                          layoutMode,
                        )}px`;
                      })()}
                    </span>
                  </div>
                ) : (
                  <PropertyNumberInput
                    commitOnInput={false}
                    label=""
                    value={node.layoutGap ?? 0}
                    instanceKey={`${key}-gap`}
                    disabled={locked}
                    min={0}
                    max={256}
                    onCommit={(v) =>
                      updateLayout(id, { layoutGap: Math.max(0, v), layoutGapAuto: false })
                    }
                  />
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-app-subtle">Wrap</span>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => updateLayout(id, { layoutWrap: !node.layoutWrap })}
                  className={cn(
                    "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40",
                    node.layoutWrap
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-app-border text-app-muted hover:bg-app-hover",
                  )}
                >
                  {node.layoutWrap ? "On" : "Off"}
                </button>
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-app-subtle">Padding</div>
              <div className="mt-0.5 grid grid-cols-4 gap-1">
                <PropertyNumberInput commitOnInput={false}
                  label="T"
                  value={node.paddingTop ?? 0}
                  instanceKey={`${key}-pt`}
                  disabled={locked}
                  min={0}
                  max={999}
                  onCommit={(v) => updateLayout(id, { paddingTop: Math.max(0, v) })}
                />
                <PropertyNumberInput commitOnInput={false}
                  label="R"
                  value={node.paddingRight ?? 0}
                  instanceKey={`${key}-pr`}
                  disabled={locked}
                  min={0}
                  max={999}
                  onCommit={(v) => updateLayout(id, { paddingRight: Math.max(0, v) })}
                />
                <PropertyNumberInput commitOnInput={false}
                  label="B"
                  value={node.paddingBottom ?? 0}
                  instanceKey={`${key}-pb`}
                  disabled={locked}
                  min={0}
                  max={999}
                  onCommit={(v) => updateLayout(id, { paddingBottom: Math.max(0, v) })}
                />
                <PropertyNumberInput commitOnInput={false}
                  label="L"
                  value={node.paddingLeft ?? 0}
                  instanceKey={`${key}-pl`}
                  disabled={locked}
                  min={0}
                  max={999}
                  onCommit={(v) => updateLayout(id, { paddingLeft: Math.max(0, v) })}
                />
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-app-subtle">Primary axis</div>
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {(layoutMode === "horizontal"
                  ? ([
                      { v: "start" as const, Icon: AlignHorizontalJustifyStart, title: "Start" },
                      { v: "center" as const, Icon: AlignHorizontalJustifyCenter, title: "Center" },
                      { v: "end" as const, Icon: AlignHorizontalJustifyEnd, title: "End" },
                      { v: "space-between" as const, Icon: AlignHorizontalSpaceBetween, title: "Space between" },
                    ] as const)
                  : ([
                      { v: "start" as const, Icon: AlignVerticalJustifyStart, title: "Start" },
                      { v: "center" as const, Icon: AlignVerticalJustifyCenter, title: "Center" },
                      { v: "end" as const, Icon: AlignVerticalJustifyEnd, title: "End" },
                      { v: "space-between" as const, Icon: AlignVerticalSpaceBetween, title: "Space between" },
                    ] as const)
                ).map(({ v, Icon, title }) => {
                  const cur = (node.primaryAxisAlign ?? "start") as PrimaryAxisAlign;
                  const active = cur === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      title={title}
                      disabled={locked}
                      onClick={() => updateLayout(id, { primaryAxisAlign: v })}
                      className={cn(
                        "flex h-6 w-8 items-center justify-center rounded border transition-colors disabled:opacity-40",
                        active
                          ? "border-accent/45 bg-accent/15 text-white"
                          : "border-app-border text-app-muted hover:bg-app-hover",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 border-t border-app-border-subtle pt-2">
                <div className="mb-1.5 text-[11px] font-medium text-app-subtle">Frame sizing</div>
                <p className="mb-2 text-[10px] leading-snug text-app-subtle">
                  Hug shrinks the frame to fit children; fixed keeps your current size on that axis.
                </p>
                <LayoutSizingControls node={node} nodes={nodesAll} locked={locked} />
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-app-subtle">Counter axis</div>
              <div className="mt-0.5 flex flex-wrap gap-0.5">
                {(layoutMode === "horizontal"
                  ? ([
                      { v: "start" as const, Icon: AlignVerticalJustifyStart },
                      { v: "center" as const, Icon: AlignVerticalJustifyCenter },
                      { v: "end" as const, Icon: AlignVerticalJustifyEnd },
                      { v: "stretch" as const, Icon: StretchVertical },
                    ] as const)
                  : ([
                      { v: "start" as const, Icon: AlignHorizontalJustifyStart },
                      { v: "center" as const, Icon: AlignHorizontalJustifyCenter },
                      { v: "end" as const, Icon: AlignHorizontalJustifyEnd },
                      { v: "stretch" as const, Icon: StretchHorizontal },
                    ] as const)
                ).map(({ v, Icon }) => {
                  const cur = (node.counterAxisAlign ?? "start") as CrossAxisAlign;
                  const active = cur === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      disabled={locked}
                      onClick={() => updateLayout(id, { counterAxisAlign: v })}
                      className={cn(
                        "flex h-6 w-8 items-center justify-center rounded border transition-colors disabled:opacity-40",
                        active
                          ? "border-accent/45 bg-accent/15 text-white"
                          : "border-app-border text-app-muted hover:bg-app-hover",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 border-t border-app-border-subtle pt-2">
                <div className="mb-1 text-[11px] font-medium text-app-subtle">Min / max size</div>
                <div className="grid grid-cols-2 gap-1">
                  <PropertyNumberInput
                    commitOnInput={false}
                    label="Min W"
                    value={node.minWidth ?? 0}
                    instanceKey={`${key}-minw`}
                    disabled={locked}
                    min={0}
                    max={99999}
                    onCommit={(v) =>
                      updateLayout(id, { minWidth: v > 0 ? v : undefined })
                    }
                  />
                  <PropertyNumberInput
                    commitOnInput={false}
                    label="Max W"
                    value={node.maxWidth ?? 0}
                    instanceKey={`${key}-maxw`}
                    disabled={locked}
                    min={0}
                    max={99999}
                    onCommit={(v) =>
                      updateLayout(id, { maxWidth: v > 0 ? v : undefined })
                    }
                  />
                  <PropertyNumberInput
                    commitOnInput={false}
                    label="Min H"
                    value={node.minHeight ?? 0}
                    instanceKey={`${key}-minh`}
                    disabled={locked}
                    min={0}
                    max={99999}
                    onCommit={(v) =>
                      updateLayout(id, { minHeight: v > 0 ? v : undefined })
                    }
                  />
                  <PropertyNumberInput
                    commitOnInput={false}
                    label="Max H"
                    value={node.maxHeight ?? 0}
                    instanceKey={`${key}-maxh`}
                    disabled={locked}
                    min={0}
                    max={99999}
                    onCommit={(v) =>
                      updateLayout(id, { maxHeight: v > 0 ? v : undefined })
                    }
                  />
                </div>
              </div>
            </>
          )}
        </PropertiesSection>
      )}

      {isContainer && (
        <PropertiesSection title="Responsive preview" defaultOpen={false}>
          <p className="mb-1.5 text-[10px] leading-relaxed text-app-subtle">
            Try viewport sizes with live constraint behavior. Changes stay temporary until you apply from the panel
            below.
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => openResponsivePreview(id)}
            className={cn(
              "flex h-7 w-full items-center justify-center gap-1.5 rounded border text-[11px] font-medium transition-colors disabled:opacity-40",
              "border-app-border bg-app-panel text-app-fg hover:bg-app-hover",
            )}
          >
            <Monitor className="h-3.5 w-3.5" strokeWidth={1.75} />
            Open responsive preview
          </button>
          {responsivePreview?.frameId === id ? (
            <p className="mt-1.5 text-[10px] font-medium text-sky-300/95">
              Preview active — use width/height sliders in the bottom panel.
            </p>
          ) : null}
        </PropertiesSection>
      )}

      {node.parentId && (
        <PropertiesSection title="Constraints" defaultOpen={false}>
          <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Horizontal</div>
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
          <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Vertical</div>
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
        layerOpacity={display.opacity ?? 1}
        canCornerRadius={canRadius}
        showArc={node.type === "ellipse"}
        onOpacityCommit={(opacity) => style({ opacity })}
        onBlendModeChange={(blendMode) => style({ blendMode })}
        onCornerStyle={style}
      />

      {canFillStroke && (
        <FillSection
          node={node}
          display={display}
          instanceKey={key}
          locked={locked}
          fillType={fillType}
          fillEnabled={fillEnabled}
          fillOpacity={fillOpacity}
          fillGradient={fillGradient}
          fillToken={fillToken}
          linkedFillTokenType={linkedFillTokenType}
          designTokens={designTokens}
          onStyle={style}
          onApplyGradient={applyFillGradient}
          onCreateColorToken={() => createColorTokenFromSelection()}
          onCreateGradientToken={() => createGradientTokenFromSelection()}
          onDetachToken={(kind) => detachTokenFromSelection(kind)}
          onUpdateDesignToken={(tokenId, patch) => updateDesignToken(tokenId, patch)}
          onBeginDrag={() => pushHistory()}
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
          instanceKey={key}
          locked={locked}
          strokeWidth={node.strokeWidth ?? 0}
          strokeColor={node.strokeColor ?? "#000000"}
          strokeType={strokeType}
          strokeGradient={strokeGradient}
          strokeOpacity={node.strokeOpacity ?? 1}
          onApplyStrokeGradient={applyStrokeGradient}
          strokeEnabled={node.strokeEnabled !== false}
          strokeStyle={node.strokeStyle ?? "solid"}
          strokePosition={strokePos}
          strokeSides={node.strokeSides ?? "all"}
          strokeSidesCustom={node.strokeSidesCustom}
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
          onStyle={(patch) => {
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
              });
              return;
            }
            style(patch);
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
        onCreateEffectToken={() => createEffectTokenFromSelection()}
        onDetachEffectToken={() => detachEffectTokenFromSelection()}
        onToggleEffect={(effectId) => toggleEffect(id, effectId)}
        onDeleteEffect={(effectId) => deleteEffect(id, effectId)}
        onUpdateEffect={(effectId, patch) => updateEffect(id, effectId, patch)}
        onChangeEffectType={(effectId, type) => updateEffect(id, effectId, { type })}
      />

      {isPolygonNode(node) ? (
        <PropertiesSection title="Polygon" defaultOpen>
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
          <div className="mt-1.5">
            <PropertyNumberInput
              commitOnInput={false}
              label="Corner radius"
              value={Math.round(node.cornerRadius ?? 0)}
              instanceKey={`${key}-poly-corner`}
              disabled={locked}
              min={0}
              max={Math.round(
                maxPolygonCornerRadius(
                  node.polygonSides ?? 6,
                  node.width,
                  node.height,
                ),
              )}
              onCommit={(v) => {
                patch(polygonGeometryPatch(node, { cornerRadius: v }));
              }}
            />
          </div>
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
          <div className="mt-1.5">
            <PropertyNumberInput
              commitOnInput={false}
              label="Corner radius"
              value={Math.round(node.cornerRadius ?? 0)}
              instanceKey={`${key}-star-corner`}
              disabled={locked}
              min={0}
              max={Math.round(
                maxStarCornerRadius(
                  node.starPoints ?? 5,
                  node.starInnerRadius ?? 0.4,
                  node.width,
                  node.height,
                ),
              )}
              onCommit={(v) => {
                style(starGeometryPatch(node, { cornerRadius: v }));
              }}
            />
          </div>
        </PropertiesSection>
      ) : null}

      {isText && (
        <PropertiesSection title="Typography" defaultOpen>
          {node.textStyleTokenId && designTokens[node.textStyleTokenId]?.type === "typography" ? (
            <p className="mb-1.5 truncate text-[10px] text-app-muted">
              Linked typography:{" "}
              <span className="font-medium text-app-fg">{designTokens[node.textStyleTokenId]!.name}</span>
            </p>
          ) : null}
          {node.fillTokenId && designTokens[node.fillTokenId]?.type === "color" ? (
            <p className="mb-1.5 truncate text-[10px] text-app-muted">
              Linked color style:{" "}
              <span className="font-medium text-app-fg">{designTokens[node.fillTokenId]!.name}</span>
            </p>
          ) : null}
          <div className="mb-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={locked}
              onClick={() => createTypographyTokenFromSelection()}
              className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
            >
              Create typography style
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => createColorTokenFromSelection()}
              className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
            >
              Create color style
            </button>
            {node.textStyleTokenId ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => detachTokenFromSelection("typography")}
                className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
              >
                Detach typography
              </button>
            ) : null}
            {node.fillTokenId ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => detachTokenFromSelection("color")}
                className="rounded border border-app-border bg-app-panel px-2 py-0.5 text-[10px] font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
              >
                Detach color style
              </button>
            ) : null}
          </div>
          <textarea
            disabled={locked}
            className={cn(
              "min-h-[72px] w-full resize-y rounded border border-app-border bg-app-field p-1.5 text-[12px] leading-snug text-app-field-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-45",
              field,
            )}
            value={textContentDraft}
            onChange={(e) => setTextContentDraft(e.target.value)}
            onBlur={() => {
              const cur = useEditorStore.getState().nodes[id]?.content ?? "";
              if (textContentDraft !== cur) style({ content: textContentDraft });
            }}
          />
          <div className="mt-1.5">
            <div className="mb-0.5 text-[11px] font-medium leading-4 text-app-subtle">Resize</div>
            <select
              disabled={locked}
              className={cn(field, "w-full cursor-pointer")}
              value={node.textResizeMode ?? "auto-width"}
              onChange={(e) => {
                style(textResizePatch(e.target.value as TextResizeMode));
              }}
            >
              <option value="auto-width">Auto width</option>
              <option value="auto-height">Auto height</option>
              <option value="fixed">Fixed size</option>
            </select>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-1.5">
            <div>
              <div className="mb-0.5 text-[11px] font-medium leading-4 text-app-subtle">Align</div>
              <select
                disabled={locked}
                className={cn(field, "w-full cursor-pointer")}
                value={node.textAlign ?? "left"}
                onChange={(e) =>
                  style({
                    textAlign: e.target.value as "left" | "center" | "right" | "justify",
                  })
                }
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
                <option value="justify">Justify</option>
              </select>
            </div>
            <div>
              <div className="mb-0.5 text-[11px] font-medium leading-4 text-app-subtle">Vertical</div>
              <select
                disabled={locked}
                className={cn(field, "w-full cursor-pointer")}
                value={node.verticalAlign ?? "top"}
                onChange={(e) =>
                  style({
                    verticalAlign: e.target.value as "top" | "middle" | "bottom",
                  })
                }
              >
                <option value="top">Top</option>
                <option value="middle">Middle</option>
                <option value="bottom">Bottom</option>
              </select>
            </div>
          </div>
          <div className="mt-1.5">
            <ColorInput
              label="Text color"
              libraryName={
                node.fillTokenId && designTokens[node.fillTokenId]?.type === "color"
                  ? designTokens[node.fillTokenId]!.name
                  : undefined
              }
              libraryTokenId={
                node.fillTokenId && designTokens[node.fillTokenId]?.type === "color"
                  ? node.fillTokenId
                  : undefined
              }
              hex={display.textColor ?? display.fill ?? "#111111"}
              instanceKey={`${key}-tc`}
              disabled={locked}
              onCommitHex={(hex, opts) => {
                useEditorStore.getState().setNodeTextColorHex(id, hex, opts);
              }}
            />
          </div>
          <div className="mt-1.5">
            <div className="mb-0.5 text-[11px] font-medium leading-4 text-app-subtle">Font</div>
            <FontFamilyPicker
              value={
                display.fontFamily ?? "var(--font-inter), Inter, system-ui, sans-serif"
              }
              disabled={locked}
              onChange={(v) => {
                if (node.textStyleTokenId) {
                  const t = designTokens[node.textStyleTokenId];
                  if (t?.type === "typography" && isTypographyValue(t.value)) {
                    updateDesignToken(node.textStyleTokenId, {
                      value: { ...(t.value as TypographyTokenValue), fontFamily: v },
                    });
                    return;
                  }
                }
                style({ fontFamily: v });
              }}
              className="w-full"
              buttonClassName="w-full"
            />
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1.5">
            <PropertyNumberInput commitOnInput={false}
              label="Size"
              value={display.fontSize ?? 13}
              instanceKey={key}
              disabled={locked}
              min={1}
              max={512}
              onCommit={(v) => {
                if (node.textStyleTokenId) {
                  const t = designTokens[node.textStyleTokenId];
                  if (t?.type === "typography" && isTypographyValue(t.value)) {
                    updateDesignToken(node.textStyleTokenId, {
                      value: { ...(t.value as TypographyTokenValue), fontSize: v },
                    });
                    return;
                  }
                }
                style({ fontSize: v });
              }}
            />
            <PropertyNumberInput commitOnInput={false}
              label="Weight"
              value={display.fontWeight ?? 500}
              instanceKey={key}
              disabled={locked}
              min={100}
              max={900}
              onCommit={(v) => {
                const w = Math.round(Math.min(900, Math.max(100, v)));
                if (node.textStyleTokenId) {
                  const t = designTokens[node.textStyleTokenId];
                  if (t?.type === "typography" && isTypographyValue(t.value)) {
                    updateDesignToken(node.textStyleTokenId, {
                      value: { ...(t.value as TypographyTokenValue), fontWeight: w },
                    });
                    return;
                  }
                }
                style({ fontWeight: w });
              }}
            />
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1.5">
            <PropertyNumberInput commitOnInput={false}
              label="Line height"
              value={display.lineHeight ?? 1.25}
              instanceKey={key}
              disabled={locked}
              min={0.5}
              max={4}
              decimals={2}
              onCommit={(v) => {
                if (node.textStyleTokenId) {
                  const t = designTokens[node.textStyleTokenId];
                  if (t?.type === "typography" && isTypographyValue(t.value)) {
                    updateDesignToken(node.textStyleTokenId, {
                      value: { ...(t.value as TypographyTokenValue), lineHeight: v },
                    });
                    return;
                  }
                }
                style({ lineHeight: v });
              }}
            />
            <PropertyNumberInput commitOnInput={false}
              label="Letter px"
              value={display.letterSpacing ?? 0}
              instanceKey={key}
              disabled={locked}
              min={-20}
              max={80}
              decimals={1}
              onCommit={(v) => {
                if (node.textStyleTokenId) {
                  const t = designTokens[node.textStyleTokenId];
                  if (t?.type === "typography" && isTypographyValue(t.value)) {
                    updateDesignToken(node.textStyleTokenId, {
                      value: { ...(t.value as TypographyTokenValue), letterSpacing: v },
                    });
                    return;
                  }
                }
                style({ letterSpacing: v });
              }}
            />
          </div>
        </PropertiesSection>
      )}

      {node.isBooleanGroup ? (
        <PropertiesSection title="Boolean" defaultOpen>
          <p className="mb-2 text-[10px] leading-snug text-[#737373]">
            Operation: {BOOLEAN_OPERATION_LABELS[node.booleanOperation ?? "union"]}
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {(["union", "subtract", "intersect", "exclude"] as BooleanOperation[]).map((op) => (
              <button
                key={op}
                type="button"
                disabled={locked}
                onClick={() => updateBooleanOperation(id, op)}
                className={cn(
                  "rounded border px-2 py-0.5 text-[10px] font-medium capitalize",
                  (node.booleanOperation ?? "union") === op
                    ? "border-[#18a0fb] bg-[#18a0fb]/15 text-white"
                    : "border-app-border text-app-muted hover:bg-app-hover",
                )}
              >
                {BOOLEAN_OPERATION_LABELS[op]}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={locked}
              className="flex-1 rounded border border-app-border py-1.5 text-[11px] font-medium text-app-muted hover:bg-white/[0.05] hover:text-app-fg disabled:opacity-40"
              onClick={() => flattenSelection()}
            >
              Flatten
            </button>
            <button
              type="button"
              disabled={locked}
              className="flex-1 rounded border border-app-border py-1.5 text-[11px] font-medium text-app-muted hover:bg-white/[0.05] hover:text-app-fg disabled:opacity-40"
              onClick={() => enterObjectEditMode(id)}
            >
              Edit object
            </button>
          </div>
          {objectEditModeNodeId === id ? (
            <button
              type="button"
              className="mt-1.5 w-full rounded border border-[#18a0fb]/40 py-1 text-[11px] text-[#18a0fb]"
              onClick={() => exitObjectEditMode()}
            >
              Exit object edit
            </button>
          ) : null}
        </PropertiesSection>
      ) : null}

      {isMaskGroup(node) ? (
        <PropertiesSection title="Mask" defaultOpen>
          <p className="mb-2 text-[10px] leading-snug text-[#737373]">
            Mask layer: {node.maskId ? nodesAll[node.maskId]?.name ?? "Mask" : "—"}
          </p>
          {node.figMaskType === "LUMINANCE" ? (
            <p className="mb-2 text-[10px] leading-snug text-app-subtle">
              Figma luminance mask — shown as vector outline clip in this editor.
            </p>
          ) : null}
          <button
            type="button"
            disabled={locked}
            className="w-full rounded border border-app-border py-1.5 text-[11px] font-medium text-app-muted hover:bg-white/[0.05] hover:text-app-fg disabled:opacity-40"
            onClick={() => releaseMask(id)}
          >
            Release mask
          </button>
        </PropertiesSection>
      ) : null}

      {selectedIds.length >= 2 && !node.isBooleanGroup && !isMaskGroup(node) ? (
        <PropertiesSection title="Mask" defaultOpen={false}>
          <p className="mb-2 text-[10px] leading-snug text-[#737373]">
            Select content and mask shape, then use as mask. Topmost shape becomes the mask.
          </p>
          <button
            type="button"
            className="w-full rounded border border-app-border py-1.5 text-[11px] font-medium text-app-muted hover:bg-white/[0.05] hover:text-app-fg"
            onClick={() => useSelectionAsMask()}
          >
            Use as mask
          </button>
        </PropertiesSection>
      ) : null}

      <PropertiesSection title="Export" defaultOpen={false}>
        <div className="flex gap-1.5">
          <button
            type="button"
            className="flex-1 rounded border border-app-border py-1.5 text-[11px] font-medium text-app-muted transition-colors hover:bg-white/[0.05] hover:text-app-fg"
          >
            PNG
          </button>
          <button
            type="button"
            className="flex-1 rounded border border-app-border py-1.5 text-[11px] font-medium text-app-muted transition-colors hover:bg-white/[0.05] hover:text-app-fg"
          >
            SVG
          </button>
        </div>
      </PropertiesSection>
    </>
  );
}
