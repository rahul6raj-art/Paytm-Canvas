"use client";

import type { StrokeEndpoint } from "@/lib/strokeEndpoints";
import { cn } from "@/lib/utils";

/** Small preview icon for stroke endpoint dropdowns. */
export function EndpointPreviewIcon({
  endpoint,
  className,
}: {
  endpoint: StrokeEndpoint;
  className?: string;
}) {
  return (
    <svg
      width={28}
      height={10}
      viewBox="0 0 28 10"
      aria-hidden
      className={cn("text-current", className)}
    >
      <line x1={2} y1={5} x2={20} y2={5} stroke="currentColor" strokeWidth={1.5} strokeDasharray="3 2" />
      <EndpointEndGraphic endpoint={endpoint} />
    </svg>
  );
}

function EndpointEndGraphic({ endpoint }: { endpoint: StrokeEndpoint }) {
  const x = 22;
  switch (endpoint) {
    case "none":
      return <line x1={20} y1={3} x2={20} y2={7} stroke="currentColor" strokeWidth={1.5} />;
    case "round":
      return <circle cx={x} cy={5} r={2.5} fill="currentColor" />;
    case "square":
      return <rect x={x - 2} y={2.5} width={4} height={5} fill="currentColor" />;
    case "line-arrow":
      return (
        <path
          d={`M${x - 5},1.5 L${x},5 L${x - 5},8.5`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "triangle-arrow":
      return <polygon points={`${x - 5},2 ${x},5 ${x - 5},8`} fill="currentColor" />;
    case "reversed-triangle":
      return (
        <polygon
          points={`${x - 5},2 ${x},5 ${x - 5},8`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
        />
      );
    case "circle-arrow":
      return (
        <circle
          cx={x - 2.5}
          cy={5}
          r={2.2}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
        />
      );
    case "diamond-arrow":
      return (
        <polygon
          points={`${x - 5},5 ${x - 2.5},2 ${x},5 ${x - 2.5},8`}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
        />
      );
    default:
      return null;
  }
}
