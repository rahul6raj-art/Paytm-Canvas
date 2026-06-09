"use client";

import { useEffect, useRef } from "react";
import { PropertiesSection } from "../PropertiesSection";
import { PropertyNumberInput } from "../PropertyInput";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { TransformActions } from "./TransformSettingIcons";

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
  const geomSnapshotRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    if (transformMode === "rotate") {
      if (!geomSnapshotRef.current) {
        geomSnapshotRef.current = {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        };
      }
      return;
    }
    geomSnapshotRef.current = null;
  }, [transformMode, node.x, node.y, node.width, node.height]);

  useEffect(() => {
    geomSnapshotRef.current = null;
  }, [instanceKey]);

  const freezeGeom = transformMode === "rotate" && geomSnapshotRef.current != null;
  const displayX = freezeGeom ? geomSnapshotRef.current!.x : node.x;
  const displayY = freezeGeom ? geomSnapshotRef.current!.y : node.y;
  const displayW = freezeGeom ? geomSnapshotRef.current!.width : node.width;
  const displayH = freezeGeom ? geomSnapshotRef.current!.height : node.height;

  return (
    <PropertiesSection title="Position" defaultOpen>
      <div className="grid grid-cols-3 gap-1">
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
        <PropertyNumberInput
          commitOnInput={false}
          label="R"
          value={node.rotation}
          instanceKey={`${instanceKey}-rot`}
          disabled={locked}
          onCommit={(v) => onPatch({ rotation: ((v % 360) + 360) % 360 })}
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
        <TransformActions
          flipHorizontal={node.flipHorizontal}
          flipVertical={node.flipVertical}
          disabled={locked}
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
