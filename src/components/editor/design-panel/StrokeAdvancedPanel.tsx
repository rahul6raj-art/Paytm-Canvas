"use client";

import { FlipHorizontal2 } from "lucide-react";
import { PropertyNumberInput } from "../PropertyInput";
import { InspectorLabelRow, InspectorHintIconButton } from "./InspectorPrimitives";
import {
  StrokeLinecapControl,
  StrokeLinejoinControl,
  StrokeWidthProfilePreview,
} from "./StrokeSettingIcons";
import { appFieldClassCompact, appFieldShellClassCompact, inspectorRowGapClass, inspectorTwoColGridClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";
import { inspectorFieldIconButtonCompactClass, inspectorIconClass, inspectorIconStroke } from "@/lib/inspectorIconStyles";
import {
  defaultDashGapForStyle,
  resolveStrokeDashGap,
  resolveStrokeDashLength,
  resolveStrokeLinecap,
  resolveStrokeLinejoin,
  resolveStrokeMiterAngle,
  resolveStrokeStyle,
  resolveStrokeWidthProfile,
  type StrokeLinecap,
  type StrokeLinejoin,
  type StrokeStyleKind,
  type StrokeWidthProfile,
} from "@/lib/stroke";
import type { StrokeStylePatch } from "./StrokeSection";

const field = appFieldClassCompact;

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
  strokeWidthProfile,
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
  strokeWidthProfile?: StrokeWidthProfile;
  strokeWidthProfileFlipped?: boolean;
  onStyle: (patch: StrokeStylePatch) => void;
}) {
  const widthProfile = resolveStrokeWidthProfile({ strokeWidthProfile });
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
      <p className="text-ui font-semibold text-app-fg">Stroke settings</p>
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
          <div className={inspectorTwoColGridClass}>
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
            <div className="inspector-field-label">Dash cap</div>
            <StrokeLinecapControl
              value={cap}
              disabled={locked}
              onChange={(v) => onStyle({ strokeLinecap: v })}
            />
          </div>
        </>
      ) : null}
      <div>
        <div className="inspector-field-label">Width profile</div>
        <div className={cn("flex items-center", inspectorRowGapClass)}>
          <div className={cn(appFieldShellClassCompact, "min-w-0 flex-1 gap-2 px-2")}>
            <StrokeWidthProfilePreview profile={widthProfile} flipped={strokeWidthProfileFlipped} />
            <span className="text-ui text-app-muted capitalize">{widthProfile}</span>
          </div>
          <InspectorHintIconButton
            title="Flip width profile"
            disabled={locked}
            onClick={() => onStyle({ strokeWidthProfileFlipped: !strokeWidthProfileFlipped })}
            className={cn(
              inspectorFieldIconButtonCompactClass,
              strokeWidthProfileFlipped && "border-accent/40 bg-accent/10 text-accent",
            )}
          >
            <FlipHorizontal2 className={inspectorIconClass} strokeWidth={inspectorIconStroke} />
          </InspectorHintIconButton>
        </div>
      </div>
      <div>
        <div className="inspector-field-label">Join</div>
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
