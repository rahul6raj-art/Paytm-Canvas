"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { fillCss } from "@/lib/color";
import { collectSelectionFillColors } from "@/lib/selectionColors";
import { cn } from "@/lib/utils";
import { inspectorIconClass, inspectorIconStroke } from "@/lib/inspectorIconStyles";
import { useEditorStore } from "@/stores/useEditorStore";
import { ColorInput } from "./ColorInput";

const HEADER_SWATCH_LIMIT = 3;

function SelectionColorSwatch({
  hex,
  opacity,
  size = 14,
}: {
  hex: string;
  opacity: number;
  size?: number;
}) {
  return (
    <span
      className="inline-block shrink-0 rounded-[3px] border border-white/10 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
      style={{
        width: size,
        height: size,
        background: fillCss(hex, opacity),
      }}
      aria-hidden
    />
  );
}

export function SelectionColorsSection() {
  const [open, setOpen] = useState(true);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const setNodeFillHex = useEditorStore((s) => s.setNodeFillHex);
  const updateNodeStyle = useEditorStore((s) => s.updateNodeStyle);
  const pushHistory = useEditorStore((s) => s.pushHistory);

  const colors = useMemo(
    () => collectSelectionFillColors(selectedIds, nodes),
    [selectedIds, nodes],
  );

  if (colors.length === 0) return null;

  const headerSwatches = colors.slice(0, HEADER_SWATCH_LIMIT);
  const overflow = colors.length - headerSwatches.length;

  const applyHexToNodes = (
    nodeIds: string[],
    hex: string,
    opts?: { skipHistory?: boolean },
  ) => {
    if (!opts?.skipHistory) pushHistory();
    for (const nodeId of nodeIds) {
      const n = nodes[nodeId];
      if (!n || n.locked) continue;
      setNodeFillHex(nodeId, hex, { skipHistory: true });
    }
  };

  const applyOpacityToNodes = (
    nodeIds: string[],
    opacity: number,
    opts?: { skipHistory?: boolean },
  ) => {
    if (!opts?.skipHistory) pushHistory();
    for (const nodeId of nodeIds) {
      const n = nodes[nodeId];
      if (!n || n.locked) continue;
      updateNodeStyle(nodeId, { fillOpacity: opacity }, { skipHistory: true });
    }
  };

  return (
    <section className="border-b border-app-panel-edge last:border-b-0">
      <div className="flex items-center gap-0.5 pr-1">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 px-3 py-2.5 text-left text-ui font-medium text-app-fg transition-colors hover:bg-app-hover"
        >
          <ChevronRight
            className={cn(
              inspectorIconClass,
              "text-app-subtle transition-transform",
              open && "rotate-90",
            )}
            strokeWidth={inspectorIconStroke}
          />
          Selection colors
        </button>
        {!open ? (
          <div className="flex shrink-0 items-center gap-1 pr-2">
            {headerSwatches.map((entry) => (
              <SelectionColorSwatch
                key={entry.id}
                hex={entry.hex}
                opacity={entry.opacity}
              />
            ))}
            {overflow > 0 ? (
              <span className="text-ui tabular-nums text-app-subtle">+{overflow}</span>
            ) : null}
          </div>
        ) : null}
      </div>
      {open ? (
        <div className="space-y-2 px-3 pb-4 pt-0.5">
          {colors.map((entry) => (
            <ColorInput
              key={`${entry.id}-${entry.nodeIds.join(",")}`}
              variant="inspectorRow"
              hex={entry.hex}
              opacity={entry.opacity}
              visible
              pickerTitle="Selection color"
              instanceKey={`selection-color-${entry.id}-${entry.nodeIds.join(",")}`}
              onCommitHex={(hex, opts) => applyHexToNodes(entry.nodeIds, hex, opts)}
              onCommitOpacity={(opacity, opts) =>
                applyOpacityToNodes(entry.nodeIds, opacity, opts)
              }
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
