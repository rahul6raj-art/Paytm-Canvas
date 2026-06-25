"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import type { EditorNode } from "@/stores/useEditorStore";
import type { ComponentPropertyDef } from "@/lib/components/types";
import {
  createBooleanProperty,
  createTextProperty,
  createVariantProperty,
} from "@/lib/components/properties";
import { findNestedInstanceInMasterSubtree } from "@/lib/components/componentInstanceSwap";
import { componentDisplayName } from "@/lib/components/folders";
import { listComponentMasters } from "@/lib/componentModel";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

type Props = {
  master: EditorNode;
  locked?: boolean;
  onAddProperty: (def: ComponentPropertyDef) => void;
  onUpdateProperty: (propertyId: string, patch: Partial<ComponentPropertyDef>) => void;
  onCreateSwapFromSelection: (nestedInstanceNodeId: string, label?: string) => void;
  onCreateSlotFromSelection: (containerNodeId: string, label?: string) => void;
};

export function MasterPropertyEditor({
  master,
  locked,
  onAddProperty,
  onUpdateProperty,
  onCreateSwapFromSelection,
  onCreateSlotFromSelection,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);

  const stableLayers = Object.entries(master.componentLayerStableIds ?? {});
  const firstStable = stableLayers[0]?.[1];

  const nestedSelection = useMemo(() => {
    for (const sid of selectedIds) {
      const found = findNestedInstanceInMasterSubtree(nodes, childOrder, master.id, sid);
      if (found) return found;
    }
    return null;
  }, [selectedIds, nodes, childOrder, master.id]);

  const containerSelection = useMemo(() => {
    for (const sid of selectedIds) {
      const n = nodes[sid];
      if (!n || (n.type !== "frame" && n.type !== "group")) continue;
      if (sid === master.id) continue;
      let cur: string | null = sid;
      let insideMaster = false;
      while (cur) {
        if (cur === master.id) {
          insideMaster = true;
          break;
        }
        cur = nodes[cur]?.parentId ?? null;
      }
      if (insideMaster) return sid;
    }
    return null;
  }, [selectedIds, nodes, master.id]);

  const addKind = (kind: ComponentPropertyDef["kind"]) => {
    if (!firstStable) return;
    const keyBase =
      kind === "boolean" ? "visible" : kind === "text" ? "label" : "variant";
    let def: ComponentPropertyDef;
    switch (kind) {
      case "boolean":
        def = createBooleanProperty(keyBase, "Visible", firstStable, true);
        break;
      case "text":
        def = createTextProperty(keyBase, "Label", firstStable, "");
        break;
      case "variant":
        def = createVariantProperty("State", "State");
        break;
      default:
        return;
    }
    onAddProperty(def);
    setMenuOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-ui font-medium text-app-muted">Component properties</p>
        <div className="relative">
          <button
            type="button"
            disabled={locked || !firstStable}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ui text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40",
            )}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add property
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-app-border bg-app-panel p-1 shadow-lg">
              {(
                [
                  ["text", "Text"],
                  ["boolean", "Boolean"],
                  ["variant", "Variant"],
                ] as const
              ).map(([kind, label]) => (
                <button
                  key={kind}
                  type="button"
                  className="editor-menu-dropdown-item w-full text-left"
                  onClick={() => addKind(kind)}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {nestedSelection ? (
        <button
          type="button"
          disabled={locked}
          data-testid="create-instance-swap-from-selection"
          className="inspector-section-action w-full"
          onClick={() =>
            onCreateSwapFromSelection(
              nestedSelection,
              componentDisplayName(nodes[nestedSelection]?.name ?? "Icon"),
            )
          }
        >
          Create instance swap from selection
        </button>
      ) : null}

      {containerSelection ? (
        <button
          type="button"
          disabled={locked}
          data-testid="create-slot-from-selection"
          className="inspector-section-action w-full"
          onClick={() =>
            onCreateSlotFromSelection(
              containerSelection,
              componentDisplayName(nodes[containerSelection]?.name ?? "Slot"),
            )
          }
        >
          Expose as slot
        </button>
      ) : null}

      {(master.componentPropertyDefs ?? []).length === 0 ? (
        <p className="text-ui text-app-subtle">
          Expose nested icons, label text, visibility, or variant axes to instance users.
        </p>
      ) : (
        <ul className="space-y-2">
          {(master.componentPropertyDefs ?? []).map((p) => (
            <li
              key={p.id}
              className="rounded border border-app-border-subtle px-2 py-1.5 text-ui"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-app-fg">{p.label}</span>
                <span className="text-app-subtle">{p.kind}</span>
              </div>
              {p.kind === "instanceSwap" ? (
                <InstanceSwapPreferredEditor
                  def={p}
                  allNodes={nodes}
                  locked={locked}
                  onUpdate={(patch) => onUpdateProperty(p.id, patch)}
                />
              ) : null}
              {p.kind === "slot" && p.targetStablePath ? (
                <p className="mt-1 text-[10px] text-app-subtle">Path: {p.targetStablePath}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InstanceSwapPreferredEditor({
  def,
  allNodes,
  locked,
  onUpdate,
}: {
  def: ComponentPropertyDef;
  allNodes: Record<string, EditorNode>;
  locked?: boolean;
  onUpdate: (patch: Partial<ComponentPropertyDef>) => void;
}) {
  const preferred = def.preferredComponentIds ?? [];
  const allMasters = listComponentMasters(allNodes);
  const available = allMasters.filter(
    (m) => m.componentId && !preferred.includes(m.componentId),
  );

  return (
    <div className="mt-2 space-y-2 border-t border-app-border-subtle pt-2">
      <label className="flex items-center justify-between gap-2 text-ui">
        <span className="text-app-subtle">Allow any component</span>
        <input
          type="checkbox"
          disabled={locked}
          checked={def.allowAnyComponent !== false}
          onChange={(e) => onUpdate({ allowAnyComponent: e.target.checked })}
        />
      </label>
      <p className="text-[11px] text-app-subtle">Preferred values</p>
      <ul className="space-y-1">
        {preferred.map((cid, idx) => {
          const m = allMasters.find((x) => x.componentId === cid);
          return (
            <li key={cid} className="flex items-center gap-1">
              <span className="min-w-0 flex-1 truncate text-app-fg">
                {m ? componentDisplayName(m.name) : cid}
              </span>
              <button
                type="button"
                disabled={locked || idx === 0}
                className="rounded px-1 text-app-subtle hover:bg-app-hover disabled:opacity-30"
                onClick={() => {
                  if (idx <= 0) return;
                  const next = [...preferred];
                  [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
                  onUpdate({ preferredComponentIds: next });
                }}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={locked}
                className="rounded p-0.5 text-app-subtle hover:bg-app-hover hover:text-red-300"
                onClick={() =>
                  onUpdate({ preferredComponentIds: preferred.filter((id) => id !== cid) })
                }
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          );
        })}
      </ul>
      {available.length > 0 ? (
        <select
          disabled={locked}
          className="h-7 w-full rounded-md border border-app-border bg-app-field px-2 text-ui"
          value=""
          onChange={(e) => {
            const cid = e.target.value;
            if (!cid) return;
            onUpdate({ preferredComponentIds: [...preferred, cid] });
          }}
        >
          <option value="">Add preferred…</option>
          {available.map((m) => (
            <option key={m.id} value={m.componentId!}>
              {componentDisplayName(m.name)}
            </option>
          ))}
        </select>
      ) : null}
      {def.targetStablePath ? (
        <p className="text-[10px] text-app-subtle">Path: {def.targetStablePath}</p>
      ) : null}
    </div>
  );
}
