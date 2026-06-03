"use client";

import { PropertiesSection } from "../PropertiesSection";
import { PropertyNumberInput } from "../PropertyInput";
import type { EditorNode } from "@/stores/useEditorStore";
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
  return (
    <PropertiesSection title="Position" defaultOpen>
      <div className="grid grid-cols-3 gap-1">
        <PropertyNumberInput
          commitOnInput={false}
          label="X"
          value={node.x}
          instanceKey={`${instanceKey}-x`}
          disabled={locked || parentAutoLayout}
          decimals={2}
          onCommit={(v) => onPatch({ x: v })}
        />
        <PropertyNumberInput
          commitOnInput={false}
          label="Y"
          value={node.y}
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
          value={node.width}
          instanceKey={`${instanceKey}-w`}
          disabled={locked}
          min={1}
          onCommit={(v) =>
            isContainer ? onResizeFrame(v, node.height) : onPatch({ width: v })
          }
        />
        <PropertyNumberInput
          commitOnInput={false}
          label="H"
          value={node.height}
          instanceKey={`${instanceKey}-h`}
          disabled={locked}
          min={1}
          onCommit={(v) =>
            isContainer ? onResizeFrame(node.width, v) : onPatch({ height: v })
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
