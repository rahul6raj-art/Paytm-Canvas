"use client";

import type { ReactNode } from "react";
import { inspectorIconStroke, inspectorInlineSvgClass } from "@/lib/inspectorIconStyles";
import type { BooleanOperation } from "@/lib/booleanGeometry";
import { cn } from "@/lib/utils";

const STROKE = inspectorIconStroke;

function OpSvg({ children, className }: { children: ReactNode; className?: string }) {
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

export function BooleanUnionIcon() {
  return (
    <OpSvg>
      <circle cx="6.25" cy="8" r="3.25" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="9.75" cy="8" r="3.25" stroke="currentColor" strokeWidth={STROKE} />
    </OpSvg>
  );
}

export function BooleanSubtractIcon() {
  return (
    <OpSvg>
      <rect x="3" y="4.5" width="6.5" height="7" rx="0.75" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="10.5" cy="8" r="2.75" stroke="currentColor" strokeWidth={STROKE} />
    </OpSvg>
  );
}

export function BooleanIntersectIcon() {
  return (
    <OpSvg>
      <circle cx="6.25" cy="8" r="3.25" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="9.75" cy="8" r="3.25" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M8 5.25a2.75 2.75 0 0 1 0 5.5a2.75 2.75 0 0 1 0-5.5Z"
        fill="currentColor"
      />
    </OpSvg>
  );
}

export function BooleanExcludeIcon() {
  return (
    <OpSvg>
      <circle cx="6.25" cy="8" r="3.25" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="9.75" cy="8" r="3.25" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M8 5.25a2.75 2.75 0 0 0 0 5.5"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </OpSvg>
  );
}

export function BooleanMenuIcon() {
  return (
    <OpSvg>
      <circle cx="6" cy="8" r="3" stroke="currentColor" strokeWidth={STROKE} />
      <circle cx="10" cy="8" r="3" stroke="currentColor" strokeWidth={STROKE} />
      <path
        d="M8 5.5a2.5 2.5 0 0 1 0 5"
        stroke="currentColor"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />
    </OpSvg>
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
    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center text-app-muted", className)}>
      <BooleanOperationIcon op={op} />
    </span>
  );
}
