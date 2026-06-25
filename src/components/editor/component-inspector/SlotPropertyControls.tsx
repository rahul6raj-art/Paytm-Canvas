"use client";

import type { SlotContentSnapshot } from "@/lib/components/types";
import {
  buildSlotTextContentSnapshot,
  isSlotPropertyOverridden,
  slotTargetPath,
} from "@/lib/components/componentSlots";
import { readInstanceOverrideMap } from "@/lib/components/overrides";
import type { ActiveSlotEditState } from "@/lib/slotEditScope";
import { OverrideResetButton } from "./OverrideResetButton";

type SlotPropertyControlsProps = {
  defs: import("@/lib/components/types").ComponentPropertyDef[];
  instRoot: import("@/stores/useEditorStore").EditorNode;
  instRootId: string;
  locked?: boolean;
  activeSlotEdit: ActiveSlotEditState | null;
  onEnterEdit: (propertyKey: string) => void;
  onExitEdit: () => void;
  onReset: (propertyKey: string) => void;
  onReplaceWithText: (propertyKey: string, content: string) => void;
};

export function SlotPropertyControls({
  defs,
  instRoot,
  instRootId,
  locked,
  activeSlotEdit,
  onEnterEdit,
  onExitEdit,
  onReset,
  onReplaceWithText,
}: SlotPropertyControlsProps) {
  const slotDefs = defs.filter((d) => d.kind === "slot");
  if (slotDefs.length === 0) return null;

  const overrideMap = readInstanceOverrideMap(instRoot);
  const editingOnThisInstance =
    activeSlotEdit != null && activeSlotEdit.instanceRootId === instRootId;
  const activeDef =
    editingOnThisInstance
      ? slotDefs.find((d) => d.key === activeSlotEdit!.propertyKey)
      : null;

  return (
    <div className="space-y-2" data-testid="instance-slot-controls">
      {editingOnThisInstance && activeDef ? (
        <div
          className="rounded-md border border-violet-400/40 bg-violet-950/40 px-2 py-2"
          data-testid="slot-edit-banner"
        >
          <p className="text-ui font-medium text-violet-100">
            Editing slot: {activeDef.label}
          </p>
          <p className="truncate text-[10px] text-violet-200/70">{slotTargetPath(activeDef)}</p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded bg-violet-600 px-2 py-0.5 text-ui text-white hover:bg-violet-500"
              data-testid="slot-inspector-done"
              onClick={onExitEdit}
            >
              Done
            </button>
            <button
              type="button"
              disabled={locked}
              className="rounded px-2 py-0.5 text-ui text-violet-200 hover:bg-violet-400/10 disabled:opacity-40"
              data-testid="slot-inspector-reset"
              onClick={() => onReset(activeDef.key)}
            >
              Reset slot
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-ui font-medium text-app-muted">Slots</p>
      {slotDefs.map((def) => {
        const overridden = isSlotPropertyOverridden(def, overrideMap);
        const isActive = editingOnThisInstance && activeSlotEdit?.propertyKey === def.key;
        return (
          <div
            key={def.id}
            className={`flex items-center justify-between gap-2 rounded border px-2 py-1.5 ${
              isActive ? "border-violet-400/50 bg-violet-950/30" : "border-violet-400/20"
            }`}
            data-testid={`slot-property-${def.key}`}
          >
            <div className="min-w-0">
              <p className="truncate text-ui font-medium text-app-fg">{def.label}</p>
              <p className="truncate text-[10px] text-app-subtle">{slotTargetPath(def)}</p>
              {overridden ? (
                <span className="text-[10px] text-amber-200">custom content</span>
              ) : (
                <span className="text-[10px] text-app-subtle">default</span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isActive ? (
                <button
                  type="button"
                  className="rounded px-2 py-0.5 text-ui text-violet-100 hover:bg-violet-400/10"
                  data-testid={`slot-done-${def.key}`}
                  onClick={onExitEdit}
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  disabled={locked}
                  className="rounded px-2 py-0.5 text-ui text-violet-200 hover:bg-violet-400/10 disabled:opacity-40"
                  data-testid={`slot-edit-${def.key}`}
                  onClick={() => onEnterEdit(def.key)}
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                disabled={locked || isActive}
                className="rounded px-2 py-0.5 text-ui text-app-muted hover:bg-app-hover disabled:opacity-40"
                data-testid={`slot-replace-${def.key}`}
                onClick={() => onReplaceWithText(def.key, "Slot text")}
              >
                Replace
              </button>
              <OverrideResetButton
                visible={overridden}
                disabled={locked || isActive}
                onReset={() => onReset(def.key)}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function slotTextSnapshot(content: string): SlotContentSnapshot {
  return buildSlotTextContentSnapshot(content);
}
