"use client";

import { useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import type { ComponentLibraryGroup } from "@/lib/componentModel";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildComponentSet } from "@/lib/components/componentSet";
import { variantAxesForGroup, variantValuesForAxis } from "@/lib/componentUx";
import { PropertyTextInput } from "@/components/editor/PropertyInput";
import { VariantPropertyChips } from "@/components/editor/component-inspector/VariantPropertyChips";
import { cn } from "@/lib/utils";

type Props = {
  master: EditorNode;
  group: ComponentLibraryGroup;
  locked?: boolean;
  onUpdateAxis: (axis: string, value: string) => void;
  onAddAxis: (axis: string, defaultValue: string) => void;
  onRenameProperty?: (oldName: string, newName: string) => void;
  onDeleteProperty?: (propertyName: string) => void;
  onAddPropertyValue?: (propertyName: string, value: string) => void;
  onDuplicateVariant?: () => void;
  onDeleteVariant?: () => void;
  onAddVariant?: () => void;
};

export function MasterVariantEditor({
  master,
  group,
  locked,
  onUpdateAxis,
  onAddAxis,
  onRenameProperty,
  onDeleteProperty,
  onAddPropertyValue,
  onDuplicateVariant,
  onDeleteVariant,
  onAddVariant,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customAxis, setCustomAxis] = useState("");
  const [addingValueFor, setAddingValueFor] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");

  const componentSet = buildComponentSet(
    Object.fromEntries(group.variants.map((v) => [v.id, v])),
    group.id,
  );
  const axes = componentSet?.properties.map((p) => p.name) ?? variantAxesForGroup(group);
  const current = master.variantProperties ?? {};

  const addPreset = (axis: string, defaultValue: string) => {
    onAddAxis(axis, defaultValue);
    setMenuOpen(false);
  };

  const commitCustomAxis = () => {
    const name = customAxis.trim();
    if (!name) return;
    onAddAxis(name, "Default");
    setCustomAxis("");
    setMenuOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-ui font-medium text-app-muted">Variants</p>
          <VariantPropertyChips axes={axes} className="mt-1" />
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            disabled={locked}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ui text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40",
            )}
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            Add property
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-full z-10 mt-1 min-w-[180px] rounded-lg border border-app-border bg-app-panel p-1 shadow-lg">
              {(
                [
                  ["State", "Default"],
                  ["Size", "Medium"],
                  ["Variant", "Default"],
                ] as const
              ).map(([axis, val]) => (
                <button
                  key={axis}
                  type="button"
                  className="editor-menu-dropdown-item w-full text-left"
                  onClick={() => addPreset(axis, val)}
                >
                  {axis}
                </button>
              ))}
              <div className="border-t border-app-border p-1">
                <input
                  type="text"
                  placeholder="Custom property"
                  value={customAxis}
                  onChange={(e) => setCustomAxis(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitCustomAxis();
                  }}
                  className="h-7 w-full rounded border border-app-border bg-app-field px-2 text-ui"
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {axes.length === 0 ? (
        <p className="text-ui text-app-subtle">Combine components as variants or add a property axis.</p>
      ) : (
        axes.map((axis) => {
          const values = variantValuesForAxis(group, axis);
          const value = current[axis] ?? values[0] ?? "";
          return (
            <div key={axis} className="space-y-1 rounded-md border border-app-border/60 p-2">
              <div className="flex items-center justify-between gap-1">
                <span className="text-ui text-app-subtle">{axis}</span>
                {onDeleteProperty && axes.length > 1 ? (
                  <button
                    type="button"
                    disabled={locked}
                    title={`Delete ${axis}`}
                    onClick={() => onDeleteProperty(axis)}
                    className="rounded p-0.5 text-app-subtle hover:bg-app-hover hover:text-red-300 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
              {onRenameProperty ? (
                <PropertyTextInput
                  label=""
                  value={axis}
                  instanceKey={`${master.id}-rename-axis-${axis}`}
                  onCommit={(v) => {
                    if (v.trim() && v !== axis) onRenameProperty(axis, v.trim());
                  }}
                />
              ) : null}
              {values.length > 1 ? (
                <select
                  disabled={locked}
                  className="h-8 w-full rounded-md border border-app-border bg-app-field px-2 text-ui"
                  value={value}
                  onChange={(e) => onUpdateAxis(axis, e.target.value)}
                >
                  {values.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              ) : (
                <PropertyTextInput
                  label=""
                  value={value}
                  instanceKey={`${master.id}-variant-${axis}`}
                  onCommit={(v) => onUpdateAxis(axis, v)}
                />
              )}
              {onAddPropertyValue ? (
                addingValueFor === axis ? (
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={newValue}
                      placeholder="New value"
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newValue.trim()) {
                          onAddPropertyValue(axis, newValue.trim());
                          setNewValue("");
                          setAddingValueFor(null);
                        }
                      }}
                      className="h-7 flex-1 rounded border border-app-border bg-app-field px-2 text-ui"
                    />
                    <button
                      type="button"
                      className="text-ui text-violet-300"
                      onClick={() => {
                        if (newValue.trim()) {
                          onAddPropertyValue(axis, newValue.trim());
                          setNewValue("");
                          setAddingValueFor(null);
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={locked}
                    className="text-ui text-app-subtle hover:text-app-fg"
                    onClick={() => setAddingValueFor(axis)}
                  >
                    + Add value
                  </button>
                )
              ) : null}
            </div>
          );
        })
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        {onAddVariant ? (
          <button
            type="button"
            disabled={locked}
            onClick={onAddVariant}
            className="inspector-section-action flex-1"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.75} />
            Add variant
          </button>
        ) : null}
        {onDuplicateVariant ? (
          <button
            type="button"
            disabled={locked}
            onClick={onDuplicateVariant}
            className="inspector-section-action flex-1"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
            Duplicate
          </button>
        ) : null}
        {onDeleteVariant && group.variants.length > 1 ? (
          <button
            type="button"
            disabled={locked}
            onClick={onDeleteVariant}
            className="inspector-section-action flex-1 text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Delete
          </button>
        ) : null}
      </div>

      {group.variants.length > 1 ? (
        <p className="text-ui text-app-subtle">
          Component set · {group.variants.length} variants
        </p>
      ) : (
        <p className="text-ui text-app-subtle">
          Add a variant or combine with other components to create a component set.
        </p>
      )}
    </div>
  );
}
