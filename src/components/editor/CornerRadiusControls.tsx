"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Unlink } from "lucide-react";
import { PropertyNumberInput } from "./PropertyInput";
import {
  getNodeCornerRadii,
  hasIndependentCornerRadii,
  type CornerRadii,
} from "@/lib/cornerRadius";
import type { EditorNode, NodeStylePatch } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

type CornerIndex = 0 | 1 | 2 | 3;

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;

export function CornerRadiusControls({
  node,
  instanceKey,
  locked,
  focusedCornerIndex = null,
  onStyle,
}: {
  node: EditorNode;
  instanceKey: string;
  locked: boolean;
  /** When set (e.g. from a selected vector corner), edit that corner's radius. */
  focusedCornerIndex?: CornerIndex | null;
  onStyle: (patch: NodeStylePatch) => void;
}) {
  const radii = getNodeCornerRadii(node);
  const [independent, setIndependent] = useState(
    () => hasIndependentCornerRadii(node) || focusedCornerIndex != null,
  );

  useEffect(() => {
    if (focusedCornerIndex != null) {
      setIndependent(true);
      return;
    }
    setIndependent(hasIndependentCornerRadii(node));
  }, [node.id, node.cornerRadius, node.cornerRadii, focusedCornerIndex]);

  const applyRadii = useCallback(
    (next: CornerRadii) => {
      const allSame = next[0] === next[1] && next[1] === next[2] && next[2] === next[3];
      if (allSame) {
        onStyle({
          cornerRadius: next[0],
          cornerRadii: undefined,
        });
      } else {
        onStyle({
          cornerRadius: undefined,
          cornerRadii: next,
        });
      }
    },
    [onStyle],
  );

  const setCorner = (index: CornerIndex, value: number) => {
    const next = [...radii] as CornerRadii;
    next[index] = Math.max(0, value);
    applyRadii(next);
  };

  const setUniform = (value: number) => {
    const v = Math.max(0, value);
    onStyle({ cornerRadius: v, cornerRadii: undefined });
  };

  const toggleIndependent = () => {
    if (independent) {
      setIndependent(false);
      setUniform(radii[0] ?? 0);
    } else {
      setIndependent(true);
      applyRadii(radii);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1">
        <button
          type="button"
          title={independent ? "Use single radius for all corners" : "Set corners independently"}
          disabled={locked}
          onClick={toggleIndependent}
          className={cn(
            "mb-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-app-border text-[#a3a3a3] transition-colors",
            locked ? "opacity-40" : "hover:bg-white/10 hover:text-app-fg",
            independent && "border-accent/50 text-accent",
          )}
        >
          {independent ? <Unlink className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
        </button>
        {!independent ? (
          <div className="min-w-0 flex-1">
            <PropertyNumberInput
              commitOnInput={false}
              label="Radius"
              value={radii[0] ?? 0}
              instanceKey={`${instanceKey}-cr`}
              disabled={locked}
              min={0}
              max={999}
              onCommit={setUniform}
            />
          </div>
        ) : null}
      </div>

      {independent ? (
        focusedCornerIndex != null ? (
          <PropertyNumberInput
            commitOnInput={false}
            label={`${CORNER_LABELS[focusedCornerIndex]} radius`}
            value={radii[focusedCornerIndex] ?? 0}
            instanceKey={`${instanceKey}-cr-focus`}
            disabled={locked}
            min={0}
            max={999}
            onCommit={(v) => setCorner(focusedCornerIndex, v)}
          />
        ) : (
          <div className="grid grid-cols-2 gap-x-2 gap-y-1">
            {CORNER_LABELS.map((label, i) => (
              <PropertyNumberInput
                key={label}
                commitOnInput={false}
                label={label}
                value={radii[i as CornerIndex] ?? 0}
                instanceKey={`${instanceKey}-cr-${label}`}
                disabled={locked}
                min={0}
                max={999}
                onCommit={(v) => setCorner(i as CornerIndex, v)}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}
