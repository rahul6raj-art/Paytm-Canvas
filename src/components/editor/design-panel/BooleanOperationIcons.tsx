"use client";

import type { ReactNode } from "react";
import { inspectorInlineSvgClass } from "@/lib/inspectorIconStyles";
import type { BooleanOperation } from "@/lib/booleanGeometry";
import { cn } from "@/lib/utils";

/** Match Penpot / Figma inspector stroke weight at 16px. */
const STROKE = 1.5;

/**
 * Boolean / vector menu glyphs — Figma-style overlapping shapes (stroke + selective fill).
 * Penpot source icons use hairline grid strokes that collapse when filled; these are
 * simplified for legibility at 16px in dropdown menus.
 */
function OpSvgStroke({ children, className }: { children: ReactNode; className?: string }) {
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

function strokeProps() {
  return {
    stroke: "currentColor",
    strokeWidth: STROKE,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
}

/** Union — two overlapping rounded squares merged (outline). */
export function BooleanUnionIcon({ className }: { className?: string } = {}) {
  return (
    <OpSvgStroke className={className}>
      <rect x="2" y="5.5" width="6" height="6.5" rx="1" {...strokeProps()} />
      <rect x="6.5" y="4" width="6.5" height="7" rx="1" {...strokeProps()} />
    </OpSvgStroke>
  );
}

/** Subtract — front circle cuts from back square (Figma subtract). */
export function BooleanSubtractIcon({ className }: { className?: string } = {}) {
  return (
    <OpSvgStroke className={className}>
      <rect x="2.5" y="4.5" width="6.5" height="7" rx="0.75" {...strokeProps()} />
      <circle cx="10.75" cy="8" r="2.75" {...strokeProps()} />
    </OpSvgStroke>
  );
}

/** Intersect — overlap of two rounded squares filled. */
export function BooleanIntersectIcon({ className }: { className?: string } = {}) {
  return (
    <OpSvgStroke className={className}>
      <rect x="2" y="5" width="7" height="7" rx="0.75" {...strokeProps()} />
      <rect x="6" y="4" width="7" height="7" rx="0.75" {...strokeProps()} />
      <rect x="6" y="5" width="3" height="6" rx="0.25" fill="currentColor" stroke="none" />
    </OpSvgStroke>
  );
}

/** Exclude — two squares; overlap marked empty (XOR). */
export function BooleanExcludeIcon({ className }: { className?: string } = {}) {
  return (
    <OpSvgStroke className={className}>
      <rect x="2" y="5" width="7" height="7" rx="0.75" {...strokeProps()} />
      <rect x="6" y="4" width="7" height="7" rx="0.75" {...strokeProps()} />
      <path d="M6.4 6.4 8.6 8.6M8.6 6.4 6.4 8.6" {...strokeProps()} />
    </OpSvgStroke>
  );
}

/** Flatten — square + circle collapsing to single path (merge cue). */
export function BooleanFlattenIcon({ className }: { className?: string } = {}) {
  return (
    <OpSvgStroke className={className}>
      <rect x="2" y="2.5" width="5.5" height="5.5" rx="0.75" {...strokeProps()} />
      <circle cx="11.5" cy="11" r="2.75" {...strokeProps()} />
      <path d="M7.5 8 10.5 10.5" {...strokeProps()} />
      <path d="M9.5 10.5 10.5 10.5 10.5 11.5" {...strokeProps()} />
    </OpSvgStroke>
  );
}

/** Edit object — bezier path with anchor nodes (Penpot `path.svg`). */
export function EditObjectIcon({ className }: { className?: string } = {}) {
  return (
    <OpSvgStroke className={className}>
      <path
        d="M14 1.333c.736 0 1.334.598 1.334 1.334s-.598 1.333-1.334 1.333-1.333-.597-1.333-1.333.597-1.334 1.333-1.334ZM3.333 13.333c6.667 0 2.667-10.666 9.333-10.666M3.333 13.333a1.333 1.333 0 1 0 0-2.666 1.333 1.333 0 0 0 0 2.666Z"
        {...strokeProps()}
      />
    </OpSvgStroke>
  );
}

/** Use as mask — chevron / triangle mask (Penpot `mask.svg`). */
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

/** Toolbar / inspector trigger — union preview. */
export function BooleanMenuIcon({ className }: { className?: string } = {}) {
  return <BooleanUnionIcon className={className} />;
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
    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center text-app-muted", className)}>
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
    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center text-app-muted", className)}>
      {children}
    </span>
  );
}
