"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { CANVAS_VISUAL } from "@/lib/canvasVisual";
import { collectPrototypeLinks, prototypeConnectorPath } from "@/lib/prototype";
import { worldRect } from "@/lib/tree";

const WIRE = CANVAS_VISUAL.prototype;

export function PrototypeWireLayer() {
  const editorMode = useEditorStore((s) => s.editorMode);
  const nodes = useEditorStore((s) => s.nodes);
  const selectedPrototypeLinkId = useEditorStore((s) => s.selectedPrototypeLinkId);
  const prototypeWireDrag = useEditorStore((s) => s.prototypeWireDrag);

  const links = useMemo(() => collectPrototypeLinks(nodes), [nodes]);

  const paths = useMemo(() => {
    const out: {
      id: string;
      d: string;
      selected: boolean;
    }[] = [];
    for (const link of links) {
      const src = nodes[link.sourceNodeId];
      if (!src?.visible) continue;
      const wrS = worldRect(link.sourceNodeId, nodes);
      const x1 = wrS.x + wrS.width;
      const y1 = wrS.y + wrS.height / 2;
      let x2 = x1 + 80;
      let y2 = y1;
      if (link.targetFrameId) {
        const t = nodes[link.targetFrameId];
        if (t?.visible && t.type === "frame") {
          const wrT = worldRect(link.targetFrameId, nodes);
          x2 = wrT.x;
          y2 = wrT.y + wrT.height / 2;
        }
      }
      out.push({
        id: link.id,
        d: prototypeConnectorPath(x1, y1, x2, y2),
        selected: link.id === selectedPrototypeLinkId,
      });
    }
    return out;
  }, [links, nodes, selectedPrototypeLinkId]);

  const draft = useMemo(() => {
    if (!prototypeWireDrag) return null;
    const src = nodes[prototypeWireDrag.sourceNodeId];
    if (!src?.visible) return null;
    const wrS = worldRect(prototypeWireDrag.sourceNodeId, nodes);
    const x1 = wrS.x + wrS.width;
    const y1 = wrS.y + wrS.height / 2;
    const { curWX, curWY } = prototypeWireDrag;
    return prototypeConnectorPath(x1, y1, curWX, curWY);
  }, [prototypeWireDrag, nodes]);

  if (editorMode !== "prototype") return null;

  return (
    <svg
      className="pointer-events-none absolute inset-0 z-[8] overflow-visible"
      width={6000}
      height={6000}
      viewBox="0 0 6000 6000"
      aria-hidden
    >
      {paths.map((p) => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke={WIRE}
          strokeWidth={p.selected ? 2 : 1.5}
          strokeOpacity={p.selected ? 1 : 0.7}
          strokeLinecap="round"
        />
      ))}
      {draft ? (
        <path
          d={draft}
          fill="none"
          stroke={WIRE}
          strokeWidth={1.5}
          strokeOpacity={0.85}
          strokeDasharray="5 4"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
