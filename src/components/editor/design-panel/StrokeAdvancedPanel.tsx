"use client";

import { FlipHorizontal2 } from "lucide-react";
import { PropertyNumberInput } from "../PropertyInput";
import { InspectorLabelRow } from "./InspectorPrimitives";
import {
  StrokeLinecapControl,
  StrokeLinejoinControl,
  StrokeWidthProfilePreview,
} from "./StrokeSettingIcons";
import { cn } from "@/lib/utils";
import {
  defaultDashGapForStyle,
  resolveStrokeDashGap,
  resolveStrokeDashLength,
  resolveStrokeLinecap,
  resolveStrokeLinejoin,
  resolveStrokeMiterAngle,
  resolveStrokeStyle,
  type StrokeLinecap,
  type StrokeLinejoin,
  type StrokeStyleKind,
} from "@/lib/stroke";
import type { StrokeStylePatch } from "./StrokeSection";

const field =
  "h-6 min-h-[24px] w-full rounded border border-app-border bg-app-field px-1.5 text-[12px] text-app-field-fg focus-visible:border-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent disabled:opacity-40";

export function StrokeAdvancedPanel({
  instanceKey,
  locked,
  strokeWidth,
  strokeStyle,
  strokeDashLength,
  strokeDashGap,
  strokeLinecap,
  strokeLinejoin,
  strokeMiterAngle,
  strokeWidthProfileFlipped,
  onStyle,
}: {
  instanceKey: string;
  locked: boolean;
  strokeWidth: number;
  strokeStyle: StrokeStyleKind;
  strokeDashLength?: number;
  strokeDashGap?: number;
  strokeLinecap?: StrokeLinecap;
  strokeLinejoin?: StrokeLinejoin;
  strokeMiterAngle?: number;
  strokeWidthProfileFlipped?: boolean;
  onStyle: (patch: StrokeStylePatch) => void;
}) {
  const style = resolveStrokeStyle({ strokeStyle });
  const dashedLike = style !== "solid";
  const dash = resolveStrokeDashLength({
    strokeStyle: style,
    strokeWidth,
    strokeDashLength,
  });
  const gap = resolveStrokeDashGap({
    strokeStyle: style,
    strokeWidth,
    strokeDashGap,
  });
  const cap = resolveStrokeLinecap({ strokeStyle: style, strokeLinecap });
  const join = resolveStrokeLinejoin({ strokeLinejoin });
  const miterAngle = resolveStrokeMiterAngle({ strokeMiterAngle });

  const setStyle = (next: StrokeStyleKind) => {
    if (next === style) return;
    const patch: StrokeStylePatch = { strokeStyle: next };
    if (next !== "solid") {
      const { dash: d, gap: g } = defaultDashGapForStyle(next, strokeWidth);
      patch.strokeDashLength = strokeDashLength ?? d;
      patch.strokeDashGap = strokeDashGap ?? g;
      if (!strokeLinecap) patch.strokeLinecap = next === "dotted" ? "round" : "butt";
    }
    onStyle(patch);
  };

  return (
    <div className="w-[220px] space-y-2 p-2">
      <p className="text-[11px] font-semibold text-app-fg">Stroke settings</p>
      <InspectorLabelRow label="Style">
        <select
          disabled={locked}
          className={field}
          value={style}
          onChange={(e) => setStyle(e.target.value as StrokeStyleKind)}
        >
          <option value="solid">Solid</option>
          <option value="dashed">Dashed</option>
          <option value="dotted">Dotted</option>
        </select>
      </InspectorLabelRow>
      {dashedLike ? (
        <>
          <div className="grid grid-cols-2 gap-1">
            <PropertyNumberInput
              commitOnInput
              label="Dash"
              value={dash}
              instanceKey={`${instanceKey}-sd`}
              disabled={locked}
              min={0}
              max={256}
              decimals={1}
              onCommit={(v) => onStyle({ strokeDashLength: Math.max(0, v) })}
            />
            <PropertyNumberInput
              commitOnInput
              label="Gap"
              value={gap}
              instanceKey={`${instanceKey}-sg`}
              disabled={locked}
              min={0}
              max={256}
              decimals={1}
              onCommit={(v) => onStyle({ strokeDashGap: Math.max(0, v) })}
            />
          </div>
          <div>
            <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Dash cap</div>
            <StrokeLinecapControl
              value={cap}
              disabled={locked}
              onChange={(v) => onStyle({ strokeLinecap: v })}
            />
          </div>
        </>
      ) : null}
      <div>
        <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Width profile</div>
        <div className="flex items-center gap-1">
          <div className="flex h-6 min-w-0 flex-1 items-center gap-2 rounded border border-app-border bg-app-field px-2">
            <StrokeWidthProfilePreview flipped={strokeWidthProfileFlipped} />
            <span className="text-[11px] text-app-muted">Uniform</span>
          </div>
          <button
            type="button"
            disabled={locked}
            title="Flip width profile"
            onClick={() => onStyle({ strokeWidthProfileFlipped: !strokeWidthProfileFlipped })}
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded border border-app-border bg-app-panel text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40",
              strokeWidthProfileFlipped && "border-accent/40 bg-accent/10 text-accent",
            )}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
      <div>
        <div className="mb-0.5 text-[11px] font-medium text-app-subtle">Join</div>
        <StrokeLinejoinControl
          value={join}
          disabled={locked}
          onChange={(v) => onStyle({ strokeLinejoin: v })}
        />
      </div>
      {join === "miter" ? (
        <PropertyNumberInput
          commitOnInput
          label="Miter angle °"
          value={miterAngle}
          instanceKey={`${instanceKey}-sma`}
          disabled={locked}
          min={1}
          max={180}
          decimals={2}
          onCommit={(v) => onStyle({ strokeMiterAngle: Math.min(180, Math.max(1, v)) })}
        />
      ) : null}
    </div>
  );
}
