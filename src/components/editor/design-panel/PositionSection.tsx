"use client";

import { PropertiesSection } from "../PropertiesSection";
import { PropertyNumberInput } from "../PropertyInput";
import { DimensionFieldsRow } from "./DimensionFieldsRow";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { rotateGeomSnapshotForNode } from "@/lib/rotation/rotateGeometryLock";
import { RotationTransformRow } from "./TransformSettingIcons";
import { inspectorTwoColGridClass } from "@/lib/appFieldStyles";

export function PositionSection({
  node,
  instanceKey,
  locked,
  parentAutoLayout,
  isContainer,
  hideDimensions,
  onPatch,
  onResizeFrame,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  parentAutoLayout: boolean;
  isContainer: boolean;
  hideDimensions?: boolean;
  onPatch: (p: Partial<EditorNode>) => void;
  onResizeFrame: (width: number, height: number) => void;
}) {
  const transformMode = useEditorStore((s) => s.transformInteractionMode);
  const rotateSnap = useEditorStore((s) => rotateGeomSnapshotForNode(s, node.id));
  const freezePosition = useEditorStore(
    (s) => transformMode === "rotate" && s.rotateGeomSnapshot?.nodeId === node.id,
  );

  const freezeGeom = transformMode === "rotate" && rotateSnap != null;
  const displayX = freezePosition && rotateSnap ? rotateSnap.x : node.x;
  const displayY = freezePosition && rotateSnap ? rotateSnap.y : node.y;
  const displayW = freezeGeom && rotateSnap ? rotateSnap.width : node.width;
  const displayH = freezeGeom && rotateSnap ? rotateSnap.height : node.height;

  return (
    <PropertiesSection title="Position" defaultOpen>
      <div className={inspectorTwoColGridClass}>
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
      {!hideDimensions ? (
        <div className="mt-1.5">
          <DimensionFieldsRow
            width={displayW}
            height={displayH}
            instanceKey={instanceKey}
            locked={locked}
            onCommitDimensions={({ width, height }) =>
              isContainer ? onResizeFrame(width, height) : onPatch({ width, height })
            }
          />
        </div>
      ) : null}
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
