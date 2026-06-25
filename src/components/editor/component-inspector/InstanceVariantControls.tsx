"use client";

import type { ComponentLibraryGroup } from "@/lib/componentModel";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildComponentSet } from "@/lib/components/componentSet";
import { variantAxesForGroup, variantValuesForAxis } from "@/lib/componentUx";
import { VariantPropertyChips } from "@/components/editor/component-inspector/VariantPropertyChips";
import { cn } from "@/lib/utils";

type Props = {
  group: ComponentLibraryGroup;
  selected: Record<string, string> | undefined;
  disabled?: boolean;
  onChange: (properties: Record<string, string>) => void;
};

export function InstanceVariantControls({ group, selected, disabled, onChange }: Props) {
  const componentSet = buildComponentSet(
    Object.fromEntries(group.variants.map((v) => [v.id, v])),
    group.id,
  );
  const axes = componentSet?.properties.map((p) => p.name) ?? variantAxesForGroup(group);
  if (axes.length === 0) return null;

  const current = selected ?? group.variants[0]?.variantProperties ?? {};

  return (
    <div className="space-y-2">
      <div>
        <p className="text-ui font-medium text-app-muted">Variants</p>
        <VariantPropertyChips axes={axes} className="mt-1" />
      </div>
      {axes.map((axis) => {
        const values = variantValuesForAxis(group, axis);
        const value = current[axis] ?? values[0] ?? "";
        return (
          <label key={axis} className="flex flex-col gap-1">
            <span className="text-ui text-app-subtle">{axis}</span>
            <select
              disabled={disabled}
              data-testid={`instance-variant-${axis}`}
              className={cn("h-8 rounded-md border border-app-border bg-app-field px-2 text-ui")}
              value={value}
              onChange={(e) => onChange({ ...current, [axis]: e.target.value })}
            >
              {values.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}

export function masterMatchesVariantProperties(
  master: EditorNode,
  properties: Record<string, string>,
): boolean {
  const vp = master.variantProperties ?? {};
  return Object.entries(properties).every(([k, v]) => vp[k] === v);
}
