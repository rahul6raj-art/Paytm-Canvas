"use client";

import { useMemo } from "react";
import { LayoutTemplate } from "lucide-react";
import { canAlignSelection } from "@/lib/alignSelection";
import { canAddAutoLayoutToSelection } from "@/lib/autoLayoutSelection";
import { resolveNodeWithDesignTokens } from "@/lib/designTokens";
import {
  cornerRadiiStylePatch,
} from "@/lib/shapes/shapeToPath";
import {
  getShapeVertexCornerRadii,
  shapeSupportsIndividualCornerRadius,
} from "@/lib/shapes/parametricCornerRadii";
import { buildSelectionInspectorModel } from "@/lib/selectionInspector";
import { canCreateComponentSetFromSelection } from "@/lib/componentUx";
import { findInstanceRoot } from "@/lib/componentModel";
import { cn } from "@/lib/utils";
import { useEditorStore, type EditorNode, type NodeStylePatch, type StrokePosition } from "@/stores/useEditorStore";
import { AlignControls } from "./AlignControls";
import { BooleanOperationsDropdown } from "./BooleanToolbarDropdown";
import { PropertiesSection } from "./PropertiesSection";
import { SelectionColorsSection } from "./SelectionColorsSection";
import { AppearanceSection } from "./design-panel/AppearanceSection";
import { EffectsSection } from "./design-panel/EffectsSection";
import { FillSection } from "./design-panel/FillSection";
import { DesignColorModeSection } from "./DesignColorModeSection";
import { PositionSection } from "./design-panel/PositionSection";
import { StrokeSection } from "./design-panel/StrokeSection";
import { InspectorLayerHeaderActions } from "./design-panel/InspectorLayerHeaderActions";
import { resolveStrokeEndPoint } from "@/lib/strokeEndpoints";

export function SelectionDesignInspector() {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodesAll = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const designTokens = useEditorStore((s) => s.designTokens);
  const canvasColorMode = useEditorStore((s) => s.canvasColorMode);
  const addAutoLayoutToSelection = useEditorStore((s) => s.addAutoLayoutToSelection);
  const updateSelectionStyle = useEditorStore((s) => s.updateSelectionStyle);
  const updateSelectionNodes = useEditorStore((s) => s.updateSelectionNodes);
  const setSelectionFillHex = useEditorStore((s) => s.setSelectionFillHex);
  const toggleVisibleSelection = useEditorStore((s) => s.toggleVisibleSelection);
  const detachTokenFromSelection = useEditorStore((s) => s.detachTokenFromSelection);
  const detachEffectTokenFromSelection = useEditorStore((s) => s.detachEffectTokenFromSelection);
  const updateDesignToken = useEditorStore((s) => s.updateDesignToken);
  const addEffect = useEditorStore((s) => s.addEffect);
  const updateEffect = useEditorStore((s) => s.updateEffect);
  const deleteEffect = useEditorStore((s) => s.deleteEffect);
  const toggleEffect = useEditorStore((s) => s.toggleEffect);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const model = useMemo(
    () => buildSelectionInspectorModel(selectedIds, nodesAll),
    [selectedIds, nodesAll],
  );

  const canAlign = useMemo(
    () => canAlignSelection(selectedIds, nodesAll, childOrder),
    [selectedIds, nodesAll, childOrder],
  );

  const canAddAutoLayout = useMemo(
    () => canAddAutoLayoutToSelection(selectedIds, nodesAll),
    [selectedIds, nodesAll],
  );

  const showMakeComponent = useMemo(
    () =>
      !model?.nodes.some(
        (n) => n.isComponent || Boolean(findInstanceRoot(nodesAll, n.id)),
      ),
    [model?.nodes, nodesAll],
  );

  const showCreateComponentSet = useMemo(
    () => canCreateComponentSetFromSelection(selectedIds, nodesAll),
    [selectedIds, nodesAll],
  );

  if (!model) return null;

  const { primary, count, caps, mixed, display } = model;
  const key = `selection-${selectedIds.join(",")}`;
  const locked = model.allLocked;
  const node = primary;
  const resolved = useMemo(
    () => resolveNodeWithDesignTokens(node, designTokens, canvasColorMode),
    [node, designTokens, canvasColorMode],
  );

  const style = (patch: NodeStylePatch, opts?: { skipHistory?: boolean }) =>
    updateSelectionStyle(patch, opts);

  const patchNodes = (patch: Partial<EditorNode>, opts?: { skipHistory?: boolean }) =>
    updateSelectionNodes(patch, opts);

  const applyCornerStyle = (p: NodeStylePatch) => {
    if (!caps.canRadius) {
      style(p);
      return;
    }
    if (p.cornerRadius != null) {
      pushHistory();
      const updateNodeStyle = useEditorStore.getState().updateNodeStyle;
      for (const n of model.nodes) {
        if (!shapeSupportsIndividualCornerRadius(n) || n.locked) continue;
        const radii = Array.from(
          { length: getShapeVertexCornerRadii(n).length },
          () => p.cornerRadius ?? 0,
        );
        updateNodeStyle(
          n.id,
          { ...p, ...cornerRadiiStylePatch(n, radii) },
          { skipHistory: true },
        );
      }
      return;
    }
    style(p);
  };

  const fillOpacity = resolved.fillOpacity ?? 1;
  const fillEnabled = model.nodes.every((n) => n.fillEnabled !== false);
  const fillToken = node.fillTokenId ? designTokens[node.fillTokenId] : undefined;
  const strokePos: StrokePosition = node.strokePosition ?? "center";
  const cornerRadiusLabels = undefined;

  const batchAddEffect = (type: Parameters<typeof addEffect>[1]) => {
    pushHistory();
    for (const n of model.nodes) {
      if (!n.locked) addEffect(n.id, type);
    }
  };

  const batchToggleEffect = (effectId: string) => {
    for (const n of model.nodes) {
      const effect = n.effects?.find((e) => e.id === effectId);
      if (effect) toggleEffect(n.id, effectId);
    }
  };

  return (
    <>
      <div className="border-b border-app-panel-edge px-3 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-app-border bg-app-hover px-2 py-0.5 text-ui font-medium text-app-muted">
            {count} layer{count === 1 ? "" : "s"} selected
          </span>
          <div className="ml-auto flex items-center gap-2">
            <InspectorLayerHeaderActions
              locked={locked}
              showMakeComponent={showMakeComponent}
              showCreateComponentSet={showCreateComponentSet}
            />
            <BooleanOperationsDropdown variant="inspector" />
          </div>
        </div>
      </div>

      {canAlign ? (
        <PropertiesSection title="Align" defaultOpen>
          <AlignControls variant="panel" />
        </PropertiesSection>
      ) : null}

      <PositionSection
        node={node}
        instanceKey={key}
        locked={locked}
        parentAutoLayout={false}
        isContainer={false}
        hideDimensions={caps.allText}
        displayX={display.x}
        displayY={display.y}
        displayWidth={display.width}
        displayHeight={display.height}
        displayRotation={display.rotation}
        mixedX={mixed.x}
        mixedY={mixed.y}
        mixedWidth={mixed.width}
        mixedHeight={mixed.height}
        mixedRotation={mixed.rotation}
        onPatch={patchNodes}
        onResizeFrame={(width, height) => patchNodes({ width, height })}
      />

      {canAddAutoLayout ? (
        <PropertiesSection title="Layout" defaultOpen>
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
        </PropertiesSection>
      ) : null}

      <AppearanceSection
        node={node}
        instanceKey={key}
        locked={locked}
        visible={model.nodes.every((n) => n.visible)}
        layerOpacity={resolved.opacity ?? 1}
        canCornerRadius={caps.canRadius}
        cornerLabels={cornerRadiusLabels}
        showArc={false}
        onOpacityCommit={(opacity) => style({ opacity })}
        onBlendModeChange={(blendMode) => style({ blendMode })}
        onToggleVisible={() => toggleVisibleSelection()}
        onCornerStyle={applyCornerStyle}
        onArcStyle={style}
      />

      <DesignColorModeSection compact className="border-b border-app-panel-edge" />

      {caps.canFillStroke ? (
        <FillSection
          node={node}
          display={resolved}
          instanceKey={key}
          locked={locked}
          fillEnabled={fillEnabled}
          fillOpacity={fillOpacity}
          fillToken={fillToken}
          designTokens={designTokens}
          onStyle={style}
          onDetachToken={(kind) => detachTokenFromSelection(kind)}
          onUpdateDesignToken={(tokenId, patch) => updateDesignToken(tokenId, patch)}
          hexMixed={mixed.fillHex}
          onCommitFillHex={(hex, opts) => setSelectionFillHex(hex, opts)}
        />
      ) : null}

      <SelectionColorsSection />

      {caps.canStroke ? (
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
          strokeEnabled={model.nodes.every((n) => n.strokeEnabled !== false)}
          strokeStyle={node.strokeStyle ?? "solid"}
          strokePosition={strokePos}
          strokeSides={node.strokeSides ?? "all"}
          strokeSidesCustom={node.strokeSidesCustom}
          strokeSidesCustomColors={node.strokeSidesCustomColors}
          showSides={caps.showStrokeSides}
          strokeDashLength={node.strokeDashLength}
          strokeDashGap={node.strokeDashGap}
          strokeLinecap={node.strokeLinecap}
          strokeLinejoin={node.strokeLinejoin}
          strokeMiterAngle={node.strokeMiterAngle}
          strokeWidthProfile={node.strokeWidthProfile}
          strokeWidthProfileFlipped={node.strokeWidthProfileFlipped}
          strokeStartPoint={node.strokeStartPoint}
          strokeEndPoint={resolveStrokeEndPoint(node)}
          showEndpoints={false}
          onStyle={style}
        />
      ) : null}

      <EffectsSection
        instanceKey={key}
        locked={locked}
        effects={node.effects ?? []}
        effectToken={
          node.effectTokenId ? designTokens[node.effectTokenId] : undefined
        }
        hasEffectToken={Boolean(node.effectTokenId)}
        onAddEffect={batchAddEffect}
        onDetachEffectToken={() => detachEffectTokenFromSelection()}
        onToggleEffect={batchToggleEffect}
        onDeleteEffect={(effectId) => {
          for (const n of model.nodes) deleteEffect(n.id, effectId);
        }}
        onUpdateEffect={(effectId, patch) => {
          for (const n of model.nodes) updateEffect(n.id, effectId, patch);
        }}
        onChangeEffectType={(effectId, type) => {
          for (const n of model.nodes) updateEffect(n.id, effectId, { type });
        }}
      />
    </>
  );
}
