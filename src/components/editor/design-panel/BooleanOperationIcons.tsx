"use client";

import type { ReactNode } from "react";
import { inspectorInlineSvgClass } from "@/lib/inspectorIconStyles";
import type { BooleanOperation } from "@/lib/booleanGeometry";
import { cn } from "@/lib/utils";

/** Penpot / Figma inspector stroke at 16px. */
const STROKE = 1.5;

/** Shared offset squares used across boolean glyphs (Figma geometry). */
const SQ_BACK = { x: 2, y: 6, w: 6.5, h: 6.5, rx: 1.25 };
const SQ_FRONT = { x: 6.5, y: 3.5, w: 6.5, h: 6.5, rx: 1.25 };
const SQ_OVERLAP = { x: 6.5, y: 6, w: 2, h: 6.5, rx: 0.35 };

function BooleanIconSvg({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={inspectorInlineSvgClass(className)}
      fill="none"
      shapeRendering="geometricPrecision"
    >
      {children}
    </svg>
  );
}

function stroke(strokeWidth = STROKE) {
  return {
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

function OverlapSquares({
  backOpacity = 1,
  frontOpacity = 1,
}: {
  backOpacity?: number;
  frontOpacity?: number;
}) {
  const { x: bx, y: by, w: bw, h: bh, rx: brx } = SQ_BACK;
  const { x: fx, y: fy, w: fw, h: fh, rx: frx } = SQ_FRONT;
  return (
    <>
      <rect
        x={bx}
        y={by}
        width={bw}
        height={bh}
        rx={brx}
        opacity={backOpacity}
        {...stroke()}
      />
      <rect
        x={fx}
        y={fy}
        width={fw}
        height={fh}
        rx={frx}
        opacity={frontOpacity}
        {...stroke()}
      />
    </>
  );
}

/**
 * Menu trigger — Figma “two overlapping squares” (outline, not filled).
 * Matches the boolean operations control in Figma UI3.
 */
export function BooleanMenuIcon({ className }: { className?: string } = {}) {
  return (
    <BooleanIconSvg className={className}>
      <OverlapSquares />
    </BooleanIconSvg>
  );
}

/** Union — same dual-square outline as the menu trigger. */
export function BooleanUnionIcon({ className }: { className?: string } = {}) {
  return <BooleanMenuIcon className={className} />;
}

/** Subtract — square with circle cutter on top (Figma subtract). */
export function BooleanSubtractIcon({ className }: { className?: string } = {}) {
  return (
    <BooleanIconSvg className={className}>
      <rect x="2.25" y="5.75" width="7" height="7" rx="1.25" {...stroke()} />
      <circle cx="11" cy="6.25" r="3" {...stroke()} />
    </BooleanIconSvg>
  );
}

/** Intersect — overlap region filled, parent squares faded (Figma intersect). */
export function BooleanIntersectIcon({ className }: { className?: string } = {}) {
  const { x, y, w, h, rx } = SQ_OVERLAP;
  return (
    <BooleanIconSvg className={className}>
      <OverlapSquares backOpacity={0.38} frontOpacity={0.38} />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill="currentColor" stroke="none" />
    </BooleanIconSvg>
  );
}

/** Exclude — overlap punched out with X (Figma exclude / XOR). */
export function BooleanExcludeIcon({ className }: { className?: string } = {}) {
  return (
    <BooleanIconSvg className={className}>
      <OverlapSquares />
      <path d="M6.65 6.65 8.85 8.85M8.85 6.65 6.65 8.85" {...stroke(1.85)} />
    </BooleanIconSvg>
  );
}

/** Flatten — square + circle merging to one path. */
export function BooleanFlattenIcon({ className }: { className?: string } = {}) {
  return (
    <BooleanIconSvg className={className}>
      <rect x="2.25" y="2.75" width="5.25" height="5.25" rx="1" {...stroke()} />
      <circle cx="11.35" cy="11" r="2.65" {...stroke()} />
      <path d="M7.35 8.1 9.85 10.35" {...stroke()} />
      <path d="M9.1 10.35h1.5v1.5" {...stroke()} />
    </BooleanIconSvg>
  );
}

/** Edit object — bezier path with anchor nodes (Penpot `path.svg`). */
export function EditObjectIcon({ className }: { className?: string } = {}) {
  return (
    <BooleanIconSvg className={className}>
      <path
        d="M14 1.333c.736 0 1.334.598 1.334 1.334s-.598 1.333-1.334 1.333-1.333-.597-1.333-1.333.597-1.334 1.333-1.334ZM3.333 13.333c6.667 0 2.667-10.666 9.333-10.666M3.333 13.333a1.333 1.333 0 1 0 0-2.666 1.333 1.333 0 0 0 0 2.666Z"
        {...stroke()}
      />
    </BooleanIconSvg>
  );
}

/** Use as mask — triangle mask (Penpot `mask.svg`). */
export function UseAsMaskIcon({ className }: { className?: string } = {}) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={inspectorInlineSvgClass(className)}
      fill="currentColor"
      shapeRendering="geometricPrecision"
    >
      <path d="M1.773 2.792c-.197-.355.06-.792.466-.792h11.521c.407 0 .664.437.466.792l-5.764 10.369c-.203.366-.729.365-.932 0z" />
    </svg>
  );
}

export function BooleanOperationIcon({
  op,
  className,
}: {
  op: BooleanOperation;
  className?: string;
}) {
  switch (op) {
    case "union":
      return <BooleanUnionIcon className={className} />;
    case "subtract":
      return <BooleanSubtractIcon className={className} />;
    case "intersect":
      return <BooleanIntersectIcon className={className} />;
    case "exclude":
      return <BooleanExcludeIcon className={className} />;
    default:
      return <BooleanMenuIcon className={className} />;
  }
}

export function BooleanOperationIconSlot({
  op,
  className,
}: {
  op: BooleanOperation;
  className?: string;
}) {
  return (
    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center text-app-fg", className)}>
      <BooleanOperationIcon op={op} />
    </span>
  );
}

export function BooleanMenuIconSlot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center text-app-fg", className)}>
      {children}
    </span>
  );
}
