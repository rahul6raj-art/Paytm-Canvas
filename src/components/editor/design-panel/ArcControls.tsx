"use client";

import { useEffect, useState } from "react";
import {
  effectiveEllipseArc,
  sweepDegToPercent,
  sweepPercentToDeg,
} from "@/lib/shapes/ellipseArc";
import { appFieldClass, appFieldRadius } from "@/lib/appFieldStyles";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";
import { inspectorInlineSvgClass } from "@/lib/inspectorIconStyles";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";

function ArcStartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={inspectorInlineSvgClass(className)}
      shapeRendering="geometricPrecision"
    >
      <path
        d="M8 2.5a5.5 5.5 0 1 1-4.2 9.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M3.8 11.6 L3.2 8.8 M3.8 11.6 L6.4 10.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type ArcSegmentInputProps = {
  value: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  title?: string;
  onChange: (raw: string) => void;
  onCommit: () => void;
  onNudge?: (delta: number, shift: boolean, alt: boolean) => void;
};

function ArcSegmentInput({
  value,
  disabled,
  className,
  inputClassName,
  title,
  onChange,
  onCommit,
  onNudge,
}: ArcSegmentInputProps) {
  return (
    <div className={cn("flex min-w-0 flex-1 items-center", className)}>
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        title={title}
        className={cn(
          appFieldClass,
          "h-full min-h-0 flex-1 border-0 bg-transparent px-1.5 shadow-none ring-0 focus-visible:ring-0",
          "text-ui tabular-nums",
          inputClassName,
        )}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          handlePanelFieldKeyDown(e, {
            onEnter: () => {
              onCommit();
              e.currentTarget.blur();
            },
            onArrowNudge: onNudge,
          });
        }}
      />
    </div>
  );
}

function parseNumber(raw: string): number | null {
  const trimmed = raw.trim().replace(/[°%]/g, "");
  if (trimmed === "" || trimmed === "-" || trimmed === ".") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function ArcControls({
  node,
  instanceKey,
  locked,
  onStyle,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  onStyle: (patch: NodeStylePatch) => void;
}) {
  const arc = effectiveEllipseArc(node);
  const sweepPct = sweepDegToPercent(arc.sweepDeg);
  const ratioPct = arc.innerRadiusRatio * 100;

  const [startText, setStartText] = useState(() => `${Math.round(arc.startDeg)}°`);
  const [sweepText, setSweepText] = useState(() => formatSweepDraft(sweepPct));
  const [ratioText, setRatioText] = useState(() => formatRatioDraft(ratioPct));

  useEffect(() => {
    const next = effectiveEllipseArc(node);
    setStartText(`${Math.round(next.startDeg)}°`);
    setSweepText(formatSweepDraft(sweepDegToPercent(next.sweepDeg)));
    setRatioText(formatRatioDraft(next.innerRadiusRatio * 100));
  }, [
    node.arcStartDeg,
    node.arcSweepDeg,
    node.arcInnerRadiusRatio,
    instanceKey,
  ]);

  const commitStart = () => {
    const n = parseNumber(startText);
    if (n == null) {
      setStartText(`${Math.round(arc.startDeg)}°`);
      return;
    }
    const startDeg = ((Math.round(n) % 360) + 360) % 360;
    onStyle({ arcStartDeg: startDeg });
    setStartText(`${startDeg}°`);
  };

  const commitSweep = () => {
    const n = parseNumber(sweepText);
    if (n == null) {
      setSweepText(formatSweepDraft(sweepPct));
      return;
    }
    const sweepDeg = sweepPercentToDeg(Math.min(100, Math.max(0, n)));
    onStyle({ arcSweepDeg: sweepDeg });
    setSweepText(formatSweepDraft(sweepDegToPercent(sweepDeg)));
  };

  const commitRatio = () => {
    const n = parseNumber(ratioText);
    if (n == null) {
      setRatioText(formatRatioDraft(ratioPct));
      return;
    }
    const ratio = Math.min(99.9, Math.max(0, n)) / 100;
    onStyle({ arcInnerRadiusRatio: Math.min(0.999, ratio) });
    setRatioText(formatRatioDraft(ratio * 100));
  };

  const nudgeStart = (dir: 1 | -1, shift: boolean) => {
    const step = shift ? 15 : 1;
    const startDeg = ((Math.round(arc.startDeg) + dir * step) % 360 + 360) % 360;
    onStyle({ arcStartDeg: startDeg });
    setStartText(`${startDeg}°`);
  };

  const nudgeSweep = (dir: 1 | -1, shift: boolean, alt: boolean) => {
    let step = shift ? 5 : alt ? 0.1 : 1;
    const next = Math.min(100, Math.max(0, sweepPct + dir * step));
    const sweepDeg = sweepPercentToDeg(next);
    onStyle({ arcSweepDeg: sweepDeg });
    setSweepText(formatSweepDraft(sweepDegToPercent(sweepDeg)));
  };

  const nudgeRatio = (dir: 1 | -1, shift: boolean, alt: boolean) => {
    let step = shift ? 5 : alt ? 0.1 : 1;
    const next = Math.min(99, Math.max(0, ratioPct + dir * step));
    onStyle({ arcInnerRadiusRatio: Math.min(0.99, next / 100) });
    setRatioText(formatRatioDraft(next));
  };

  return (
    <div>
      <div className="inspector-field-label">Arc</div>
      <div
        className={cn(
          "flex h-6 divide-x divide-app-border overflow-hidden border border-app-border bg-app-field",
          appFieldRadius,
          locked && "opacity-45",
        )}
      >
        <div className="flex min-w-0 flex-[0.92] items-center gap-1 pl-1">
          <ArcStartIcon />
          <ArcSegmentInput
            value={startText}
            disabled={locked}
            title="Start angle"
            onChange={setStartText}
            onCommit={commitStart}
            onNudge={(d, shift) => nudgeStart(d > 0 ? 1 : -1, shift)}
          />
        </div>
        <ArcSegmentInput
          value={sweepText}
          disabled={locked}
          className="text-right"
          inputClassName="text-right"
          title="Sweep (% of full circle)"
          onChange={setSweepText}
          onCommit={commitSweep}
          onNudge={(d, shift, alt) => nudgeSweep(d > 0 ? 1 : -1, shift, alt)}
        />
        <ArcSegmentInput
          value={ratioText}
          disabled={locked}
          className="text-right"
          inputClassName="text-right"
          title="Inner radius ratio"
          onChange={setRatioText}
          onCommit={commitRatio}
          onNudge={(d, shift, alt) => nudgeRatio(d > 0 ? 1 : -1, shift, alt)}
        />
      </div>
    </div>
  );
}

function formatSweepDraft(percent: number): string {
  if (percent >= 100 - 0.05) return "100%";
  if (percent < 10) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(2)}%`;
}

function formatRatioDraft(percent: number): string {
  if (percent <= 0.001) return "0%";
  if (percent < 10) return `${percent.toFixed(2)}%`;
  return `${percent.toFixed(1)}%`;
}
