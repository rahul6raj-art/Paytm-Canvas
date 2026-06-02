"use client";

import { PropertiesSection } from "../PropertiesSection";
import { PropertyNumberInput } from "../PropertyInput";
import { CornerRadiusControls } from "../CornerRadiusControls";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";

export function AppearanceSection({
  node,
  instanceKey,
  locked,
  layerOpacity,
  canCornerRadius,
  onOpacityCommit,
  onCornerStyle,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  layerOpacity: number;
  canCornerRadius: boolean;
  onOpacityCommit: (opacity: number) => void;
  onCornerStyle: (patch: NodeStylePatch) => void;
}) {
  return (
    <PropertiesSection title="Appearance" defaultOpen>
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
    </PropertiesSection>
  );
}
