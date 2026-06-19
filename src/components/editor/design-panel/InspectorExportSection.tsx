"use client";

import { InspectorSegmented } from "./InspectorPrimitives";
import { PNG_EXPORT_SCALE_OPTIONS } from "@/lib/inspectExport";
import { cn } from "@/lib/utils";

const PANEL_BTN =
  "flex-1 rounded border border-app-border py-1.5 text-ui font-medium text-app-muted transition-colors hover:bg-white/[0.05] hover:text-app-fg disabled:opacity-40";

const INSPECT_BTN =
  "h-8 rounded-md border border-white/10 bg-white/[0.05] text-ui font-medium text-white hover:border-white/20 disabled:opacity-50";

export function InspectorExportSection({
  variant = "panel",
  exportBusy,
  pngScale,
  onPngScaleChange,
  onExportPng,
  onExportSvg,
  onExportPdf,
}: {
  variant?: "panel" | "inspect";
  exportBusy: "png" | "svg" | "pdf" | null;
  pngScale: number;
  onPngScaleChange: (scale: number) => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onExportPdf: () => void;
}) {
  const btnClass = variant === "inspect" ? INSPECT_BTN : PANEL_BTN;
  const rowClass = "grid grid-cols-3 gap-2";

  return (
    <div className="space-y-2">
      <div className={rowClass}>
        <button type="button" disabled={exportBusy !== null} onClick={onExportPng} className={btnClass}>
          {exportBusy === "png" ? "…" : "PNG"}
        </button>
        <button type="button" disabled={exportBusy !== null} onClick={onExportSvg} className={btnClass}>
          {exportBusy === "svg" ? "…" : "SVG"}
        </button>
        <button type="button" disabled={exportBusy !== null} onClick={onExportPdf} className={btnClass}>
          {exportBusy === "pdf" ? "…" : "PDF"}
        </button>
      </div>
      <div>
        <div className={cn("mb-1 text-ui font-medium", variant === "inspect" ? "text-white/55" : "text-app-subtle")}>
          PNG scale
        </div>
        <InspectorSegmented
          options={PNG_EXPORT_SCALE_OPTIONS}
          value={String(pngScale)}
          disabled={exportBusy !== null}
          scrollable
          onChange={(v) => onPngScaleChange(parseFloat(v))}
        />
      </div>
    </div>
  );
}
