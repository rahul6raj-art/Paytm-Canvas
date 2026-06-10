"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, EyeOff, Minus, Plus, SlidersHorizontal } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { OpacityPercentInput } from "../PropertyInput";
import { normalizeHex, parseHexInputLive } from "@/lib/color";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useEditorStore } from "@/stores/useEditorStore";
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
import { InspectorSegmented } from "./InspectorPrimitives";
import { GradientFillControls } from "../GradientFillControls";
import {
  effectiveStrokeType,
  normalizeStrokeGradient,
  type FillGradient,
} from "@/lib/fillGradient";
import { strokePaintCss } from "@/lib/fillGradient";

const field =
  "h-6 min-h-[24px] rounded border border-app-border bg-app-field px-1.5 text-[12px] text-app-field-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40";

export type StrokeStylePatch = {
  strokeWidth?: number;
  strokeColor?: string;
  strokeType?: "solid" | "gradient";
  strokeGradient?: FillGradient;
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
  strokeWidthProfile?: "uniform" | "taper";
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
  strokeType = "solid",
  strokeGradient,
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
  strokeWidthProfile,
  strokeWidthProfileFlipped,
  strokeStartPoint = "none",
  strokeEndPoint = "none",
  showEndpoints = false,
  onStyle,
  onApplyStrokeGradient,
}: {
  instanceKey: string;
  locked: boolean;
  strokeWidth: number;
  strokeColor: string;
  strokeType?: "solid" | "gradient";
  strokeGradient?: FillGradient;
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
  strokeWidthProfile?: "uniform" | "taper";
  strokeWidthProfileFlipped?: boolean;
  strokeStartPoint?: StrokeEndpoint;
  strokeEndPoint?: StrokeEndpoint;
  showEndpoints?: boolean;
  onStyle: (patch: StrokeStylePatch) => void;
  onApplyStrokeGradient?: (g: FillGradient, opts?: { skipHistory?: boolean }) => void;
}) {
  const hasStroke = strokeWidth > 0;
  const safeHex = normalizeHex(strokeColor) ?? "#000000";
  const resolvedStrokeType = effectiveStrokeType({
    strokeType,
    strokeGradient,
    strokeColor,
  });
  const normalizedStrokeGradient = normalizeStrokeGradient(strokeGradient, strokeColor);
  const [hexDraft, setHexDraft] = useState(safeHex.replace("#", "").toUpperCase());
  const [hexFocused, setHexFocused] = useState(false);
  const [weightDraft, setWeightDraft] = useState(String(strokeWidth || 1));
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const lastAppliedHexRef = useRef(safeHex);
  const dirtyHexLiveRef = useRef(false);
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
    if (!hexFocused) {
      setHexDraft(safeHex.replace("#", "").toUpperCase());
      lastAppliedHexRef.current = safeHex;
      dirtyHexLiveRef.current = false;
    }
    setWeightDraft(String(strokeWidth || 1));
  }, [safeHex, strokeWidth, instanceKey, hexFocused]);

  const applyStrokeHex = (hex: string, opts?: { skipHistory?: boolean }) => {
    if (hex === lastAppliedHexRef.current) return;
    onStyle({ strokeColor: hex });
    lastAppliedHexRef.current = hex;
    if (opts?.skipHistory) dirtyHexLiveRef.current = true;
  };

  const handleHexChange = (raw: string) => {
    const cleaned = raw.replace(/#/g, "").replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexDraft(cleaned.toUpperCase());
    const n = parseHexInputLive(cleaned);
    if (n) applyStrokeHex(n, { skipHistory: true });
  };

  const finishHexEdit = () => {
    setHexFocused(false);
    const n = parseHexInputLive(hexDraft) ?? normalizeHex(`#${hexDraft}`);
    if (n) {
      applyStrokeHex(n, { skipHistory: true });
      setHexDraft(n.replace("#", "").toUpperCase());
    } else {
      setHexDraft(safeHex.replace("#", "").toUpperCase());
      lastAppliedHexRef.current = safeHex;
    }
    if (dirtyHexLiveRef.current) {
      useEditorStore.getState().pushHistory();
      dirtyHexLiveRef.current = false;
    }
  };

  const disabled = locked || !strokeEnabled;
  const style = resolveStrokeStyle({ strokeStyle });

  const parseWeightDraft = () => {
    const n = parseFloat(weightDraft);
    return Number.isFinite(n) ? n : strokeWidth || 1;
  };

  const commitWeight = (n: number) => {
    const next = Math.min(256, Math.max(0, n));
    onStyle({ strokeWidth: next });
    setWeightDraft(String(next));
  };

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
          strokeWidthProfile={strokeWidthProfile}
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
          <InspectorSegmented
            options={[
              { value: "solid" as const, label: "Solid" },
              { value: "gradient" as const, label: "Gradient" },
            ]}
            value={resolvedStrokeType}
            disabled={disabled}
            onChange={(t) => {
              if (t === "gradient") {
                onStyle({
                  strokeType: "gradient",
                  strokeGradient: normalizedStrokeGradient,
                });
              } else {
                onStyle({ strokeType: "solid" });
              }
            }}
          />

          {resolvedStrokeType === "solid" ? (
          <div className="flex items-center gap-1">
            <input
              type="color"
              value={(hexFocused ? parseHexInputLive(hexDraft) : null) ?? safeHex}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value.toLowerCase();
                applyStrokeHex(v);
                setHexDraft(v.replace("#", "").toUpperCase());
              }}
              className="h-6 w-6 shrink-0 cursor-pointer rounded border border-app-border bg-transparent p-0 disabled:opacity-40"
              aria-label="Stroke color"
            />
            <input
              type="text"
              disabled={disabled}
              spellCheck={false}
              autoComplete="off"
              maxLength={6}
              title="6-digit hex — stroke updates when complete"
              className={cn(field, "min-w-0 flex-1 font-mono uppercase")}
              value={hexDraft}
              onFocus={() => setHexFocused(true)}
              onChange={(e) => handleHexChange(e.target.value)}
              onBlur={finishHexEdit}
              onKeyDown={(e) => {
                handlePanelFieldKeyDown(e, {
                  onEnter: () => {
                    finishHexEdit();
                    e.currentTarget.blur();
                  },
                  onEscape: () => {
                    dirtyHexLiveRef.current = false;
                    setHexDraft(safeHex.replace("#", "").toUpperCase());
                    lastAppliedHexRef.current = safeHex;
                    setHexFocused(false);
                    e.currentTarget.blur();
                  },
                });
              }}
            />
          </div>
          ) : (
            <div
              className="h-6 w-full shrink-0 rounded border border-app-border"
              style={{
                background: strokePaintCss({
                  strokeType: "gradient",
                  strokeGradient: normalizedStrokeGradient,
                  strokeColor: safeHex,
                  strokeEnabled,
                  strokeOpacity,
                }),
              }}
              aria-hidden
            />
          )}

          <div className="flex items-center justify-end gap-1">
            <OpacityPercentInput
              value={strokeOpacity}
              disabled={disabled}
              instanceKey={`${instanceKey}-stroke-op`}
              className={cn(field, "w-12 shrink-0 flex-none")}
              onCommit={(op) => onStyle({ strokeOpacity: op })}
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

          {resolvedStrokeType === "gradient" && onApplyStrokeGradient ? (
            <GradientFillControls
              gradient={normalizedStrokeGradient}
              fallbackFill={strokeColor}
              fillEnabled={strokeEnabled}
              fillOpacity={strokeOpacity}
              paintMode="stroke"
              locked={locked}
              instanceKey={`${instanceKey}-stroke-grad`}
              onChange={onApplyStrokeGradient}
            />
          ) : null}

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
                  strokeWidth={strokeWidth}
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
                    if (Number.isFinite(n)) commitWeight(n);
                    else setWeightDraft(String(strokeWidth));
                  }}
                  onKeyDown={(e) => {
                    handlePanelFieldKeyDown(e, {
                      onEnter: () => e.currentTarget.blur(),
                      onArrowNudge: (dir, shift, alt) => {
                        const step = keyboardNudgeStep(1, 0, shift, alt) * dir;
                        commitWeight(parseWeightDraft() + step);
                      },
                    });
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
