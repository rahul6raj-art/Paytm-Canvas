import type { PathPoint } from "@/lib/pathGeometry";

export type PathHandleMirroring = "none" | "angle" | "angle-length";

export function pathHandleMirroring(
  node: { pathHandleMirroring?: PathHandleMirroring } | null | undefined,
): PathHandleMirroring {
  return node?.pathHandleMirroring ?? "none";
}

function len(v: { x: number; y: number }): number {
  return Math.hypot(v.x, v.y);
}

function scale(v: { x: number; y: number }, factor: number): { x: number; y: number } {
  if (factor === 0) return { x: 0, y: 0 };
  return { x: v.x * factor, y: v.y * factor };
}

/** Apply mirroring when one tangent handle is moved or set. */
export function applyHandleMirroring(
  mirroring: PathHandleMirroring,
  moved: { x: number; y: number },
  which: "in" | "out",
  other?: { x: number; y: number },
): Pick<PathPoint, "handleIn" | "handleOut"> {
  if (mirroring === "none") {
    return which === "in" ? { handleIn: moved } : { handleOut: moved };
  }

  const mLen = len(moved);
  if (mirroring === "angle-length") {
    const mirrored = {
      x: moved.x === 0 ? 0 : -moved.x,
      y: moved.y === 0 ? 0 : -moved.y,
    };
    return which === "in"
      ? { handleIn: moved, handleOut: mirrored }
      : { handleOut: moved, handleIn: mirrored };
  }

  // Mirror angle only: opposite direction, preserve other handle length when possible.
  const otherLen = other ? len(other) : mLen;
  const dir =
    mLen > 1e-6
      ? { x: -moved.x / mLen, y: -moved.y / mLen }
      : other && len(other) > 1e-6
        ? { x: -other.x / len(other), y: -other.y / len(other) }
        : { x: -1, y: 0 };
  const mirrored = scale(dir, otherLen);
  return which === "in"
    ? { handleIn: moved, handleOut: mirrored }
    : { handleOut: moved, handleIn: mirrored };
}

export function mergePathPointHandles(
  point: PathPoint,
  patch: Pick<PathPoint, "handleIn" | "handleOut">,
  mirroring: PathHandleMirroring,
  movedWhich?: "in" | "out",
): PathPoint {
  if (mirroring === "none" || !movedWhich) {
    return { ...point, ...patch };
  }
  const moved =
    movedWhich === "in"
      ? ("handleIn" in patch ? patch.handleIn : point.handleIn)
      : ("handleOut" in patch ? patch.handleOut : point.handleOut);
  if (!moved) return { ...point, ...patch };
  const other = movedWhich === "in" ? point.handleOut : point.handleIn;
  const mirrored = applyHandleMirroring(mirroring, moved, movedWhich, other);
  return { ...point, ...mirrored };
}
