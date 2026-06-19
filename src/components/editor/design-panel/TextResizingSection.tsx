"use client";

import { useCallback } from "react";
import { PropertiesSection } from "../PropertiesSection";
import { DimensionFieldsRow } from "./DimensionFieldsRow";
import { cn } from "@/lib/utils";
import { inspectorControlHeightClass } from "@/lib/appFieldStyles";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import {
  TextAutoHeightIcon,
  TextAutoWidthIcon,
  TextFixedSizeIcon,
} from "./InspectorSettingIcons";
import type { TextResizeMode } from "@/lib/text/textNodeModel";
import { normalizeTextResizeMode } from "@/lib/text/textNodeModel";
import { resolveTextNodeFromStore } from "@/lib/text/setTextResizeModeForNode";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";

const RESIZE_MODES: readonly {
  value: TextResizeMode;
  label: string;
  title: string;
  Icon: typeof TextAutoWidthIcon;
}[] = [
  {
    value: "auto-width",
    label: "Auto width",
    title: "Grow width with content (point text)",
    Icon: TextAutoWidthIcon,
  },
  {
    value: "auto-height",
    label: "Auto height",
    title: "Fixed width, height grows when text wraps",
    Icon: TextAutoHeightIcon,
  },
  {
    value: "fixed",
    label: "Fixed size",
    title: "Fixed width and height",
    Icon: TextFixedSizeIcon,
  },
];

export function TextResizingSection({
  node,
  instanceKey,
  locked,
  onStyle,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  onStyle: (p: NodeStylePatch) => void;
}) {
  const nodes = useEditorStore((s) => s.nodes);
  const setTextResizeMode = useEditorStore((s) => s.setTextResizeMode);

  const storeNode = resolveTextNodeFromStore(nodes, node.id) ?? node;
  const mode = normalizeTextResizeMode(storeNode.textResizeMode, storeNode.autoResize);
  const widthDisabled = locked || mode === "auto-width";
  const heightDisabled = locked || mode !== "fixed";

  const onModeChange = useCallback(
    (next: TextResizeMode) => {
      const current = resolveTextNodeFromStore(useEditorStore.getState().nodes, node.id);
      if (!current) return;
      const currentMode = normalizeTextResizeMode(current.textResizeMode, current.autoResize);
      if (next === currentMode) return;
      setTextResizeMode(node.id, next);
    },
    [node.id, setTextResizeMode],
  );

  return (
    <PropertiesSection title="Resizing" defaultOpen>
      <div
        className={cn(
          "flex items-stretch rounded-md border border-app-border bg-app-inset p-0.5",
          inspectorControlHeightClass,
        )}
        role="group"
        aria-label="Text resize mode"
      >
        {RESIZE_MODES.map(({ value, label, title, Icon }) => {
          const selected = mode === value;
          return (
            <EditorHintWrap key={value} title={title} disabled={locked}>
              <button
                type="button"
                disabled={locked}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => onModeChange(value)}
                className={cn(
                  "flex min-h-0 flex-1 items-center justify-center rounded-[5px] transition-colors disabled:opacity-40",
                  selected
                    ? "bg-app-panel text-app-fg shadow-sm"
                    : "text-app-muted hover:text-app-fg",
                )}
              >
                <Icon />
              </button>
            </EditorHintWrap>
          );
        })}
      </div>

      <div className="mt-2">
        <div className="inspector-field-label mb-1">Dimensions</div>
        <DimensionFieldsRow
          width={storeNode.width}
          height={storeNode.height}
          instanceKey={`${instanceKey}-text`}
          locked={locked}
          widthDisabled={widthDisabled}
          heightDisabled={heightDisabled}
          showAspectLock={false}
          decimals={2}
          onCommitDimensions={({ width, height }) => {
            const patch: NodeStylePatch = {};
            if (!widthDisabled) patch.width = width;
            if (!heightDisabled) {
              patch.height = height;
            } else if (height !== storeNode.height) {
              // Aspect lock scaled height while W is the editable axis (auto-height).
              patch.height = height;
            }
            if (Object.keys(patch).length > 0) onStyle(patch);
          }}
        />
      </div>
    </PropertiesSection>
  );
}
