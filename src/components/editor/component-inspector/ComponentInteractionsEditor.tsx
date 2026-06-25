"use client";

import { Plus, Trash2 } from "lucide-react";
import type { ComponentLibraryGroup } from "@/lib/componentModel";
import type { EditorNode } from "@/stores/useEditorStore";
import {
  INTERACTION_TRANSITION_LABELS,
  INTERACTION_TRIGGER_LABELS,
  defaultComponentInteraction,
  type ComponentInteraction,
  type ComponentInteractionTrigger,
  type ComponentInteractionTransitionType,
} from "@/lib/components/componentInteractions";
import { buildComponentSet } from "@/lib/components/componentSet";
import { variantValuesForAxis } from "@/lib/componentUx";

type Props = {
  master: EditorNode;
  group: ComponentLibraryGroup;
  locked?: boolean;
  onAdd: (interaction: ComponentInteraction) => void;
  onUpdate: (interactionId: string, patch: Partial<ComponentInteraction>) => void;
  onRemove: (interactionId: string) => void;
};

const TRIGGERS = Object.keys(INTERACTION_TRIGGER_LABELS) as ComponentInteractionTrigger[];
const TRANSITIONS = Object.keys(INTERACTION_TRANSITION_LABELS) as ComponentInteractionTransitionType[];

function variantLabel(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}

export function ComponentInteractionsEditor({ master, group, locked, onAdd, onUpdate, onRemove }: Props) {
  const componentSet = buildComponentSet(
    Object.fromEntries(group.variants.map((v) => [v.id, v])),
    group.id,
  );
  const interactions = master.componentInteractions ?? [];
  const fromValues = master.variantProperties ?? group.variants[0]?.variantProperties ?? {};

  const targetOptions = group.variants.map((v) => ({
    label: variantLabel(v.variantProperties ?? {}),
    values: { ...(v.variantProperties ?? {}) },
  }));

  const addDefault = () => {
    const target =
      group.variants.find((v) => v.variantProperties?.State === "Hover")?.variantProperties ??
      group.variants[1]?.variantProperties ??
      { State: "Hover" };
    onAdd(defaultComponentInteraction(fromValues, "ON_MOUSE_ENTER", target));
  };

  return (
    <div className="space-y-2" data-testid="component-interactions-editor">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-ui font-medium text-app-muted">Interactions</p>
          <p className="text-ui text-app-subtle">From {variantLabel(fromValues)}</p>
        </div>
        <button
          type="button"
          disabled={locked}
          onClick={addDefault}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-ui text-app-muted hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add
        </button>
      </div>

      {interactions.length === 0 ? (
        <p className="text-ui text-app-subtle">
          Add hover, press, and release interactions to switch variants at runtime.
        </p>
      ) : (
        interactions.map((interaction) => (
          <div
            key={interaction.id}
            className="space-y-1.5 rounded-md border border-app-border/60 p-2"
            data-testid={`component-interaction-${interaction.id}`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-ui text-app-subtle">Interaction</span>
              <button
                type="button"
                disabled={locked}
                onClick={() => onRemove(interaction.id)}
                className="rounded p-0.5 text-app-subtle hover:bg-app-hover hover:text-red-300 disabled:opacity-40"
              >
                <Trash2 className="h-3 w-3" strokeWidth={1.75} />
              </button>
            </div>

            <label className="flex flex-col gap-1">
              <span className="text-ui text-app-subtle">Trigger</span>
              <select
                disabled={locked}
                className="h-8 rounded-md border border-app-border bg-app-field px-2 text-ui"
                value={interaction.trigger}
                onChange={(e) =>
                  onUpdate(interaction.id, {
                    trigger: e.target.value as ComponentInteractionTrigger,
                  })
                }
              >
                {TRIGGERS.map((trigger) => (
                  <option key={trigger} value={trigger}>
                    {INTERACTION_TRIGGER_LABELS[trigger]}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-ui text-app-subtle">Target variant</span>
              <select
                disabled={locked}
                className="h-8 rounded-md border border-app-border bg-app-field px-2 text-ui"
                value={JSON.stringify(interaction.action.targetVariantValues)}
                onChange={(e) => {
                  const values = JSON.parse(e.target.value) as Record<string, string>;
                  onUpdate(interaction.id, {
                    action: { ...interaction.action, targetVariantValues: values },
                  });
                }}
              >
                {targetOptions.map((opt) => (
                  <option key={opt.label} value={JSON.stringify(opt.values)}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-ui text-app-subtle">Transition</span>
                <select
                  disabled={locked}
                  className="h-8 rounded-md border border-app-border bg-app-field px-2 text-ui"
                  value={interaction.action.transition?.type ?? "INSTANT"}
                  onChange={(e) =>
                    onUpdate(interaction.id, {
                      action: {
                        ...interaction.action,
                        transition: {
                          ...(interaction.action.transition ?? { durationMs: 0 }),
                          type: e.target.value as ComponentInteractionTransitionType,
                        },
                      },
                    })
                  }
                >
                  {TRANSITIONS.map((t) => (
                    <option key={t} value={t}>
                      {INTERACTION_TRANSITION_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-ui text-app-subtle">Duration (ms)</span>
                <input
                  type="number"
                  min={0}
                  disabled={locked}
                  className="h-8 rounded-md border border-app-border bg-app-field px-2 text-ui"
                  value={interaction.action.transition?.durationMs ?? 0}
                  onChange={(e) =>
                    onUpdate(interaction.id, {
                      action: {
                        ...interaction.action,
                        transition: {
                          type: interaction.action.transition?.type ?? "INSTANT",
                          durationMs: Number(e.target.value) || 0,
                          easing: interaction.action.transition?.easing,
                        },
                      },
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))
      )}

      {componentSet?.properties.some((p) => p.name === "State") ? (
        <p className="text-ui text-app-subtle">
          State values: {variantValuesForAxis(group, "State").join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
