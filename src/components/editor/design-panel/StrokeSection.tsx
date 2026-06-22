"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SlidersHorizontal } from "lucide-react";
import { PropertiesSection } from "../PropertiesSection";
import { ColorInput } from "../ColorInput";
import {
  inspectorIconClass,
  inspectorIconStroke,
  inspectorFieldIconSlotClass,
} from "@/lib/inspectorIconStyles";
import { cn } from "@/lib/utils";
import { InspectorSectionAddButton, InspectorSegmented } from "./InspectorPrimitives";
import { handlePanelFieldKeyDown, keyboardNudgeStep } from "@/lib/panelFieldKeyboard";
import { useInspectorValueScrub } from "@/lib/useInspectorValueScrub";
import {
  adjacentPanelDialogStyle,
  useAdjacentPanelDialogPosition,
} from "../useAdjacentPanelDialogPosition";
import { useDismissAnchoredDropdown } from "../useAnchoredDropdown";
import { StrokeAdvancedPanel } from "./StrokeAdvancedPanel";
import { StrokeEndpointPicker } from "./StrokeEndpointPicker";
import type { StrokeEndpoint } from "@/lib/strokeEndpoints";
import {
  appFieldClass,
  appFieldInnerClass,
  appFieldShellClass,
  inspectorRowGapClass,
} from "@/lib/appFieldStyles";
import {
  resolveStrokeStyle,
  type StrokeLinecap,
  type StrokeLinejoin,
  type StrokeStyleKind,
} from "@/lib/stroke";
import type { StrokeSidesCustom, StrokeSidesCustomColors, StrokeSidesMode } from "@/lib/strokeAlign";
import {
  resolveStrokeSideWidths,
  resolveStrokeSides,
  strokeSideColorsAreMixed,
  strokeSideWeightsAreMixed,
} from "@/lib/strokeAlign";
import { StrokeSidesPicker } from "./StrokeSidesPicker";
import { DimensionFieldsIconButton } from "./DimensionFieldsIconButton";
import type { StrokePosition } from "@/stores/useEditorStore";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  defaultFillGradient,
  effectiveStrokeType,
  normalizeFillGradient,
} from "@/lib/fillGradient";
import type { FillType } from "@/lib/gradient/types";
import {
  FILL_TYPE_OPTIONS,
  GradientFillInspectorRow,
  MediaFillInspectorRow,
} from "./FillSection";
import { GradientFillEditorDialog } from "../gradient/GradientFillEditorDialog";

const field = appFieldClass;

export type StrokeStylePatch = {
  strokeWidth?: number;
  strokeColor?: string;
  strokeType?: FillType;
  strokeGradient?: import("@/lib/fillGradient").FillGradient;
  strokeImageAssetId?: string;
  strokeVideoAssetId?: string;
  strokeOpacity?: number;
  strokeEnabled?: boolean;
  strokeStyle?: StrokeStyleKind;
  strokePosition?: StrokePosition;
  strokeSides?: StrokeSidesMode;
  strokeSidesCustom?: StrokeSidesCustom;
  strokeSidesCustomColors?: StrokeSidesCustomColors;
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

function mediaStrokeAssetField(
  kind: "image" | "video",
  assetId: string,
): StrokeStylePatch {
  if (kind === "video") {
    return { strokeType: "video", strokeVideoAssetId: assetId, strokeEnabled: true };
  }
  return { strokeType: "image", strokeImageAssetId: assetId, strokeEnabled: true };
}

const POSITION_OPTIONS: { value: StrokePosition; label: string }[] = [
  { value: "inside", label: "Inside" },
  { value: "center", label: "Center" },
  { value: "outside", label: "Outside" },
];

export function StrokeSection({
  nodeId,
  instanceKey,
  locked,
  strokeWidth,
  strokeColor,
  strokeType,
  strokeGradient,
  strokeImageAssetId,
  strokeVideoAssetId,
  strokeOpacity = 1,
  strokeEnabled = true,
  strokeStyle,
  strokePosition,
  strokeSides = "all",
  strokeSidesCustom,
  strokeSidesCustomColors,
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
}: {
  nodeId: string;
  instanceKey: string;
  locked: boolean;
  strokeWidth: number;
  strokeColor: string;
  strokeType?: FillType;
  strokeGradient?: import("@/lib/fillGradient").FillGradient;
  strokeImageAssetId?: string;
  strokeVideoAssetId?: string;
  strokeOpacity?: number;
  strokeEnabled?: boolean;
  strokeStyle: StrokeStyleKind;
  strokePosition: StrokePosition;
  strokeSides?: StrokeSidesMode;
  strokeSidesCustom?: StrokeSidesCustom;
  strokeSidesCustomColors?: StrokeSidesCustomColors;
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
  onStyle: (patch: StrokeStylePatch, opts?: { skipHistory?: boolean }) => void;
}) {
  const [strokeEditorActive, setStrokeEditorActive] = useState(strokeWidth > 0);
  const [weightDraft, setWeightDraft] = useState(() => String(strokeWidth ?? 0));
  const [weightFocused, setWeightFocused] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [gradientEditorOpen, setGradientEditorOpen] = useState(false);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const advancedRef = useRef<HTMLButtonElement>(null);
  const advancedMenuRef = useRef<HTMLDivElement>(null);
  const gradientAnchorRef = useRef<HTMLButtonElement>(null);
  const mediaAnchorRef = useRef<HTMLButtonElement>(null);
  const advancedPos = useAdjacentPanelDialogPosition(advancedRef, advancedOpen, {
    width: 228,
    maxHeight: 360,
  });
  useDismissAnchoredDropdown(advancedOpen, () => setAdvancedOpen(false), advancedRef, advancedMenuRef);

  const assets = useEditorStore((s) => s.assets);
  const strokeKind = effectiveStrokeType({
    strokeType,
    strokeGradient,
    strokeImageAssetId,
    strokeVideoAssetId,
  });
  const strokeTypeUi: FillType = strokeKind;
  const mediaStrokeKind: "image" | "video" = strokeKind === "video" ? "video" : "image";
  const mediaStrokeAssetId =
    strokeKind === "video" ? strokeVideoAssetId : strokeImageAssetId;
  const gradient = normalizeFillGradient(strokeGradient, strokeColor || "#000000");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setStrokeEditorActive(strokeWidth > 0);
    setGradientEditorOpen(false);
    setMediaPickerOpen(false);
  }, [instanceKey]);

  useEffect(() => {
    if (strokeWidth > 0) setStrokeEditorActive(true);
  }, [strokeWidth]);

  useEffect(() => {
    if (strokeKind !== "gradient") setGradientEditorOpen(false);
  }, [strokeKind]);

  useEffect(() => {
    if (strokeKind === "solid" || strokeKind === "gradient") setMediaPickerOpen(false);
  }, [strokeKind, instanceKey]);

  const hasStroke = strokeEditorActive;

  const weightsMixed = strokeSideWeightsAreMixed({
    strokeWidth,
    strokeSides,
    strokeSidesCustom,
  });

  const colorsMixed = strokeSideColorsAreMixed({
    strokeWidth,
    strokeSides,
    strokeSidesCustom,
    strokeColor,
    strokeSidesCustomColors,
  });

  const commitStrokeColor = (hex: string, opts?: { skipHistory?: boolean }) => {
    const patch: StrokeStylePatch = { strokeColor: hex, strokeType: "solid" };
    if (strokeSides === "custom") {
      const sides = resolveStrokeSides({
        strokeWidth,
        strokeSides,
        strokeSidesCustom,
      });
      const widths = resolveStrokeSideWidths({
        strokeWidth,
        strokeSides,
        strokeSidesCustom,
      });
      const customColors: StrokeSidesCustomColors = { ...(strokeSidesCustomColors ?? {}) };
      for (const side of ["top", "right", "bottom", "left"] as const) {
        if (sides[side] && widths[side] > 0) customColors[side] = hex;
      }
      patch.strokeSidesCustomColors = customColors;
    }
    onStyle(patch, opts);
  };

  const disabled = locked || !strokeEnabled;
  const style = resolveStrokeStyle({ strokeStyle });

  const parseWeightDraft = () => {
    const n = parseFloat(weightDraft);
    return Number.isFinite(n) ? n : (strokeWidth ?? 0);
  };

  const commitWeight = (n: number) => {
    const next = Math.min(256, Math.max(0, n));
    const patch: StrokeStylePatch = { strokeWidth: next };
    if (strokeSides === "custom") {
      const sides = resolveStrokeSides({
        strokeWidth: next,
        strokeSides,
        strokeSidesCustom,
      });
      const widths = resolveStrokeSideWidths({
        strokeWidth: next,
        strokeSides,
        strokeSidesCustom,
      });
      const custom: StrokeSidesCustom = { ...(strokeSidesCustom ?? {}) };
      for (const side of ["top", "right", "bottom", "left"] as const) {
        if (sides[side] && widths[side] > 0) custom[side] = next;
      }
      patch.strokeSidesCustom = custom;
    }
    onStyle(patch);
    setWeightDraft(String(next));
  };

  const weightScrub = useInspectorValueScrub({
    disabled,
    value: strokeWidth ?? 0,
    min: 0,
    max: 256,
    onChange: commitWeight,
  });
  const { scrubbing: weightScrubbing, scrubActiveRef: weightScrubActiveRef, bindScrubInput: bindWeightScrub } = weightScrub;

  const showMixedWeight =
    weightsMixed && !weightFocused && !weightScrubbing && !weightScrubActiveRef.current;

  useEffect(() => {
    if (!weightFocused && !weightScrubbing && !weightScrubActiveRef.current && !weightsMixed) {
      setWeightDraft(String(strokeWidth ?? 0));
    }
  }, [strokeWidth, instanceKey, weightFocused, weightScrubbing, weightScrubActiveRef, weightsMixed, strokeSides, strokeSidesCustom]);

  const firstImageAsset = Object.values(assets).find((a) =>
    a.mimeType.toLowerCase().startsWith("image/"),
  );
  const firstVideoAsset = Object.values(assets).find((a) =>
    a.mimeType.toLowerCase().startsWith("video/"),
  );

  const setSolid = () => {
    onStyle({
      strokeType: "solid",
      strokeColor: strokeColor || "#000000",
      strokeGradient: undefined,
      strokeEnabled: true,
    });
  };

  const setGradient = () => {
    const g = normalizeFillGradient(strokeGradient, strokeColor || "#000000");
    onStyle({
      strokeType: "gradient",
      strokeGradient: g.stops.length >= 2 ? g : defaultFillGradient(strokeColor || "#000000"),
      strokeEnabled: true,
    });
    setGradientEditorOpen(true);
  };

  const setImageStroke = () => {
    const assetId = strokeImageAssetId ?? firstImageAsset?.id;
    onStyle({
      strokeType: "image",
      strokeImageAssetId: assetId,
      strokeEnabled: true,
    });
    if (!assetId) setMediaPickerOpen(true);
  };

  const setVideoStroke = () => {
    const assetId = strokeVideoAssetId ?? firstVideoAsset?.id;
    onStyle({
      strokeType: "video",
      strokeVideoAssetId: assetId,
      strokeEnabled: true,
    });
    if (!assetId) setMediaPickerOpen(true);
  };

  const onStrokeTypeChange = (v: FillType) => {
    if (v === "solid") setSolid();
    else if (v === "gradient") setGradient();
    else if (v === "image") setImageStroke();
    else if (v === "video") setVideoStroke();
  };

  const gradientKindLabel =
    gradient.kind.charAt(0).toUpperCase() + gradient.kind.slice(1);

  const addStroke = () => {
    setStrokeEditorActive(true);
    setWeightDraft("0");
    onStyle({
      strokeWidth: 0,
      strokeColor: strokeColor || "#000000",
      strokeType: strokeType ?? "solid",
      strokeStyle: strokeStyle || "solid",
      strokeEnabled: true,
      strokeOpacity: strokeOpacity ?? 1,
    });
  };

  const removeStroke = () => {
    setStrokeEditorActive(false);
    onStyle({ strokeWidth: 0, strokeEnabled: false });
  };

  const advancedMenu =
    advancedOpen && mounted && hasStroke ? (
      <div
        ref={advancedMenuRef}
        role="dialog"
        aria-label="Stroke settings"
        aria-modal="false"
        data-editor-shell
        className="editor-inspector-dialog fixed z-[120] overflow-y-auto overscroll-contain"
        style={adjacentPanelDialogStyle(advancedPos)}
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
    <PropertiesSection
      title="Stroke"
      headerActions={
        !hasStroke ? (
          <InspectorSectionAddButton
            title="Add stroke"
            disabled={locked}
            onClick={addStroke}
          />
        ) : null
      }
    >
      {hasStroke ? (
        <>
          <InspectorSegmented
            options={FILL_TYPE_OPTIONS}
            value={strokeTypeUi}
            disabled={locked}
            scrollable
            onChange={onStrokeTypeChange}
          />

          <div className="mt-2">
            {strokeKind === "solid" ? (
              <ColorInput
                variant="inspectorRow"
                hex={strokeColor}
                opacity={strokeOpacity}
                visible={strokeEnabled}
                pickerTitle="Stroke color"
                instanceKey={`${instanceKey}-stroke-color`}
                disabled={locked}
                hexMixed={colorsMixed}
                removeLabel="Remove stroke"
                onToggleVisible={() => onStyle({ strokeEnabled: !strokeEnabled })}
                onRemove={removeStroke}
                onCommitHex={commitStrokeColor}
                onCommitOpacity={(op) => onStyle({ strokeOpacity: op })}
              />
            ) : strokeKind === "gradient" ? (
              <>
                <GradientFillInspectorRow
                  gradient={gradient}
                  fillOpacity={strokeOpacity}
                  kindLabel={gradientKindLabel}
                  visible={strokeEnabled}
                  disabled={locked}
                  locked={locked}
                  editorOpen={gradientEditorOpen}
                  instanceKey={instanceKey}
                  anchorRef={gradientAnchorRef}
                  onOpenEditor={() => setGradientEditorOpen((open) => !open)}
                  onToggleVisible={() => onStyle({ strokeEnabled: !strokeEnabled })}
                  onRemove={removeStroke}
                  onCommitOpacity={(op) => onStyle({ strokeOpacity: op })}
                />
                <GradientFillEditorDialog
                  open={gradientEditorOpen}
                  onClose={() => setGradientEditorOpen(false)}
                  anchorRef={gradientAnchorRef}
                  nodeId={nodeId}
                  gradient={gradient}
                  fillOpacity={strokeOpacity}
                  disabled={locked || !strokeEnabled}
                  remeasureKey={instanceKey}
                  onChange={(g, opts) => {
                    onStyle(
                      {
                        strokeType: "gradient",
                        strokeGradient: g,
                        strokeEnabled: true,
                      },
                      opts,
                    );
                  }}
                />
              </>
            ) : (
              <MediaFillInspectorRow
                kind={mediaStrokeKind}
                assetId={mediaStrokeAssetId}
                assets={assets}
                fillOpacity={strokeOpacity}
                visible={strokeEnabled}
                locked={locked}
                instanceKey={instanceKey}
                pickerOpen={mediaPickerOpen}
                anchorRef={mediaAnchorRef}
                onTogglePicker={() => setMediaPickerOpen((o) => !o)}
                onClosePicker={() => setMediaPickerOpen(false)}
                onToggleVisible={() => onStyle({ strokeEnabled: !strokeEnabled })}
                onRemove={removeStroke}
                onCommitOpacity={(op) => onStyle({ strokeOpacity: op })}
                onSelectAsset={(assetId) => {
                  onStyle(mediaStrokeAssetField(mediaStrokeKind, assetId));
                  setMediaPickerOpen(false);
                }}
                previewNode={{
                  fillType: mediaStrokeKind,
                  fillImageAssetId: mediaStrokeKind === "image" ? mediaStrokeAssetId : undefined,
                  fillVideoAssetId: mediaStrokeKind === "video" ? mediaStrokeAssetId : undefined,
                  fillOpacity: strokeOpacity,
                  fillEnabled: true,
                }}
              />
            )}
          </div>

          {/* Position + sides + weight + advanced */}
          <div className={cn("flex items-end", inspectorRowGapClass)}>
            <div className="min-w-0 flex-1">
              <div className="inspector-field-label">Position</div>
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
                <div className="inspector-field-label">Sides</div>
                <StrokeSidesPicker
                  disabled={disabled}
                  strokeSides={strokeSides}
                  strokeSidesCustom={strokeSidesCustom}
                  strokeSidesCustomColors={strokeSidesCustomColors}
                  strokeColor={strokeColor}
                  strokeOpacity={strokeOpacity}
                  strokeWidth={strokeWidth}
                  instanceKey={instanceKey}
                  onChange={onStyle}
                />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              <div className="inspector-field-label">Weight</div>
              <div
                className={cn(
                  appFieldShellClass,
                  "focus-within:border-accent focus-within:ring-1 focus-within:ring-accent",
                )}
              >
                <span className={inspectorFieldIconSlotClass}>
                  <svg width="14" height="10" viewBox="0 0 12 8" aria-hidden className="inspector-icon" shapeRendering="geometricPrecision">
                    <line x1={1} y1={4} x2={11} y2={4} stroke="currentColor" strokeWidth={2} />
                  </svg>
                </span>
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={disabled}
                  aria-label="Stroke weight"
                  {...bindWeightScrub(
                    cn(appFieldInnerClass, "tabular-nums", showMixedWeight && "text-app-muted"),
                    weightFocused,
                  )}
                  value={showMixedWeight ? "Mixed" : weightDraft}
                  onFocus={() => {
                    setWeightFocused(true);
                    if (weightsMixed) setWeightDraft(String(strokeWidth ?? 0));
                  }}
                  onChange={(e) => setWeightDraft(e.target.value)}
                  onBlur={() => {
                    if (weightScrubActiveRef.current) return;
                    setWeightFocused(false);
                    if (showMixedWeight) return;
                    const trimmed = weightDraft.trim();
                    if (trimmed === "") {
                      commitWeight(0);
                      return;
                    }
                    const n = parseFloat(trimmed);
                    if (Number.isFinite(n)) commitWeight(n);
                    else setWeightDraft(String(strokeWidth ?? 0));
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
            <DimensionFieldsIconButton
              buttonRef={advancedRef}
              title="Stroke settings"
              ariaLabel="Stroke settings"
              pressed={advancedOpen}
              active={advancedOpen}
              disabled={disabled}
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              <SlidersHorizontal className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
            </DimensionFieldsIconButton>
          </div>

          {showEndpoints ? (
            <div className={cn("flex", inspectorRowGapClass)}>
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
        </>
      ) : null}
      {mounted && advancedMenu ? createPortal(advancedMenu, document.body) : null}
    </PropertiesSection>
  );
}
