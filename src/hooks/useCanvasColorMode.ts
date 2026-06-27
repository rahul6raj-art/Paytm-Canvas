import { useEditorStore } from "@/stores/useEditorStore";
import type { CanvasColorMode } from "@/lib/designTokens";

export function useCanvasColorMode(): CanvasColorMode {
  return useEditorStore((s) => s.canvasColorMode);
}
