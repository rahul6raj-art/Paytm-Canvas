export type RotateGeomSnapshot = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RotateGeomLockState = {
  transformInteractionMode: "none" | "resize" | "rotate";
  rotateGeomSnapshot: ({ nodeId: string } & RotateGeomSnapshot) | null;
  rotateGeomSnapshots: Record<string, RotateGeomSnapshot> | null;
};

/** True while a rotate drag is active or geometry is frozen until commit. */
export function isRotateGeometryLockActive(state: RotateGeomLockState): boolean {
  if (state.transformInteractionMode === "rotate") return true;
  if (state.rotateGeomSnapshot != null) return true;
  return state.rotateGeomSnapshots != null && Object.keys(state.rotateGeomSnapshots).length > 0;
}

export function rotateGeomSnapshotForNode(
  state: RotateGeomLockState,
  nodeId: string,
): RotateGeomSnapshot | null {
  if (state.rotateGeomSnapshot?.nodeId === nodeId) {
    return state.rotateGeomSnapshot;
  }
  return state.rotateGeomSnapshots?.[nodeId] ?? null;
}

/** Single-select rotate keeps x/y fixed; multi-select only freezes width/height. */
export function applyRotateGeometryLock<T extends { x: number; y: number; width: number; height: number }>(
  node: T,
  snapshot: RotateGeomSnapshot,
  freezePosition: boolean,
): T {
  return {
    ...node,
    ...(freezePosition ? { x: snapshot.x, y: snapshot.y } : {}),
    width: snapshot.width,
    height: snapshot.height,
  };
}
