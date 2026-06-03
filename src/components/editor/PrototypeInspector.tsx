"use client";

import { useMemo } from "react";
import { useEditorStore, type EditorNode } from "@/stores/useEditorStore";
import { defaultPrototypeLink, type PrototypeAction, type PrototypeTransition, type PrototypeTrigger } from "@/lib/prototype";

function frameOptions(nodes: Record<string, EditorNode>): { id: string; name: string }[] {
  return Object.values(nodes)
    .filter((n) => n.type === "frame" && n.visible)
    .map((n) => ({ id: n.id, name: n.name }));
}

export function PrototypeInspector({ node }: { node: EditorNode }) {
  const nodes = useEditorStore((s) => s.nodes);
  const selectedPrototypeLinkId = useEditorStore((s) => s.selectedPrototypeLinkId);
  const updatePrototypeLink = useEditorStore((s) => s.updatePrototypeLink);
  const deletePrototypeLink = useEditorStore((s) => s.deletePrototypeLink);
  const setSelectedPrototypeLinkId = useEditorStore((s) => s.setSelectedPrototypeLinkId);
  const updateNode = useEditorStore((s) => s.updateNode);

  const frames = useMemo(() => frameOptions(nodes), [nodes]);

  const links = node.prototypeLinks ?? [];
  const displayLink = useMemo(() => {
    if (selectedPrototypeLinkId) return links.find((l) => l.id === selectedPrototypeLinkId) ?? null;
    return links[0] ?? null;
  }, [links, selectedPrototypeLinkId]);

  const addInteraction = () => {
    const raw = nodes[node.id];
    if (!raw) return;
    const target =
      frames.find((f) => f.id !== node.id)?.id ??
      frames[0]?.id;
    const link = defaultPrototypeLink(node.id, target);
    updateNode(node.id, {
      prototypeLinks: [...(raw.prototypeLinks ?? []), link],
    });
    setSelectedPrototypeLinkId(link.id);
  };

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-app-subtle">Interactions</p>
        <button
          type="button"
          onClick={addInteraction}
          className="rounded-md border border-white/10 bg-app-hover px-2 py-1 text-[11px] font-medium text-app-fg transition-colors hover:border-accent/40 hover:bg-accent/10"
        >
          Add interaction
        </button>
      </div>

      {links.length > 0 ? (
        <ul className="space-y-1">
          {links.map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setSelectedPrototypeLinkId(l.id)}
                className={
                  l.id === selectedPrototypeLinkId ||
                  (!selectedPrototypeLinkId && links[0]?.id === l.id)
                    ? "w-full rounded-md border border-accent/45 bg-accent/10 px-2 py-1.5 text-left text-[11px] text-white"
                    : "w-full rounded-md border border-transparent px-2 py-1.5 text-left text-[11px] text-app-muted hover:border-white/10 hover:bg-app-hover"
                }
              >
                {l.trigger} → {l.action}
                {l.targetFrameId ? ` · ${nodes[l.targetFrameId]?.name ?? "Frame"}` : ""}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[12px] leading-relaxed text-app-subtle">No interactions yet. Drag the blue handle on the canvas to wire to a frame, or add one here.</p>
      )}

      {displayLink ? (
        <div className="space-y-2 border-t border-app-border-subtle pt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-app-subtle">Selected interaction</p>

          <label className="block space-y-1">
            <span className="text-[10px] text-app-subtle">Trigger</span>
            <select
              className="h-8 w-full rounded-md border border-white/10 bg-app-panel px-2 text-[12px] text-app-fg outline-none focus:border-accent/50"
              value={displayLink.trigger}
              onChange={(e) =>
                updatePrototypeLink(displayLink.id, { trigger: e.target.value as PrototypeTrigger })
              }
            >
              <option value="click">Click</option>
              <option value="hover">Hover</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] text-app-subtle">Action</span>
            <select
              className="h-8 w-full rounded-md border border-white/10 bg-app-panel px-2 text-[12px] text-app-fg outline-none focus:border-accent/50"
              value={displayLink.action}
              onChange={(e) =>
                updatePrototypeLink(displayLink.id, { action: e.target.value as PrototypeAction })
              }
            >
              <option value="navigate">Navigate</option>
              <option value="open-overlay">Open overlay</option>
              <option value="back">Back</option>
            </select>
          </label>

          {displayLink.action !== "back" ? (
            <label className="block space-y-1">
              <span className="text-[10px] text-app-subtle">Destination frame</span>
              <select
                className="h-8 w-full rounded-md border border-white/10 bg-app-panel px-2 text-[12px] text-app-fg outline-none focus:border-accent/50"
                value={displayLink.targetFrameId ?? ""}
                onChange={(e) =>
                  updatePrototypeLink(displayLink.id, {
                    targetFrameId: e.target.value || undefined,
                  })
                }
              >
                <option value="">—</option>
                {frames.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block space-y-1">
            <span className="text-[10px] text-app-subtle">Transition</span>
            <select
              className="h-8 w-full rounded-md border border-white/10 bg-app-panel px-2 text-[12px] text-app-fg outline-none focus:border-accent/50"
              value={displayLink.transition}
              onChange={(e) =>
                updatePrototypeLink(displayLink.id, { transition: e.target.value as PrototypeTransition })
              }
            >
              <option value="instant">Instant</option>
              <option value="dissolve">Dissolve</option>
              <option value="slide-left">Slide left</option>
              <option value="slide-right">Slide right</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => deletePrototypeLink(displayLink.id)}
            className="w-full rounded-md border border-red-500/25 bg-red-500/10 py-1.5 text-[11px] font-medium text-red-200/90 hover:bg-red-500/20"
          >
            Delete interaction
          </button>
        </div>
      ) : null}
    </div>
  );
}
