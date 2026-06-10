import type { CrossAxisAlign, PrimaryAxisAlign } from "@/lib/layoutEngine/types";

/**
 * Primary/counter axis alignment is applied inside `layoutChildren` during positioning.
 * These types mirror Figma's alignment enums for inspector and engine consumers.
 */
export type { PrimaryAxisAlign, CrossAxisAlign };

/** Names used by the layout pipeline (see `layoutChildren` in layoutEngine). */
export const PRIMARY_AXIS_ALIGNMENTS: PrimaryAxisAlign[] = [
  "start",
  "center",
  "end",
  "space-between",
];

export const COUNTER_AXIS_ALIGNMENTS: CrossAxisAlign[] = [
  "start",
  "center",
  "end",
  "stretch",
];
