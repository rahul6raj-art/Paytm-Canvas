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
  Eye,
  EyeOff,
  LayoutTemplate,
  Link2,
  Lock,
  Monitor,
  StretchHorizontal,
  StretchVertical,
  Unlock,
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
  isColorValue,
  isGradientValue,
  isTypographyValue,
  isEffectValue,
  resolveNodeWithDesignTokens,
  type ColorTokenValue,
  type TypographyTokenValue,
  type EffectTokenValue,
} from "@/lib/designTokens";
import type { NodeEffect, NodeEffectType } from "@/lib/nodeEffects";
import {
  defaultFillGradient,
  effectiveFillType,
  fillPaintCss,
  newGradientStopId,
  normalizeFillGradient,
} from "@/lib/fillGradient";
import { generatePolygonPoints, generateStarPoints } from "@/lib/shapes/pathGenerators";
import {
  BOOLEAN_OPERATION_LABELS,
  isMaskGroup,
  type BooleanOperation,
} from "@/lib/booleanGeometry";

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

function effectTypeLabel(t: NodeEffectType): string {
  switch (t) {
    case "drop-shadow":
      return "Drop shadow";
    case "inner-shadow":
      return "Inner shadow";
    case "layer-blur":
      return "Layer blur";
    case "background-blur":
      return "Background blur";
  }
}

export function DesignInspector({ node }: { node: EditorNode }) {
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const updateLayout = useEditorStore((s) => s.updateLayout);
  const updateConstraints = useEditorStore((s) => s.updateConstraints);
  const renameNode = useEditorStore((s) => s.renameNode);
  const setNodeVisible = useEditorStore((s) => s.setNodeVisible);
  const setNodeLocked = useEditorStore((s) => s.setNodeLocked);
  const parent = useEditorStore((s) => (node.parentId ? s.nodes[node.parentId!] : null));
  const nodesAll = useEditorStore((s) => s.nodes);
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
    node.type === "rectangle" || node.type === "frame" || node.type === "ellipse" || node.type === "path";
  const isLine = node.type === "line";
  const isPath = node.type === "path";
  const isImage = node.type === "image";
  const canRadius = node.type === "rectangle" || node.type === "frame";
  const isText = node.type === "text";

  const isContainer = node.type === "frame" || node.type === "group";
  const layoutMode = node.layoutMode ?? "none";
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
  const fillType = effectiveFillType(node);
  const fillGradient = normalizeFillGradient(node.fillGradient, display.fill ?? node.fill);
  const fillToken = node.fillTokenId ? designTokens[node.fillTokenId] : undefined;
  const linkedFillTokenType = fillToken?.type;
  const strokePos: StrokePosition = node.strokePosition ?? "center";

  return (
    <>
      <div className="border-b border-white/[0.06] px-2 py-2">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="rounded border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#9a9a9a]">
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
              className="flex h-6 items-center justify-center gap-1.5 rounded border border-white/[0.1] bg-[#2c2c2c] text-[11px] font-medium text-[#e6e6e6] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
            >
              <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              Create instance
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => createVariantFromComponent(node.componentId ?? node.id)}
              className="flex h-6 items-center justify-center gap-1.5 rounded border border-white/[0.1] bg-[#2c2c2c] text-[11px] font-medium text-[#e6e6e6] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
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
          <p className="mb-1.5 text-[11px] leading-snug text-[#9a9a9a]">
            Source:{" "}
            <span className="font-medium text-[#d4d4d4]">{sourceMaster?.name ?? "Unknown"}</span>
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => detachInstance(instRootId)}
            className="flex h-6 w-full items-center justify-center gap-1.5 rounded border border-white/[0.1] bg-[#2c2c2c] text-[11px] font-medium text-[#e6e6e6] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
          >
            <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} />
            Detach instance
          </button>
          {instRootId !== id ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#6b6b6b]">
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
          <p className="mt-1 text-[10px] leading-relaxed text-[#6b6b6b]">
            Turn this selection into a reusable component. It appears in the Comp panel for drag-and-drop.
          </p>
        </PropertiesSection>
      ) : null}

      <PropertiesSection title="Layer" defaultOpen>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setNodeVisible(id, !node.visible)}
            className={cn(
              "flex h-6 flex-1 items-center justify-center gap-1 rounded border text-[11px] font-medium transition-colors",
              node.visible
                ? "border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] hover:bg-white/[0.06]"
                : "border-white/[0.06] bg-black/20 text-[#737373] hover:text-[#c4c4c4]",
            )}
          >
            {node.visible ? (
              <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {node.visible ? "Visible" : "Hidden"}
          </button>
          <button
            type="button"
            onClick={() => setNodeLocked(id, !node.locked)}
            className={cn(
              "flex h-6 flex-1 items-center justify-center gap-1 rounded border text-[11px] font-medium transition-colors",
              node.locked
                ? "border-amber-500/35 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                : "border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] hover:bg-white/[0.06]",
            )}
          >
            {node.locked ? (
              <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
            ) : (
              <Unlock className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            {node.locked ? "Locked" : "Unlocked"}
          </button>
        </div>
      </PropertiesSection>

      <PropertiesSection title="Position" defaultOpen>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5">
          <PropertyNumberInput commitOnInput={false}
            label="X"
            value={node.x}
            instanceKey={key}
            disabled={locked || parentAutoLayout}
            onCommit={(v) => patch({ x: v })}
          />
          <PropertyNumberInput commitOnInput={false}
            label="Y"
            value={node.y}
            instanceKey={key}
            disabled={locked || parentAutoLayout}
            onCommit={(v) => patch({ y: v })}
          />
          <PropertyNumberInput commitOnInput={false}
            label="W"
            value={node.width}
            instanceKey={key}
            disabled={locked}
            min={1}
            onCommit={(v) =>
              isContainer
                ? resizeFrameWithConstraints(id, { width: v, height: node.height })
                : patch({ width: v })
            }
          />
          <PropertyNumberInput commitOnInput={false}
            label="H"
            value={node.height}
            instanceKey={key}
            disabled={locked}
            min={1}
            onCommit={(v) =>
              isContainer
                ? resizeFrameWithConstraints(id, { width: node.width, height: v })
                : patch({ height: v })
            }
          />
        </div>
        <div className="mt-1.5">
          <PropertyNumberInput commitOnInput={false}
            label="Rotation"
            value={node.rotation}
            instanceKey={key}
            disabled={locked}
            onCommit={(v) => patch({ rotation: ((v % 360) + 360) % 360 })}
          />
        </div>
      </PropertiesSection>

      {isImage && (
        <PropertiesSection title="Image" defaultOpen>
          <div className="mb-2 overflow-hidden rounded border border-white/[0.08] bg-black/30">
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
          <p className="mb-1.5 truncate text-[11px] text-[#b8b8b8]" title={node.imageName ?? node.name}>
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
            className="mb-2 flex h-6 w-full items-center justify-center gap-1.5 rounded border border-white/[0.1] bg-[#2c2c2c] text-[11px] font-medium text-[#e6e6e6] transition-colors hover:bg-white/[0.06] disabled:opacity-40"
          >
            Replace image…
          </button>
          <div className="mb-1.5 text-[11px] font-medium text-[#8c8c8c]">Fit mode</div>
          <select
            disabled={locked}
            className={cn(
              field,
              "mb-2 w-full rounded border border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
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
            label="Opacity %"
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
            <span className="text-[11px] font-medium text-[#8c8c8c]">Closed path</span>
            <button
              type="button"
              disabled={locked}
              onClick={() => togglePathClosed(id)}
              className={cn(
                "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40",
                node.pathClosed
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
              )}
            >
              {node.pathClosed ? "Closed" : "Open"}
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-[#6b6b6b]">
            Double-click the path on the canvas to toggle anchor editing. With anchors shown, Backspace removes the
            selected point.
          </p>
        </PropertiesSection>
      )}

      {isContainer && (
        <PropertiesSection title="Auto layout" defaultOpen>
          {layoutMode === "none" ? (
            <button
              type="button"
              disabled={locked}
              onClick={() =>
                updateLayout(id, {
                  layoutMode: "horizontal",
                  layoutGap: 8,
                  paddingTop: 12,
                  paddingRight: 12,
                  paddingBottom: 12,
                  paddingLeft: 12,
                  primaryAxisAlign: "start",
                  counterAxisAlign: "start",
                })
              }
              className={cn(
                "flex h-6 w-full items-center justify-center gap-1.5 rounded border text-[11px] font-medium transition-colors disabled:opacity-40",
                "border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] hover:bg-white/[0.06]",
              )}
            >
              <LayoutTemplate className="h-3.5 w-3.5" strokeWidth={1.75} />
              Add auto layout
            </button>
          ) : (
            <>
              <div className="mb-1 text-[11px] font-medium text-[#8c8c8c]">Direction</div>
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
                          : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
                      )}
                    >
                      {Icon ? <Icon className="h-3 w-3" strokeWidth={1.75} /> : null}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <PropertyNumberInput commitOnInput={false}
                label="Gap"
                value={node.layoutGap ?? 0}
                instanceKey={`${key}-gap`}
                disabled={locked}
                min={0}
                max={256}
                onCommit={(v) => updateLayout(id, { layoutGap: Math.max(0, v) })}
              />
              <div className="mt-1.5 text-[11px] font-medium text-[#8c8c8c]">Padding</div>
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
              <div className="mt-1.5 text-[11px] font-medium text-[#8c8c8c]">Primary axis</div>
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
                          : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
              <div className="mt-1.5 text-[11px] font-medium text-[#8c8c8c]">Counter axis</div>
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
                          : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </PropertiesSection>
      )}

      {isContainer && (
        <PropertiesSection title="Responsive preview" defaultOpen={false}>
          <p className="mb-1.5 text-[10px] leading-relaxed text-[#6b6b6b]">
            Try viewport sizes with live constraint behavior. Changes stay temporary until you apply from the panel
            below.
          </p>
          <button
            type="button"
            disabled={locked}
            onClick={() => openResponsivePreview(id)}
            className={cn(
              "flex h-7 w-full items-center justify-center gap-1.5 rounded border text-[11px] font-medium transition-colors disabled:opacity-40",
              "border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] hover:bg-white/[0.06]",
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
          <div className="mb-0.5 text-[11px] font-medium text-[#8c8c8c]">Horizontal</div>
          <select
            disabled={locked}
            className={cn(
              field,
              "mb-1.5 w-full rounded border border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
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
          <div className="mb-0.5 text-[11px] font-medium text-[#8c8c8c]">Vertical</div>
          <select
            disabled={locked}
            className={cn(
              field,
              "w-full rounded border border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
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

      {canFillStroke && (
        <PropertiesSection title="Fill" defaultOpen>
          {fillToken ? (
            <p className="mb-1.5 truncate text-[10px] text-[#9a9a9a]">
              Linked style:{" "}
              <span className="font-medium text-[#d4d4d4]">{fillToken.name}</span>
            </p>
          ) : null}
          <div className="mb-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={locked || fillType === "gradient"}
              onClick={() => createColorTokenFromSelection()}
              className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
            >
              Create color style
            </button>
            <button
              type="button"
              disabled={locked || fillType !== "gradient"}
              onClick={() => createGradientTokenFromSelection()}
              className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
            >
              Create gradient style
            </button>
            {node.fillTokenId ? (
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  detachTokenFromSelection(linkedFillTokenType === "gradient" ? "gradient" : "color")
                }
                className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
              >
                Detach style
              </button>
            ) : null}
          </div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-[#8c8c8c]">Enabled</span>
            <button
              type="button"
              disabled={locked}
              onClick={() => style({ fillEnabled: !fillEnabled })}
              className={cn(
                "rounded border px-2 py-0.5 text-[11px] font-medium transition-colors disabled:opacity-40",
                fillEnabled
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
              )}
            >
              {fillEnabled ? "On" : "Off"}
            </button>
          </div>
          {linkedFillTokenType === "gradient" && isGradientValue(fillToken?.value) ? (
            <div
              className="mb-2 h-10 w-full rounded border border-white/[0.08]"
              style={{
                background: fillPaintCss({
                  fillType: "gradient",
                  fillGradient: normalizeFillGradient(fillToken!.value),
                  fillEnabled,
                  fillOpacity,
                }),
              }}
              aria-hidden
            />
          ) : !node.fillTokenId ? (
            <>
              <div className="mb-1.5">
                <div className="mb-0.5 text-[11px] font-medium text-[#8c8c8c]">Fill type</div>
                <div className="flex gap-0.5">
                  {(["solid", "gradient"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={locked || !fillEnabled}
                      onClick={() => {
                        if (t === "gradient") {
                          style({
                            fillType: "gradient",
                            fillGradient: node.fillGradient ?? defaultFillGradient(display.fill ?? node.fill),
                          });
                        } else {
                          style({ fillType: "solid" });
                        }
                      }}
                      className={cn(
                        "h-6 flex-1 rounded border text-[10px] font-semibold capitalize transition-colors disabled:opacity-40",
                        fillType === t
                          ? "border-accent/45 bg-accent/15 text-white"
                          : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {fillType === "solid" ? (
                <ColorInput
                  label="Color"
                  hex={display.fill ?? "#ffffff"}
                  instanceKey={key}
                  disabled={locked || !fillEnabled}
                  onCommitHex={(hex) => style({ fill: hex, fillType: "solid" })}
                />
              ) : (
                <>
                  <div
                    className="mb-2 h-10 w-full rounded border border-white/[0.08]"
                    style={{
                      background: fillPaintCss({
                        fillType: "gradient",
                        fillGradient,
                        fill: display.fill ?? node.fill,
                        fillEnabled,
                        fillOpacity,
                      }),
                    }}
                    aria-hidden
                  />
                  <div className="mb-1.5">
                    <div className="mb-0.5 text-[11px] font-medium text-[#8c8c8c]">Gradient type</div>
                    <div className="grid grid-cols-2 gap-0.5">
                      {(
                        [
                          ["linear", "Linear"],
                          ["radial", "Radial"],
                          ["angular", "Angular"],
                          ["diamond", "Diamond"],
                        ] as const
                      ).map(([kind, label]) => (
                        <button
                          key={kind}
                          type="button"
                          disabled={locked || !fillEnabled}
                          onClick={() =>
                            style({
                              fillType: "gradient",
                              fillGradient: {
                                ...fillGradient,
                                kind,
                                transform: {
                                  ...fillGradient.transform,
                                  rotation:
                                    kind === "linear"
                                      ? fillGradient.transform.rotation || 180
                                      : fillGradient.transform.rotation,
                                },
                              },
                            })
                          }
                          className={cn(
                            "h-6 rounded border text-[10px] font-semibold transition-colors disabled:opacity-40",
                            fillGradient.kind === kind
                              ? "border-accent/45 bg-accent/15 text-white"
                              : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {(fillGradient.kind === "linear" || fillGradient.kind === "angular") && (
                    <PropertyNumberInput
                      commitOnInput={false}
                      label={fillGradient.kind === "linear" ? "Angle °" : "Start angle °"}
                      value={Math.round(fillGradient.transform.rotation)}
                      instanceKey={`${key}-grad-rotation`}
                      disabled={locked || !fillEnabled}
                      min={0}
                      max={359}
                      onCommit={(v) => {
                        const rotation = ((Math.round(v) % 360) + 360) % 360;
                        style({
                          fillType: "gradient",
                          fillGradient: {
                            ...fillGradient,
                            transform: { ...fillGradient.transform, rotation },
                          },
                        });
                      }}
                    />
                  )}
                  <p className="mb-1 text-[10px] text-[#737373]">
                    Drag stops and handles on canvas. Double-click a stop to remove.
                  </p>
                  {fillGradient.stops.map((stop, index) => (
                    <div key={stop.id} className="mt-1.5 rounded border border-white/[0.06] p-1.5">
                      <div className="mb-1 flex items-center justify-between gap-1">
                        <span className="text-[10px] font-medium text-[#8c8c8c]">Stop {index + 1}</span>
                        {fillGradient.stops.length > 2 ? (
                          <button
                            type="button"
                            disabled={locked || !fillEnabled}
                            onClick={() =>
                              style({
                                fillType: "gradient",
                                fillGradient: {
                                  ...fillGradient,
                                  stops: fillGradient.stops.filter((s) => s.id !== stop.id),
                                },
                              })
                            }
                            className="rounded px-1 text-[10px] text-rose-300 hover:bg-white/[0.06] disabled:opacity-40"
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                      <ColorInput
                        label="Color"
                        hex={stop.color}
                        instanceKey={`${key}-grad-stop-${stop.id}`}
                        disabled={locked || !fillEnabled}
                        onCommitHex={(hex) => {
                          const stops = fillGradient.stops.map((s) =>
                            s.id === stop.id ? { ...s, color: hex } : s,
                          );
                          style({ fillType: "gradient", fillGradient: { ...fillGradient, stops } });
                        }}
                      />
                      <div className="mt-1">
                        <PropertyNumberInput
                          commitOnInput={false}
                          label="Position %"
                          value={Math.round(stop.position)}
                          instanceKey={`${key}-grad-pos-${stop.id}`}
                          disabled={locked || !fillEnabled}
                          min={0}
                          max={100}
                          onCommit={(v) => {
                            const stops = fillGradient.stops.map((s) =>
                              s.id === stop.id
                                ? { ...s, position: Math.min(100, Math.max(0, v)) }
                                : s,
                            );
                            style({ fillType: "gradient", fillGradient: { ...fillGradient, stops } });
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    disabled={locked || !fillEnabled}
                    onClick={() => {
                      const mid =
                        fillGradient.stops.length >= 2
                          ? (fillGradient.stops[0]!.position + fillGradient.stops.at(-1)!.position) / 2
                          : 50;
                      style({
                        fillType: "gradient",
                        fillGradient: {
                          ...fillGradient,
                          stops: [
                            ...fillGradient.stops,
                            {
                              id: newGradientStopId(),
                              color: display.fill ?? "#ffffff",
                              position: mid,
                            },
                          ].sort((a, b) => a.position - b.position),
                        },
                      });
                    }}
                    className="mt-1.5 w-full rounded border border-white/[0.1] bg-[#2c2c2c] py-1 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
                  >
                    Add stop
                  </button>
                </>
              )}
            </>
          ) : linkedFillTokenType === "color" ? (
            <ColorInput
              label="Color"
              hex={display.fill ?? "#ffffff"}
              instanceKey={key}
              disabled={locked || !fillEnabled}
              onCommitHex={(hex) => {
                const t = designTokens[node.fillTokenId!];
                if (t?.type === "color" && isColorValue(t.value)) {
                  updateDesignToken(node.fillTokenId!, { value: { ...(t.value as ColorTokenValue), hex } });
                  return;
                }
                style({ fill: hex });
              }}
            />
          ) : null}
          <div className="mt-1.5">
            <PropertyNumberInput commitOnInput={false}
              label="Opacity %"
              value={Math.round(fillOpacity * 100)}
              instanceKey={`${key}-fo`}
              disabled={locked || !fillEnabled}
              min={0}
              max={100}
              onCommit={(v) => {
                const op = Math.min(1, Math.max(0, v / 100));
                if (node.fillTokenId) {
                  const t = designTokens[node.fillTokenId];
                  if (t?.type === "color" && isColorValue(t.value)) {
                    updateDesignToken(node.fillTokenId, { value: { ...(t.value as ColorTokenValue), opacity: op } });
                    return;
                  }
                }
                style({ fillOpacity: op });
              }}
            />
          </div>
        </PropertiesSection>
      )}

      {(canFillStroke || isLine) && (
        <PropertiesSection title="Stroke" defaultOpen>
          <ColorInput
            label="Color"
            hex={node.strokeColor ?? "#000000"}
            instanceKey={key}
            disabled={locked}
            onCommitHex={(hex) => style({ strokeColor: hex })}
          />
          <div className="mt-1.5">
            <PropertyNumberInput commitOnInput={false}
              label="Width"
              value={node.strokeWidth ?? 0}
              instanceKey={key}
              disabled={locked}
              min={0}
              max={64}
              onCommit={(v) => style({ strokeWidth: v })}
            />
          </div>
          <div className="mt-1.5">
            <div className="mb-0.5 text-[11px] font-medium text-[#8c8c8c]">Style</div>
            <div className="flex gap-0.5">
              {(["solid", "dashed", "dotted"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={locked}
                  onClick={() => style({ strokeStyle: s })}
                  className={cn(
                    "h-6 flex-1 rounded border text-[10px] font-semibold capitalize transition-colors disabled:opacity-40",
                    (node.strokeStyle ?? "solid") === s
                      ? "border-accent/45 bg-accent/15 text-white"
                      : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-1.5">
            <div className="mb-0.5 text-[11px] font-medium text-[#8c8c8c]">Position</div>
            <div className="flex gap-0.5">
              {(["inside", "center", "outside"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={locked}
                  onClick={() => style({ strokePosition: p })}
                  className={cn(
                    "h-6 flex-1 rounded border text-[10px] font-semibold capitalize transition-colors disabled:opacity-40",
                    strokePos === p
                      ? "border-accent/45 bg-accent/15 text-white"
                      : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </PropertiesSection>
      )}

      <PropertiesSection title="Effects" defaultOpen>
        {node.effectTokenId && designTokens[node.effectTokenId]?.type === "effect" ? (
          <p className="mb-1.5 truncate text-[10px] text-[#9a9a9a]">
            Linked style:{" "}
            <span className="font-medium text-[#d4d4d4]">{designTokens[node.effectTokenId]!.name}</span>
          </p>
        ) : null}
        <div className="mb-1.5 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={locked}
            onClick={() => createEffectTokenFromSelection()}
            className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
          >
            Create effect style
          </button>
          {node.effectTokenId ? (
            <button
              type="button"
              disabled={locked}
              onClick={() => detachEffectTokenFromSelection()}
              className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
            >
              Detach effect style
            </button>
          ) : null}
        </div>
        <div className="mb-1.5">
          <PropertyNumberInput
            commitOnInput={false}
            label="Layer opacity %"
            value={Math.round((display.opacity ?? 1) * 100)}
            instanceKey={`${key}-layer-op`}
            disabled={locked}
            min={0}
            max={100}
            onCommit={(v) => style({ opacity: Math.min(1, Math.max(0, v / 100)) })}
          />
        </div>
        <div className="mb-1.5">
          <div className="mb-0.5 text-[11px] font-medium text-[#8c8c8c]">Add effect</div>
          <select
            disabled={locked}
            className={cn(
              field,
              "w-full rounded border border-white/[0.1] bg-[#2c2c2c] text-[#e6e6e6] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent",
            )}
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value as NodeEffectType | "";
              if (v) addEffect(id, v);
              e.target.selectedIndex = 0;
            }}
          >
            <option value="">Choose type…</option>
            <option value="drop-shadow">Drop shadow</option>
            <option value="inner-shadow">Inner shadow</option>
            <option value="layer-blur">Layer blur</option>
            <option value="background-blur">Background blur</option>
          </select>
        </div>
        {node.effectTokenId &&
        designTokens[node.effectTokenId]?.type === "effect" &&
        isEffectValue(designTokens[node.effectTokenId]!.value) &&
        !(designTokens[node.effectTokenId]!.value as EffectTokenValue).effects?.length ? (
          <p className="mb-1.5 text-[10px] leading-relaxed text-[#8c8c8c]">
            This effect style uses a legacy shadow. Add an effect to edit individual layers, or detach and use local effects.
          </p>
        ) : null}
        {(display.effects ?? []).length === 0 ? (
          <p className="text-[10px] text-[#6b6b6b]">No effects on this layer.</p>
        ) : (
          <ul className="space-y-2">
            {(display.effects ?? []).map((e: NodeEffect) => {
              const shadowLike = e.type === "drop-shadow" || e.type === "inner-shadow";
              const blurOnly = e.type === "layer-blur" || e.type === "background-blur";
              return (
                <li key={e.id} className="rounded border border-white/[0.08] bg-[#262626] p-1.5">
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <span className="text-[10px] font-medium text-[#b5b5b5]">{effectTypeLabel(e.type)}</span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        disabled={locked}
                        title={e.visible ? "Hide" : "Show"}
                        onClick={() => toggleEffect(id, e.id)}
                        className="rounded p-1 text-[#c4c4c4] hover:bg-white/[0.06] disabled:opacity-40"
                      >
                        {e.visible ? <Eye className="h-3.5 w-3.5" strokeWidth={1.75} /> : <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      </button>
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => deleteEffect(id, e.id)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium text-rose-200 hover:bg-rose-500/15 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {shadowLike ? (
                    <>
                      <div className="grid grid-cols-2 gap-1">
                        <PropertyNumberInput
                          commitOnInput={false}
                          label="X"
                          value={e.x ?? 0}
                          instanceKey={`${key}-efx-${e.id}-x`}
                          disabled={locked || !e.visible}
                          onCommit={(v) => updateEffect(id, e.id, { x: v })}
                        />
                        <PropertyNumberInput
                          commitOnInput={false}
                          label="Y"
                          value={e.y ?? 0}
                          instanceKey={`${key}-efx-${e.id}-y`}
                          disabled={locked || !e.visible}
                          onCommit={(v) => updateEffect(id, e.id, { y: v })}
                        />
                        <PropertyNumberInput
                          commitOnInput={false}
                          label="Blur"
                          value={e.blur ?? 0}
                          instanceKey={`${key}-efx-${e.id}-blur`}
                          disabled={locked || !e.visible}
                          min={0}
                          max={256}
                          onCommit={(v) => updateEffect(id, e.id, { blur: v })}
                        />
                        <PropertyNumberInput
                          commitOnInput={false}
                          label="Spread"
                          value={e.spread ?? 0}
                          instanceKey={`${key}-efx-${e.id}-spread`}
                          disabled={locked || !e.visible}
                          onCommit={(v) => updateEffect(id, e.id, { spread: v })}
                        />
                      </div>
                      <div className="mt-1">
                        <ColorInput
                          label="Color"
                          hex={e.color ?? "#000000"}
                          instanceKey={`${key}-efx-${e.id}-c`}
                          disabled={locked || !e.visible}
                          onCommitHex={(hex) => updateEffect(id, e.id, { color: hex })}
                        />
                      </div>
                      <div className="mt-1">
                        <PropertyNumberInput
                          commitOnInput={false}
                          label="Effect opacity %"
                          value={Math.round((e.opacity ?? 1) * 100)}
                          instanceKey={`${key}-efx-${e.id}-op`}
                          disabled={locked || !e.visible}
                          min={0}
                          max={100}
                          onCommit={(v) => updateEffect(id, e.id, { opacity: Math.min(1, Math.max(0, v / 100)) })}
                        />
                      </div>
                    </>
                  ) : null}
                  {blurOnly ? (
                    <PropertyNumberInput
                      commitOnInput={false}
                      label="Blur"
                      value={e.blur ?? 0}
                      instanceKey={`${key}-efx-${e.id}-bonly`}
                      disabled={locked || !e.visible}
                      min={0}
                      max={256}
                      onCommit={(v) => updateEffect(id, e.id, { blur: v })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PropertiesSection>

      {canRadius && (
        <PropertiesSection title="Corner radius" defaultOpen>
          <PropertyNumberInput commitOnInput={false}
            label="Radius"
            value={node.cornerRadius ?? 0}
            instanceKey={key}
            disabled={locked}
            min={0}
            max={999}
            onCommit={(v) => style({ cornerRadius: v })}
          />
        </PropertiesSection>
      )}

      {node.type === "path" && node.polygonSides != null && node.starPoints == null ? (
        <PropertiesSection title="Polygon" defaultOpen>
          <PropertyNumberInput
            commitOnInput={false}
            label="Sides"
            value={node.polygonSides}
            instanceKey={`${key}-sides`}
            disabled={locked}
            min={3}
            max={64}
            onCommit={(v) => {
              style({
                polygonSides: v,
                pathPoints: generatePolygonPoints(v, node.width, node.height),
              });
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
            max={32}
            onCommit={(v) => {
              const inner = node.starInnerRadius ?? 0.4;
              style({
                starPoints: v,
                pathPoints: generateStarPoints(v, inner, node.width, node.height),
              });
            }}
          />
          <div className="mt-1.5">
            <PropertyNumberInput
              commitOnInput={false}
              label="Inner radius"
              value={Math.round((node.starInnerRadius ?? 0.4) * 100)}
              instanceKey={`${key}-star-inner`}
              disabled={locked}
              min={10}
              max={90}
              onCommit={(v) => {
                const inner = v / 100;
                style({
                  starInnerRadius: inner,
                  pathPoints: generateStarPoints(node.starPoints ?? 5, inner, node.width, node.height),
                });
              }}
            />
          </div>
        </PropertiesSection>
      ) : null}

      {isText && (
        <PropertiesSection title="Typography" defaultOpen>
          {node.textStyleTokenId && designTokens[node.textStyleTokenId]?.type === "typography" ? (
            <p className="mb-1.5 truncate text-[10px] text-[#9a9a9a]">
              Linked typography:{" "}
              <span className="font-medium text-[#d4d4d4]">{designTokens[node.textStyleTokenId]!.name}</span>
            </p>
          ) : null}
          {node.fillTokenId && designTokens[node.fillTokenId]?.type === "color" ? (
            <p className="mb-1.5 truncate text-[10px] text-[#9a9a9a]">
              Linked color style:{" "}
              <span className="font-medium text-[#d4d4d4]">{designTokens[node.fillTokenId]!.name}</span>
            </p>
          ) : null}
          <div className="mb-1.5 flex flex-wrap gap-1">
            <button
              type="button"
              disabled={locked}
              onClick={() => createTypographyTokenFromSelection()}
              className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
            >
              Create typography style
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => createColorTokenFromSelection()}
              className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
            >
              Create color style
            </button>
            {node.textStyleTokenId ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => detachTokenFromSelection("typography")}
                className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
              >
                Detach typography
              </button>
            ) : null}
            {node.fillTokenId ? (
              <button
                type="button"
                disabled={locked}
                onClick={() => detachTokenFromSelection("color")}
                className="rounded border border-white/[0.1] bg-[#2c2c2c] px-2 py-0.5 text-[10px] font-medium text-[#e6e6e6] hover:bg-white/[0.06] disabled:opacity-40"
              >
                Detach color style
              </button>
            ) : null}
          </div>
          <textarea
            disabled={locked}
            className={cn(
              "min-h-[72px] w-full resize-y rounded border border-white/[0.1] bg-[#262626] p-1.5 text-[12px] leading-snug text-[#f5f5f5] focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-45",
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
            <ColorInput
              label="Text color"
              hex={display.textColor ?? display.fill ?? "#111111"}
              instanceKey={`${key}-tc`}
              disabled={locked}
              onCommitHex={(hex) => {
                if (node.fillTokenId) {
                  const t = designTokens[node.fillTokenId];
                  if (t?.type === "color" && isColorValue(t.value)) {
                    updateDesignToken(node.fillTokenId, { value: { ...(t.value as ColorTokenValue), hex } });
                    return;
                  }
                }
                style({ textColor: hex });
              }}
            />
          </div>
          <div className="mt-1.5">
            <div className="mb-0.5 text-[11px] font-medium leading-4 text-[#8c8c8c]">Font</div>
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
                    : "border-white/[0.08] text-[#9a9a9a] hover:bg-white/[0.04]",
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
              className="flex-1 rounded border border-white/[0.08] py-1.5 text-[11px] font-medium text-[#c4c4c4] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
              onClick={() => flattenSelection()}
            >
              Flatten
            </button>
            <button
              type="button"
              disabled={locked}
              className="flex-1 rounded border border-white/[0.08] py-1.5 text-[11px] font-medium text-[#c4c4c4] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
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
            <p className="mb-2 text-[10px] leading-snug text-[#6b6b6b]">
              Figma luminance mask — shown as vector outline clip in this editor.
            </p>
          ) : null}
          <button
            type="button"
            disabled={locked}
            className="w-full rounded border border-white/[0.08] py-1.5 text-[11px] font-medium text-[#c4c4c4] hover:bg-white/[0.05] hover:text-white disabled:opacity-40"
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
            className="w-full rounded border border-white/[0.08] py-1.5 text-[11px] font-medium text-[#c4c4c4] hover:bg-white/[0.05] hover:text-white"
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
            className="flex-1 rounded border border-white/[0.08] py-1.5 text-[11px] font-medium text-[#c4c4c4] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            PNG
          </button>
          <button
            type="button"
            className="flex-1 rounded border border-white/[0.08] py-1.5 text-[11px] font-medium text-[#c4c4c4] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            SVG
          </button>
        </div>
      </PropertiesSection>
    </>
  );
}
