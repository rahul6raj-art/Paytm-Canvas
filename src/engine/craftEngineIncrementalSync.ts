import type { CraftEngineDocument } from "@/engine/craftEngineTypes";
import type { CraftEngineInstance } from "@/engine/craftEngineTypes";

export type CraftEngineOp = {
  op: string;
  nodeId: string;
  fields?: Record<string, unknown>;
  parentId?: string | null;
};

function childOrderSignature(doc: CraftEngineDocument): string {
  const keys = Object.keys(doc.childOrder).sort();
  return keys.map((k) => `${k}:${(doc.childOrder[k] ?? []).join(",")}`).join("|");
}

function rootSignature(doc: CraftEngineDocument): string {
  return [...doc.rootIds].sort().join(",");
}

function nodeIds(doc: CraftEngineDocument): Set<string> {
  return new Set(Object.keys(doc.nodes));
}

function parentIdForNode(childOrder: Record<string, string[]>, nodeId: string): string {
  for (const [parent, children] of Object.entries(childOrder)) {
    if (children.includes(nodeId)) return parent;
  }
  return "__root__";
}

function sameNodeSet(prev: CraftEngineDocument, next: CraftEngineDocument): boolean {
  const prevIds = nodeIds(prev);
  const nextIds = nodeIds(next);
  if (prevIds.size !== nextIds.size) return false;
  for (const id of prevIds) {
    if (!nextIds.has(id)) return false;
  }
  return true;
}

function canIncrementalSync(prev: CraftEngineDocument, next: CraftEngineDocument): boolean {
  if (rootSignature(prev) !== rootSignature(next)) return false;
  if (childOrderSignature(prev) !== childOrderSignature(next)) return false;
  return sameNodeSet(prev, next);
}

function parentKeyForNode(
  childOrder: Record<string, string[]>,
  nodeId: string,
): string {
  for (const [parent, children] of Object.entries(childOrder)) {
    if (children.includes(nodeId)) return parent;
  }
  return "__root__";
}

function countReparentedNodes(
  prev: CraftEngineDocument,
  next: CraftEngineDocument,
  addedIds: Set<string>,
): number {
  let count = 0;
  for (const id of Object.keys(next.nodes)) {
    if (addedIds.has(id)) continue;
    if (!prev.nodes[id]) continue;
    if (parentKeyForNode(prev.childOrder, id) !== parentKeyForNode(next.childOrder, id)) {
      count += 1;
    }
  }
  return count;
}

function buildStructuralOps(
  prev: CraftEngineDocument,
  next: CraftEngineDocument,
): CraftEngineOp[] | "full" {
  const prevIds = nodeIds(prev);
  const nextIds = nodeIds(next);
  const added = [...nextIds].filter((id) => !prevIds.has(id));
  const removed = [...prevIds].filter((id) => !nextIds.has(id));
  const treeChanged = childOrderSignature(prev) !== childOrderSignature(next);
  const addedSet = new Set(added);

  if (added.length === 1 && removed.length === 0) {
    const nodeId = added[0]!;
    if (!treeChanged) {
      return [
        {
          op: "insertNode",
          nodeId,
          parentId: parentIdForNode(next.childOrder, nodeId),
          fields: { node: next.nodes[nodeId] },
        },
      ];
    }
    if (countReparentedNodes(prev, next, addedSet) > 0) {
      return "full";
    }
    return [
      {
        op: "insertNode",
        nodeId,
        parentId: parentIdForNode(next.childOrder, nodeId),
        fields: { node: next.nodes[nodeId] },
      },
      {
        op: "setTree",
        nodeId: "__root__",
        fields: {
          childOrder: next.childOrder,
          rootIds: next.rootIds,
        },
      },
    ];
  }

  if (removed.length === 1 && added.length === 0) {
    const nodeId = removed[0]!;
    if (!treeChanged) {
      return [{ op: "deleteNode", nodeId }];
    }
    return [
      { op: "deleteNode", nodeId },
      {
        op: "setTree",
        nodeId: "__root__",
        fields: {
          childOrder: next.childOrder,
          rootIds: next.rootIds,
        },
      },
    ];
  }

  if (
    added.length === 0 &&
    removed.length === 0 &&
    rootSignature(prev) === rootSignature(next) &&
    childOrderSignature(prev) !== childOrderSignature(next)
  ) {
    return [
      {
        op: "setTree",
        nodeId: "__root__",
        fields: {
          childOrder: next.childOrder,
          rootIds: next.rootIds,
        },
      },
    ];
  }

  return "full";
}

function buildUpdateOps(prev: CraftEngineDocument, next: CraftEngineDocument): CraftEngineOp[] {
  const ops: CraftEngineOp[] = [];
  for (const nodeId of Object.keys(next.nodes)) {
    const before = JSON.stringify(prev.nodes[nodeId] ?? null);
    const after = JSON.stringify(next.nodes[nodeId] ?? null);
    if (before !== after) {
      ops.push({
        op: "updateNode",
        nodeId,
        fields: { node: next.nodes[nodeId] },
      });
    }
  }
  return ops;
}

export type CraftEngineSyncState = {
  lastDocument: CraftEngineDocument | null;
};

export type CraftEngineSyncOptions = {
  /** Force full WASM reload (e.g. after editor undo/redo). */
  forceFull?: boolean;
  /** Seed WASM undo stack via loadDocument + pushHistorySnapshot (first authority sync). */
  wasmBootstrap?: boolean;
};

export function createCraftEngineSyncState(): CraftEngineSyncState {
  return { lastDocument: null };
}

/** Sync document via incremental WASM ops when structure is unchanged. */
export function syncCraftEngineDocument(
  engine: CraftEngineInstance,
  next: CraftEngineDocument,
  state: CraftEngineSyncState,
  options?: CraftEngineSyncOptions,
): "bootstrap" | "full" | "incremental" | "noop" {
  const prev = state.lastDocument;
  const forceFull = options?.forceFull === true;
  const wasmBootstrap = options?.wasmBootstrap === true;

  if (!prev || forceFull) {
    if (!prev && wasmBootstrap && !forceFull) {
      engine.loadDocument(JSON.stringify(next));
      engine.pushHistorySnapshot();
      state.lastDocument = next;
      return "bootstrap";
    }
    engine.syncDocument(JSON.stringify(next));
    state.lastDocument = next;
    return "full";
  }

  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return "noop";
  }

  if (!canIncrementalSync(prev, next)) {
    const structural = buildStructuralOps(prev, next);
    if (structural === "full") {
      engine.syncDocument(JSON.stringify(next));
      state.lastDocument = next;
      return "full";
    }

    const batch = [...structural, ...buildUpdateOps(prev, next)];
    if (batch.length === 1) {
      engine.applyDocumentOp(JSON.stringify(batch[0]));
    } else if (batch.length > 1) {
      engine.applyDocumentOps(JSON.stringify(batch));
    }
    state.lastDocument = next;
    return "incremental";
  }

  const ops = buildUpdateOps(prev, next);
  if (ops.length === 0) {
    state.lastDocument = next;
    return "noop";
  }

  if (ops.length === 1) {
    engine.applyDocumentOp(JSON.stringify(ops[0]));
  } else if (ops.length > 1) {
    engine.applyDocumentOps(JSON.stringify(ops));
  }
  state.lastDocument = next;
  return "incremental";
}

/** @internal exported for tests */
export function __testBuildStructuralOps(
  prev: CraftEngineDocument,
  next: CraftEngineDocument,
): CraftEngineOp[] | "full" {
  return buildStructuralOps(prev, next);
}

/** Plan incremental WASM ops between two document snapshots (no engine I/O). */
export function planIncrementalDocumentOps(
  prev: CraftEngineDocument,
  next: CraftEngineDocument,
): CraftEngineOp[] | "full" | "noop" {
  if (JSON.stringify(prev) === JSON.stringify(next)) {
    return "noop";
  }

  if (!canIncrementalSync(prev, next)) {
    const structural = buildStructuralOps(prev, next);
    if (structural === "full") return "full";
    return [...structural, ...buildUpdateOps(prev, next)];
  }

  const ops = buildUpdateOps(prev, next);
  if (ops.length === 0) return "noop";
  return ops;
}
