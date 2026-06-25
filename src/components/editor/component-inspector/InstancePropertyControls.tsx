"use client";

import { useMemo, useState } from "react";
import type { EditorNode } from "@/stores/useEditorStore";
import type { ComponentPropertyDef } from "@/lib/components/types";
import {
  effectiveSwapComponentId,
  isInstanceSwapPropertyOverridden,
  swapCandidateGroups,
} from "@/lib/components/componentInstanceSwap";
import { componentDisplayName } from "@/lib/components/folders";
import { PropertyTextInput } from "@/components/editor/PropertyInput";
import { OverrideResetButton } from "./OverrideResetButton";
import { hasStableOverride } from "@/lib/componentUx";
import { readInstanceOverrideMap } from "@/lib/components/overrides";

type Props = {
  instRoot: EditorNode;
  master: EditorNode;
  allNodes: Record<string, EditorNode>;
  locked?: boolean;
  onSetProperty: (key: string, value: string | boolean) => void;
  onResetProperty: (stableId: string, propertyPath: string) => void;
  onResetSwapProperty: (propertyKey: string) => void;
};

export function InstancePropertyControls({
  instRoot,
  master,
  allNodes,
  locked,
  onSetProperty,
  onResetProperty,
  onResetSwapProperty,
}: Props) {
  const defs = master.componentPropertyDefs ?? [];
  if (defs.length === 0) return null;

  const overrideMap = readInstanceOverrideMap(instRoot);

  return (
    <div className="space-y-2">
      <p className="text-ui font-medium text-app-muted">Properties</p>
      {defs.map((def) => (
        <PropertyRow
          key={def.id}
          def={def}
          instRoot={instRoot}
          allNodes={allNodes}
          locked={locked}
          overrideMap={overrideMap}
          onSetProperty={onSetProperty}
          onResetProperty={onResetProperty}
          onResetSwapProperty={onResetSwapProperty}
        />
      ))}
    </div>
  );
}

function PropertyRow({
  def,
  instRoot,
  allNodes,
  locked,
  overrideMap,
  onSetProperty,
  onResetProperty,
  onResetSwapProperty,
}: {
  def: ComponentPropertyDef;
  instRoot: EditorNode;
  allNodes: Record<string, EditorNode>;
  locked?: boolean;
  overrideMap: ReturnType<typeof readInstanceOverrideMap>;
  onSetProperty: (key: string, value: string | boolean) => void;
  onResetProperty: (stableId: string, propertyPath: string) => void;
  onResetSwapProperty: (propertyKey: string) => void;
}) {
  const val = instRoot.componentPropertyValues?.[def.key];
  const overridden =
    def.kind === "instanceSwap"
      ? isInstanceSwapPropertyOverridden(def, instRoot.componentPropertyValues)
      : hasStableOverride(instRoot, def.targetStableLayerId, def.targetPath);

  if (def.kind === "boolean") {
    return (
      <label className="flex items-center justify-between gap-2 text-ui">
        <span className="text-app-fg">{def.label}</span>
        <span className="inline-flex items-center gap-1">
          <OverrideResetButton
            visible={overridden}
            disabled={locked}
            onReset={() => onResetProperty(def.targetStableLayerId, def.targetPath)}
          />
          <input
            type="checkbox"
            disabled={locked}
            checked={Boolean(val ?? def.defaultValue ?? true)}
            onChange={(e) => onSetProperty(def.key, e.target.checked)}
          />
        </span>
      </label>
    );
  }

  if (def.kind === "text") {
    return (
      <div className="flex items-start gap-1">
        <div className="min-w-0 flex-1">
          <PropertyTextInput
            label={def.label}
            value={String(val ?? def.defaultValue ?? "")}
            instanceKey={`${instRoot.id}-${def.key}`}
            onCommit={(v) => onSetProperty(def.key, v)}
          />
        </div>
        <OverrideResetButton
          visible={overridden}
          disabled={locked}
          className="mt-6"
          onReset={() => onResetProperty(def.targetStableLayerId, def.targetPath)}
        />
      </div>
    );
  }

  if (def.kind === "instanceSwap") {
    return (
      <InstanceSwapPropertyControl
        def={def}
        instRoot={instRoot}
        allNodes={allNodes}
        locked={locked}
        overridden={overridden}
        onSetProperty={onSetProperty}
        onReset={() => onResetSwapProperty(def.key)}
      />
    );
  }

  return null;
}

function InstanceSwapPropertyControl({
  def,
  instRoot,
  allNodes,
  locked,
  overridden,
  onSetProperty,
  onReset,
}: {
  def: ComponentPropertyDef;
  instRoot: EditorNode;
  allNodes: Record<string, EditorNode>;
  locked?: boolean;
  overridden: boolean;
  onSetProperty: (key: string, value: string | boolean) => void;
  onReset: () => void;
}) {
  const [query, setQuery] = useState("");
  const { preferred, all } = useMemo(
    () => swapCandidateGroups(allNodes, def),
    [allNodes, def],
  );
  const effectiveId = effectiveSwapComponentId(def, instRoot.componentPropertyValues) ?? def.defaultComponentId ?? "";
  const q = query.trim().toLowerCase();
  const filterMasters = (list: EditorNode[]) =>
    q
      ? list.filter((m) => componentDisplayName(m.name).toLowerCase().includes(q))
      : list;
  const preferredFiltered = filterMasters(preferred);
  const allFiltered = filterMasters(all);

  return (
    <label className="flex flex-col gap-1" data-testid={`instance-property-${def.key}`}>
      <span className="flex items-center justify-between text-ui text-app-subtle">
        <span className="inline-flex items-center gap-1.5">
          {def.label}
          {overridden ? (
            <span className="rounded bg-amber-500/15 px-1 py-0.5 text-[10px] text-amber-200">overridden</span>
          ) : null}
        </span>
        <OverrideResetButton visible={overridden} disabled={locked} onReset={onReset} />
      </span>
      {def.allowAnyComponent !== false ? (
        <input
          type="search"
          disabled={locked}
          placeholder="Search components…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-7 rounded-md border border-app-border bg-app-field px-2 text-ui"
        />
      ) : null}
      <select
        disabled={locked}
        className="h-8 rounded-md border border-app-border bg-app-field px-2 text-ui"
        value={effectiveId}
        onChange={(e) => onSetProperty(def.key, e.target.value)}
      >
        {preferredFiltered.map((m) => (
          <option key={m.id} value={m.componentId ?? m.id}>
            {componentDisplayName(m.name)}
          </option>
        ))}
        {def.allowAnyComponent !== false && allFiltered.length > 0 ? (
          <optgroup label="All components">
            {allFiltered.map((m) => (
              <option key={m.id} value={m.componentId ?? m.id}>
                {componentDisplayName(m.name)}
              </option>
            ))}
          </optgroup>
        ) : null}
      </select>
    </label>
  );
}
