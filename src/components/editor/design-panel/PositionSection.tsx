"use client";

import { PropertiesSection } from "../PropertiesSection";
import { PropertyNumberInput } from "../PropertyInput";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { RotationTransformRow } from "./TransformSettingIcons";

export function PositionSection({
  node,
  instanceKey,
  locked,
  parentAutoLayout,
  isContainer,
  onPatch,
  onResizeFrame,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  parentAutoLayout: boolean;
  isContainer: boolean;
  onPatch: (p: Partial<EditorNode>) => void;
  onResizeFrame: (width: number, height: number) => void;
}) {
  const transformMode = useEditorStore((s) => s.transformInteractionMode);
  const rotateGeomSnapshot = useEditorStore((s) => s.rotateGeomSnapshot);

  const freezeGeom =
    transformMode === "rotate" &&
    rotateGeomSnapshot != null &&
    rotateGeomSnapshot.nodeId === node.id;
  const displayX = freezeGeom ? rotateGeomSnapshot.x : node.x;
  const displayY = freezeGeom ? rotateGeomSnapshot.y : node.y;
  const displayW = freezeGeom ? rotateGeomSnapshot.width : node.width;
  const displayH = freezeGeom ? rotateGeomSnapshot.height : node.height;

  return (
    <PropertiesSection title="Position" defaultOpen>
      <div className="grid grid-cols-2 gap-2">
        <PropertyNumberInput
          commitOnInput={false}
          label="X"
          value={displayX}
          instanceKey={`${instanceKey}-x`}
          disabled={locked || parentAutoLayout}
          decimals={2}
          onCommit={(v) => onPatch({ x: v })}
        />
        <PropertyNumberInput
          commitOnInput={false}
          label="Y"
          value={displayY}
          instanceKey={`${instanceKey}-y`}
          disabled={locked || parentAutoLayout}
          decimals={2}
          onCommit={(v) => onPatch({ y: v })}
        />
      </div>
      <div className="mt-1.5 grid grid-cols-2 gap-1">
        <PropertyNumberInput
          commitOnInput={false}
          label="W"
          value={displayW}
          instanceKey={`${instanceKey}-w`}
          disabled={locked}
          min={1}
          onCommit={(v) =>
            isContainer ? onResizeFrame(v, displayH) : onPatch({ width: v })
          }
        />
        <PropertyNumberInput
          commitOnInput={false}
          label="H"
          value={displayH}
          instanceKey={`${instanceKey}-h`}
          disabled={locked}
          min={1}
          onCommit={(v) =>
            isContainer ? onResizeFrame(displayW, v) : onPatch({ height: v })
          }
        />
      </div>
      <div className="mt-1.5">
        <RotationTransformRow
          rotation={node.rotation}
          flipHorizontal={node.flipHorizontal}
          flipVertical={node.flipVertical}
          disabled={locked}
          instanceKey={`${instanceKey}-rot`}
          onRotationCommit={(deg) => onPatch({ rotation: deg })}
          onRotate90={() =>
            onPatch({ rotation: ((node.rotation + 90) % 360 + 360) % 360 })
          }
          onFlipHorizontal={() => onPatch({ flipHorizontal: !node.flipHorizontal })}
          onFlipVertical={() => onPatch({ flipVertical: !node.flipVertical })}
        />
      </div>
    </PropertiesSection>
  );
}
