"use client";

import { Link2, Unlink2 } from "lucide-react";
import { AutoLayoutDimensionField } from "./AutoLayoutDimensionField";
import { DimensionFieldsIconButton } from "./DimensionFieldsIconButton";
import { inspectorRowGapClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import { inspectorLucideProps } from "@/lib/inspectorIconStyles";
import { applyAspectLockedDimensions } from "@/lib/dimensionAspectLock";
import {
  useEditorStore,
  type EditorNode,
  type LayoutSizingMode,
} from "@/stores/useEditorStore";
import { canFillOnAxis } from "@/lib/layoutEngine/layoutConstraints";

function axisSizingMode(node: EditorNode, axis: "horizontal" | "vertical"): LayoutSizingMode {
  return axis === "horizontal"
    ? (node.layoutSizingHorizontal ?? "fixed")
    : (node.layoutSizingVertical ?? "fixed");
}

function canUseFillOnAxis(
  node: EditorNode,
  nodes: Record<string, EditorNode>,
  axis: "horizontal" | "vertical",
): boolean {
  const pid = node.parentId;
  if (!pid) return false;
  const parent = nodes[pid];
  if (!parent || (parent.layoutMode ?? "none") === "none") return false;
  return canFillOnAxis(parent, axis);
}

export function AutoLayoutDimensionFieldsRow({
  node,
  nodes,
  width,
  height,
  instanceKey,
  locked,
  mixedWidth,
  mixedHeight,
  onResizeFrame,
  onUpdateLayout,
}: {
  node: EditorNode;
  nodes: Record<string, EditorNode>;
  width: number;
  height: number;
  instanceKey: string;
  locked: boolean;
  mixedWidth?: boolean;
  mixedHeight?: boolean;
  onResizeFrame: (width: number, height: number) => void;
  onUpdateLayout: (patch: Partial<EditorNode>) => void;
}) {
  const updateLayoutSizing = useEditorStore((s) => s.updateLayoutSizing);
  const aspectRatioLocked = useEditorStore((s) => s.inspectorAspectRatioLocked);
  const toggleInspectorAspectRatioLocked = useEditorStore(
    (s) => s.toggleInspectorAspectRatioLocked,
  );

  const widthMode = axisSizingMode(node, "horizontal");
  const heightMode = axisSizingMode(node, "vertical");
  const widthEditable = widthMode === "fixed";
  const heightEditable = heightMode === "fixed";

  const commitWidth = (value: number) => {
    if (aspectRatioLocked && widthEditable && heightEditable) {
      const next = applyAspectLockedDimensions(
        { width, height },
        "width",
        value,
        true,
        1,
      );
      onResizeFrame(next.width, next.height);
      return;
    }
    onResizeFrame(value, height);
  };

  const commitHeight = (value: number) => {
    if (aspectRatioLocked && widthEditable && heightEditable) {
      const next = applyAspectLockedDimensions(
        { width, height },
        "height",
        value,
        true,
        1,
      );
      onResizeFrame(next.width, next.height);
      return;
    }
    onResizeFrame(width, value);
  };

  return (
    <div className={cn("grid items-end", inspectorRowGapClass, "grid-cols-[1fr_1fr_auto]")}>
      <AutoLayoutDimensionField
        axis="horizontal"
        value={width}
        sizingMode={widthMode}
        minConstraint={node.minWidth}
        maxConstraint={node.maxWidth}
        locked={locked}
        allowFill={canUseFillOnAxis(node, nodes, "horizontal")}
        mixed={mixedWidth}
        instanceKey={`${instanceKey}-w`}
        onSelectMode={(mode) => updateLayoutSizing(node.id, "horizontal", mode)}
        onCommitDimension={commitWidth}
        onCommitMin={(v) => onUpdateLayout({ minWidth: v })}
        onCommitMax={(v) => onUpdateLayout({ maxWidth: v })}
      />
      <AutoLayoutDimensionField
        axis="vertical"
        value={height}
        sizingMode={heightMode}
        minConstraint={node.minHeight}
        maxConstraint={node.maxHeight}
        locked={locked}
        allowFill={canUseFillOnAxis(node, nodes, "vertical")}
        mixed={mixedHeight}
        instanceKey={`${instanceKey}-h`}
        onSelectMode={(mode) => updateLayoutSizing(node.id, "vertical", mode)}
        onCommitDimension={commitHeight}
        onCommitMin={(v) => onUpdateLayout({ minHeight: v })}
        onCommitMax={(v) => onUpdateLayout({ maxHeight: v })}
      />
      <DimensionFieldsIconButton
        title={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
        ariaLabel={aspectRatioLocked ? "Unlock aspect ratio" : "Lock aspect ratio"}
        pressed={aspectRatioLocked}
        active={aspectRatioLocked}
        disabled={locked || !widthEditable || !heightEditable}
        onClick={() => toggleInspectorAspectRatioLocked()}
      >
        {aspectRatioLocked ? (
          <Link2 {...inspectorLucideProps()} />
        ) : (
          <Unlink2 {...inspectorLucideProps()} />
        )}
      </DimensionFieldsIconButton>
    </div>
  );
}
