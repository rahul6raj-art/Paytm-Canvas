"use client";

import { PropertiesSection } from "../PropertiesSection";
import { PropertyNumberInput } from "../PropertyInput";
import { AutoLayoutDimensionFieldsRow } from "./AutoLayoutDimensionFieldsRow";
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
  isAutoLayoutContainer,
  nodesAll,
  hideDimensions,
  onPatch,
  onResizeFrame,
  onUpdateLayout,
  mixedX,
  mixedY,
  mixedWidth,
  mixedHeight,
  mixedRotation,
  displayX,
  displayY,
  displayWidth,
  displayHeight,
  displayRotation,
  dimensionMin = 1,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  parentAutoLayout: boolean;
  isContainer: boolean;
  isAutoLayoutContainer?: boolean;
  nodesAll?: Record<string, EditorNode>;
  hideDimensions?: boolean;
  onPatch: (p: Partial<EditorNode>) => void;
  onResizeFrame: (width: number, height: number) => void;
  onUpdateLayout?: (patch: Partial<EditorNode>) => void;
  mixedX?: boolean;
  mixedY?: boolean;
  mixedWidth?: boolean;
  mixedHeight?: boolean;
  mixedRotation?: boolean;
  displayX?: number;
  displayY?: number;
  displayWidth?: number;
  displayHeight?: number;
  displayRotation?: number;
  dimensionMin?: number;
}) {
  const transformMode = useEditorStore((s) => s.transformInteractionMode);
  const rotateSnap = useEditorStore((s) => rotateGeomSnapshotForNode(s, node.id));
  const freezePosition = useEditorStore(
    (s) => transformMode === "rotate" && s.rotateGeomSnapshot?.nodeId === node.id,
  );

  const freezeGeom = transformMode === "rotate" && rotateSnap != null;
  const baseX = displayX ?? node.x;
  const baseY = displayY ?? node.y;
  const baseW = displayWidth ?? node.width;
  const baseH = displayHeight ?? node.height;
  const baseRotation = displayRotation ?? node.rotation ?? 0;
  const displayXValue = freezePosition && rotateSnap ? rotateSnap.x : baseX;
  const displayYValue = freezePosition && rotateSnap ? rotateSnap.y : baseY;
  const displayW = freezeGeom && rotateSnap ? rotateSnap.width : baseW;
  const displayH = freezeGeom && rotateSnap ? rotateSnap.height : baseH;

  return (
    <PropertiesSection title="Position" defaultOpen>
      <div className={inspectorTwoColGridClass}>
        <PropertyNumberInput
          commitOnInput={false}
          label="X"
          value={displayXValue}
          mixed={mixedX}
          instanceKey={`${instanceKey}-x`}
          disabled={locked || parentAutoLayout}
          decimals={2}
          onCommit={(v) => onPatch({ x: v })}
        />
        <PropertyNumberInput
          commitOnInput={false}
          label="Y"
          value={displayYValue}
          mixed={mixedY}
          instanceKey={`${instanceKey}-y`}
          disabled={locked || parentAutoLayout}
          decimals={2}
          onCommit={(v) => onPatch({ y: v })}
        />
      </div>
      {!hideDimensions ? (
        <div className="mt-1.5">
          {isAutoLayoutContainer && nodesAll && onUpdateLayout ? (
            <AutoLayoutDimensionFieldsRow
              node={node}
              nodes={nodesAll}
              width={displayW}
              height={displayH}
              mixedWidth={mixedWidth}
              mixedHeight={mixedHeight}
              instanceKey={instanceKey}
              locked={locked}
              onResizeFrame={onResizeFrame}
              onUpdateLayout={onUpdateLayout}
            />
          ) : (
            <DimensionFieldsRow
              width={displayW}
              height={displayH}
              mixedWidth={mixedWidth}
              mixedHeight={mixedHeight}
              instanceKey={instanceKey}
              locked={locked}
              min={dimensionMin}
              onCommitDimensions={({ width, height }) =>
                isContainer ? onResizeFrame(width, height) : onPatch({ width, height })
              }
            />
          )}
        </div>
      ) : null}
      <div className="mt-1.5">
        <RotationTransformRow
          rotation={baseRotation}
          flipHorizontal={node.flipHorizontal}
          flipVertical={node.flipVertical}
          disabled={locked}
          instanceKey={`${instanceKey}-rot`}
          mixedRotation={mixedRotation}
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
