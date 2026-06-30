"use client";

import { useMemo } from "react";
import { ColorInput } from "./ColorInput";
import { DesignColorModeSection } from "./DesignColorModeSection";
import { PropertiesSection } from "./PropertiesSection";
import { StrokeWidthToolbar } from "./StrokeWidthToolbar";
import { useTheme } from "@/components/ThemeProvider";
import { useEditorStore } from "@/stores/useEditorStore";
import { resolveDisplayCanvasBackgroundHex } from "@/lib/canvasVisual";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "./EditorHoverHint";

const BACKGROUND_PRESETS = [
  "#ffffff",
  "#1e1e1e",
  "#e5e5e5",
  "#e8eaed",
  "#ebebeb",
  "#f5f5f5",
  "#d4d4d4",
  "#212121",
] as const;

function normalizeHex(hex: string): string {
  return hex.trim().toLowerCase();
}

export function CanvasInspector() {
  const canvasBackgroundColor = useEditorStore((s) => s.canvasBackgroundColor);
  const setCanvasBackgroundColor = useEditorStore((s) => s.setCanvasBackgroundColor);
  const tool = useEditorStore((s) => s.tool);
  const { resolved: theme } = useTheme();
  const effectiveBackground = useMemo(
    () => resolveDisplayCanvasBackgroundHex(canvasBackgroundColor, theme),
    [canvasBackgroundColor, theme],
  );

  return (
    <div>
      {tool === "pencil" ? (
        <PropertiesSection title="Pencil" defaultOpen>
          <StrokeWidthToolbar />
        </PropertiesSection>
      ) : null}
      <DesignColorModeSection compact className="border-b border-app-panel-edge" />
      <PropertiesSection title="Canvas">
        <ColorInput
          label="Pasteboard"
          hex={effectiveBackground}
          onCommitHex={(hex, opts) => setCanvasBackgroundColor(hex, opts)}
        />
        <div className="flex flex-wrap gap-1.5">
          {BACKGROUND_PRESETS.map((hex) => (
            <EditorHintWrap key={hex} title={hex}>
              <button
                type="button"
                aria-label={`Set canvas background to ${hex}`}
                onClick={() => setCanvasBackgroundColor(hex)}
                className={cn(
                  "h-5 w-5 shrink-0 rounded border transition-transform hover:scale-110",
                  normalizeHex(effectiveBackground) === normalizeHex(hex)
                    ? "border-app-fg ring-1 ring-app-border"
                    : "border-app-border-subtle",
                )}
                style={{ backgroundColor: hex }}
              />
            </EditorHintWrap>
          ))}
        </div>
      </PropertiesSection>
    </div>
  );
}
