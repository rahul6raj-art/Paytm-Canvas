"use client";

import { PropertiesSection } from "../PropertiesSection";
import { PropertyNumberInput } from "../PropertyInput";
import { CornerRadiusControls } from "../CornerRadiusControls";
import { ArcControls } from "./ArcControls";
import { BlendModePicker } from "./BlendModePicker";
import { InspectorLabelRow } from "./InspectorPrimitives";
import type { LayerBlendMode } from "@/lib/layerBlendMode";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";

export function AppearanceSection({
  node,
  instanceKey,
  locked,
  layerOpacity,
  canCornerRadius,
  showArc,
  onOpacityCommit,
  onBlendModeChange,
  onCornerStyle,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  layerOpacity: number;
  canCornerRadius: boolean;
  showArc?: boolean;
  onOpacityCommit: (opacity: number) => void;
  onBlendModeChange: (blendMode: LayerBlendMode) => void;
  onCornerStyle: (patch: NodeStylePatch) => void;
}) {
  return (
    <PropertiesSection title="Appearance" defaultOpen>
      <div className="space-y-1.5">
        <PropertyNumberInput
          commitOnInput={false}
          label="Opacity"
          value={Math.round(layerOpacity * 100)}
          instanceKey={`${instanceKey}-layer-op`}
          disabled={locked}
          min={0}
          max={100}
          onCommit={(v) => onOpacityCommit(Math.min(1, Math.max(0, v / 100)))}
        />
        <InspectorLabelRow label="Blend">
          <BlendModePicker
            node={node}
            disabled={locked}
            onChange={onBlendModeChange}
          />
        </InspectorLabelRow>
      </div>
      {canCornerRadius ? (
        <div className="mt-2 border-t border-app-border-subtle pt-2">
          <CornerRadiusControls
            node={node}
            instanceKey={instanceKey}
            locked={locked}
            onStyle={onCornerStyle}
          />
        </div>
      ) : null}
      {showArc ? (
        <div className="mt-2 border-t border-app-border-subtle pt-2">
          <ArcControls
            node={node}
            instanceKey={instanceKey}
            locked={locked}
            onStyle={onCornerStyle}
          />
        </div>
      ) : null}
    </PropertiesSection>
  );
}
