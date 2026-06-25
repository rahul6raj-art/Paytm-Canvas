import type { EditorNode } from "@/stores/useEditorStore";

export type MasterMutationRecord = {
  masterRootId: string;
  layerNodeId: string;
  stableId: string | null;
  changedKeys: (keyof EditorNode)[];
  structural: boolean;
};

export type ComponentUpdateTransaction = {
  mutations: MasterMutationRecord[];
  reason: string;
};

let activeTransaction: ComponentUpdateTransaction | null = null;

export function beginComponentUpdateTransaction(reason = "master-edit"): void {
  activeTransaction = { mutations: [], reason };
}

export function recordMasterMutation(
  masterRootId: string,
  layerNodeId: string,
  stableId: string | null,
  changedKeys: (keyof EditorNode)[],
  structural = false,
): void {
  if (!activeTransaction) {
    activeTransaction = { mutations: [], reason: "master-edit" };
  }
  const existing = activeTransaction.mutations.find(
    (m) => m.masterRootId === masterRootId && m.layerNodeId === layerNodeId,
  );
  if (existing) {
    const merged = new Set([...existing.changedKeys, ...changedKeys]);
    existing.changedKeys = [...merged] as (keyof EditorNode)[];
    existing.structural = existing.structural || structural;
    if (stableId) existing.stableId = stableId;
  } else {
    activeTransaction.mutations.push({
      masterRootId,
      layerNodeId,
      stableId,
      changedKeys: [...changedKeys],
      structural,
    });
  }
}

export function peekComponentUpdateTransaction(): ComponentUpdateTransaction | null {
  return activeTransaction;
}

export function endComponentUpdateTransaction(): ComponentUpdateTransaction | null {
  const tx = activeTransaction;
  activeTransaction = null;
  return tx;
}

export function cancelComponentUpdateTransaction(): void {
  activeTransaction = null;
}

/** Merge batched mutations by master root. */
export function collapseTransactionMutations(
  tx: ComponentUpdateTransaction,
): Map<
  string,
  { layerNodeIds: Set<string>; changedKeys: Set<keyof EditorNode>; structural: boolean }
> {
  const byMaster = new Map<
    string,
    { layerNodeIds: Set<string>; changedKeys: Set<keyof EditorNode>; structural: boolean }
  >();
  for (const m of tx.mutations) {
    let bucket = byMaster.get(m.masterRootId);
    if (!bucket) {
      bucket = { layerNodeIds: new Set(), changedKeys: new Set(), structural: false };
      byMaster.set(m.masterRootId, bucket);
    }
    bucket.layerNodeIds.add(m.layerNodeId);
    for (const k of m.changedKeys) bucket.changedKeys.add(k);
    bucket.structural = bucket.structural || m.structural;
  }
  return byMaster;
}
