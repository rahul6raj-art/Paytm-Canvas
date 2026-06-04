"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { normalizeHex } from "@/lib/color";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "../useAnchoredDropdown";
import { StrokeAdvancedPanel } from "./StrokeAdvancedPanel";
import { StrokeEndpointPicker } from "./StrokeEndpointPicker";
import { cn } from "@/lib/utils";
import type { StrokeEndpoint } from "@/lib/strokeEndpoints";
import {
  resolveStrokeStyle,
  type StrokeLinecap,
  type StrokeLinejoin,
  type StrokeStyleKind,
} from "@/lib/stroke";
import type { StrokeSidesCustom, StrokeSidesMode } from "@/lib/strokeAlign";
import { StrokeSidesPicker } from "./StrokeSidesPicker";
import type { StrokePosition } from "@/stores/useEditorStore";

const field =
  "h-6 min-h-[24px] rounded border border-app-border bg-app-field px-1.5 text-[12px] text-app-field-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40";

export type StrokeStylePatch = {
  strokeWidth?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeEnabled?: boolean;
  strokeStyle?: StrokeStyleKind;
  strokePosition?: StrokePosition;
  strokeSides?: StrokeSidesMode;
  strokeSidesCustom?: StrokeSidesCustom;
  strokeDashLength?: number;
  strokeDashGap?: number;
  strokeLinecap?: StrokeLinecap;
  strokeLinejoin?: StrokeLinejoin;
  strokeMiterAngle?: number;
  strokeWidthProfile?: "uniform";
  strokeWidthProfileFlipped?: boolean;
  strokeStartPoint?: StrokeEndpoint;
  strokeEndPoint?: StrokeEndpoint;
  arrowHead?: boolean;
};

const POSITION_OPTIONS: { value: StrokePosition; label: string }[] = [
  { value: "inside", label: "Inside" },
  { value: "center", label: "Center" },
  { value: "outside", label: "Outside" },
];

export function StrokeSection({
  instanceKey,
  locked,
  strokeWidth,
  strokeColor,
  strokeOpacity = 1,
  strokeEnabled = true,
  strokeStyle,
  strokePosition,
  strokeSides = "all",
  strokeSidesCustom,
  showSides = false,
  strokeDashLength,
  strokeDashGap,
  strokeLinecap,
  strokeLinejoin,
  strokeMiterAngle,
  strokeWidthProfileFlipped,
  strokeStartPoint = "none",
  strokeEndPoint = "none",
  showEndpoints = false,
  onStyle,
}: {
  instanceKey: string;
  locked: boolean;
  strokeWidth: number;
  strokeColor: string;
  strokeOpacity?: number;
  strokeEnabled?: boolean;
  strokeStyle: StrokeStyleKind;
  strokePosition: StrokePosition;
  strokeSides?: StrokeSidesMode;
  strokeSidesCustom?: StrokeSidesCustom;
  /** Per-side stroke control (Figma-style) for rectangles and frames. */
  showSides?: boolean;
  strokeDashLength?: number;
  strokeDashGap?: number;
  strokeLinecap?: StrokeLinecap;
  strokeLinejoin?: StrokeLinejoin;
  strokeMiterAngle?: number;
  strokeWidthProfileFlipped?: boolean;
  strokeStartPoint?: StrokeEndpoint;
  strokeEndPoint?: StrokeEndpoint;
  showEndpoints?: boolean;
  onStyle: (patch: StrokeStylePatch) => void;
}) {
  const hasStroke = strokeWidth > 0;
  const safeHex = normalizeHex(strokeColor) ?? "#000000";
  const [hexDraft, setHexDraft] = useState(safeHex.replace("#", "").toUpperCase());
  const [opDraft, setOpDraft] = useState(String(Math.round(strokeOpacity * 100)));
  const [weightDraft, setWeightDraft] = useState(String(strokeWidth || 1));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const advancedRef = useRef<HTMLButtonElement>(null);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const advancedPos = useAnchoredDropdownPosition(advancedRef, advancedOpen, 4, {
    viewportClamp: true,
    width: 228,
  });
  useDismissAnchoredDropdown(advancedOpen, () => setAdvancedOpen(false), advancedRef, advancedMenuRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setHexDraft(safeHex.replace("#", "").toUpperCase());
    setOpDraft(String(Math.round(strokeOpacity * 100)));
    setWeightDraft(String(strokeWidth || 1));
  }, [safeHex, strokeOpacity, strokeWidth, instanceKey]);

  const disabled = locked || !strokeEnabled;
  const style = resolveStrokeStyle({ strokeStyle });

  const addStroke = () => {
    onStyle({
      strokeWidth: 1,
      strokeColor: strokeColor || "#000000",
      strokeStyle: strokeStyle || "solid",
      strokeEnabled: true,
      strokeOpacity: strokeOpacity ?? 1,
    });
  };

  const advancedMenu =
    advancedOpen && mounted && hasStroke ? (
      <div
        ref={advancedMenuRef}
        className="fixed z-[120] overflow-hidden rounded-md border border-app-border bg-app-panel shadow-xl"
        style={anchoredMenuStyle(advancedPos)}
      >
        <StrokeAdvancedPanel
          instanceKey={instanceKey}
          locked={locked}
          strokeWidth={strokeWidth}
          strokeStyle={style}
          strokeDashLength={strokeDashLength}
          strokeDashGap={strokeDashGap}
          strokeLinecap={strokeLinecap}
          strokeLinejoin={strokeLinejoin}
          strokeMiterAngle={strokeMiterAngle}
          strokeWidthProfileFlipped={strokeWidthProfileFlipped}
          onStyle={onStyle}
        />
      </div>
    ) : null;

  return (
    <PropertiesSection title="Stroke" defaultOpen>
      {!hasStroke ? (
        <button
          type="button"
          disabled={locked}
          onClick={addStroke}
          className="flex h-7 w-full items-center justify-center gap-1 rounded border border-dashed border-app-border text-[11px] font-medium text-app-muted hover:border-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add stroke
        </button>
      ) : (
        <div className="space-y-2">
          {/* Color + opacity + visibility + remove */}
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={safeHex}
              disabled={disabled}
              onChange={(e) => onStyle({ strokeColor: e.target.value.toLowerCase() })}
              className="h-6 w-6 shrink-0 cursor-pointer rounded border border-app-border bg-transparent p-0 disabled:opacity-40"
              aria-label="Stroke color"
            />
            <input
              type="text"
              disabled={disabled}
              className={cn(field, "min-w-0 flex-1 font-mono uppercase")}
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value.replace(/#/g, ""))}
              onBlur={() => {
                const n = normalizeHex(`#${hexDraft}`);
                if (n) onStyle({ strokeColor: n });
                else setHexDraft(safeHex.replace("#", "").toUpperCase());
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <input
              type="text"
              disabled={disabled}
              className={cn(field, "w-12 shrink-0 text-right tabular-nums")}
              value={`${opDraft}%`}
              onChange={(e) => setOpDraft(e.target.value.replace(/%/g, ""))}
              onBlur={() => {
                const n = parseInt(opDraft, 10);
                if (Number.isFinite(n)) {
                  onStyle({ strokeOpacity: Math.min(100, Math.max(0, n)) / 100 });
                } else setOpDraft(String(Math.round(strokeOpacity * 100)));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
            />
            <button
              type="button"
              disabled={locked}
              title={strokeEnabled ? "Hide stroke" : "Show stroke"}
              onClick={() => onStyle({ strokeEnabled: !strokeEnabled })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover disabled:opacity-40"
            >
              {strokeEnabled ? (
                <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
              ) : (
                <EyeOff className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
            </button>
            <button
              type="button"
              disabled={locked}
              onClick={() => onStyle({ strokeWidth: 0, strokeEnabled: false })}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-app-muted hover:bg-app-hover hover:text-rose-300 disabled:opacity-40"
              aria-label="Remove stroke"
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>

          {/* Position + sides + weight + advanced */}
          <div className="flex items-end gap-1">
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Position</div>
              <select
                disabled={disabled}
                className={cn(field, "w-full capitalize")}
                value={strokePosition}
                onChange={(e) => onStyle({ strokePosition: e.target.value as StrokePosition })}
              >
                {POSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            {showSides ? (
              <div className="shrink-0">
                <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Sides</div>
                <StrokeSidesPicker
                  disabled={disabled}
                  strokeSides={strokeSides}
                  strokeSidesCustom={strokeSidesCustom}
                  onChange={onStyle}
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Weight</div>
              <div className="flex h-6 items-center overflow-hidden rounded border border-app-border bg-app-field focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
                <span className="flex h-full w-6 shrink-0 items-center justify-center border-r border-app-border text-app-muted">
                  <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden>
                    <line x1={1} y1={4} x2={11} y2={4} stroke="currentColor" strokeWidth={2} />
                  </svg>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={disabled}
                  className="h-full min-w-0 flex-1 border-0 bg-transparent px-1.5 text-[12px] tabular-nums text-app-field-fg focus-visible:outline-none"
                  value={weightDraft}
                  onChange={(e) => setWeightDraft(e.target.value)}
                  onBlur={() => {
                    const n = parseFloat(weightDraft);
                    if (Number.isFinite(n)) {
                      onStyle({ strokeWidth: Math.min(256, Math.max(0, n)) });
                    } else setWeightDraft(String(strokeWidth));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
              </div>
            </div>
            <button
              ref={advancedRef}
              type="button"
              disabled={disabled}
              title="Stroke settings"
              onClick={() => setAdvancedOpen((o) => !o)}
              className={cn(
                "mb-0 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-app-border bg-app-panel text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40",
                advancedOpen && "border-accent bg-accent/10 text-accent",
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>

          {showEndpoints ? (
            <div className="flex gap-1">
              <StrokeEndpointPicker
                label="Start point"
                value={strokeStartPoint}
                disabled={disabled}
                onChange={(v) => onStyle({ strokeStartPoint: v, arrowHead: false })}
              />
              <StrokeEndpointPicker
                label="End point"
                value={strokeEndPoint}
                disabled={disabled}
                onChange={(v) =>
                  onStyle({
                    strokeEndPoint: v,
                    arrowHead: v === "triangle-arrow",
                  })
                }
              />
            </div>
          ) : null}
        </div>
      )}
      {mounted && advancedMenu ? createPortal(advancedMenu, document.body) : null}
    </PropertiesSection>
  );
}
