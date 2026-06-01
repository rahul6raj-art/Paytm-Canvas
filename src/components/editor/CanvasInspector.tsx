"use client";

import { Grid3X3 } from "lucide-react";
import { ColorInput } from "./ColorInput";
import { PropertiesSection } from "./PropertiesSection";
import { useEditorStore } from "@/stores/useEditorStore";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { cn } from "@/lib/utils";

const BACKGROUND_PRESETS = [
  DEFAULT_CANVAS_BACKGROUND,
  "#ebebeb",
  "#f5f5f5",
  "#ffffff",
  "#d4d4d4",
  "#1e1e1e",
] as const;

export function CanvasInspector() {
  const canvasBackgroundColor = useEditorStore((s) => s.canvasBackgroundColor);
  const setCanvasBackgroundColor = useEditorStore((s) => s.setCanvasBackgroundColor);
  const showGrid = useEditorStore((s) => s.showGrid);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);

  return (
    <div className="py-1">
      <PropertiesSection title="Canvas">
        <ColorInput
          label="Background"
          hex={canvasBackgroundColor}
          onCommitHex={setCanvasBackgroundColor}
        />
        <div className="flex flex-wrap gap-1 pt-0.5">
          {BACKGROUND_PRESETS.map((hex) => (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={`Set canvas background to ${hex}`}
              onClick={() => setCanvasBackgroundColor(hex)}
              className={cn(
                "h-5 w-5 shrink-0 rounded border transition-transform hover:scale-110",
                canvasBackgroundColor === hex
                  ? "border-accent ring-1 ring-accent"
                  : "border-black/20",
              )}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => toggleGrid()}
          className={cn(
            "mt-1 flex h-7 w-full items-center justify-center gap-1.5 rounded border text-[11px] font-medium transition-colors",
            showGrid
              ? "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.12)] text-[#c4e8ff]"
              : "border-white/[0.1] bg-[#262626] text-[#c4c4c4] hover:bg-white/[0.06]",
          )}
        >
          <Grid3X3 className="h-3.5 w-3.5" strokeWidth={1.75} />
          {showGrid ? "Layout grid on" : "Layout grid off"}
        </button>
      </PropertiesSection>
      <p className="px-2 pb-3 text-[11px] leading-relaxed text-[#6b6b6b]">
        Background applies to this page&apos;s workspace. Switch pages to set a different color per page.
      </p>
    </div>
  );
}
