"use client";

import { Grid3X3, Ruler } from "lucide-react";
import { ColorInput } from "./ColorInput";
import { PropertiesSection } from "./PropertiesSection";
import { StrokeWidthToolbar } from "./StrokeWidthToolbar";
import { useEditorStore } from "@/stores/useEditorStore";
import { CANVAS_WORKSPACE_DARK, DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import { cn } from "@/lib/utils";

const BACKGROUND_PRESETS = [
  DEFAULT_CANVAS_BACKGROUND,
  CANVAS_WORKSPACE_DARK,
  "#e8eaed",
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
  const showRulers = useEditorStore((s) => s.showRulers);
  const toggleGrid = useEditorStore((s) => s.toggleGrid);
  const toggleRulers = useEditorStore((s) => s.toggleRulers);
  const tool = useEditorStore((s) => s.tool);

  return (
    <div>
      {tool === "pencil" ? (
        <PropertiesSection title="Pencil" defaultOpen>
          <StrokeWidthToolbar />
        </PropertiesSection>
      ) : null}
      <PropertiesSection title="Canvas">
        <ColorInput
          label="Background"
          hex={canvasBackgroundColor}
          onCommitHex={(hex, opts) => setCanvasBackgroundColor(hex, opts)}
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
          onClick={() => toggleRulers()}
          className={cn(
            "mt-1 flex h-7 w-full items-center justify-center gap-1.5 rounded border text-ui font-medium transition-colors",
            showRulers
              ? "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.12)] text-[#c4e8ff]"
              : "border-app-border bg-app-field text-app-muted hover:bg-app-hover",
          )}
        >
          <Ruler className="h-3.5 w-3.5" strokeWidth={1.75} />
          {showRulers ? "Rulers on" : "Rulers off"}
        </button>
        <button
          type="button"
          onClick={() => toggleGrid()}
          className={cn(
            "mt-1 flex h-7 w-full items-center justify-center gap-1.5 rounded border text-ui font-medium transition-colors",
            showGrid
              ? "border-[rgba(13,153,255,0.45)] bg-[rgba(13,153,255,0.12)] text-[#c4e8ff]"
              : "border-app-border bg-app-field text-app-muted hover:bg-app-hover",
          )}
        >
          <Grid3X3 className="h-3.5 w-3.5" strokeWidth={1.75} />
          {showGrid ? "Layout grid on" : "Layout grid off"}
        </button>
      </PropertiesSection>
    </div>
  );
}
