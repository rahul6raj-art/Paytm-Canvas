"use client";

import { useMemo } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { worldRect } from "@/lib/tree";
import { initialsFromName } from "@/lib/presence";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

function CursorGlyph({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" className="overflow-visible" aria-hidden>
      <path
        d="M2 2 L2 17 L6.5 12.5 L10 22 L12.5 20.5 L9 11 L15 11 Z"
        fill={color}
        stroke="rgba(0,0,0,0.55)"
        strokeWidth="1"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function PresenceLayer() {
  const showPresence = useEditorStore((s) => s.showPresence);
  const prototypePreview = useEditorStore((s) => s.prototypePreview);
  const presenceUsers = useEditorStore((s) => s.presenceUsers);
  const nodes = useEditorStore((s) => s.nodes);

  const remoteSelections = useMemo(() => {
    type Row = { userId: string; name: string; color: string; x: number; y: number; width: number; height: number };
    const rows: Row[] = [];
    for (const u of presenceUsers) {
      for (const nid of u.selectedNodeIds) {
        const n = nodes[nid];
        if (!n?.visible) continue;
        const wr = worldRect(nid, nodes);
        if (wr.width <= 0 && wr.height <= 0) continue;
        rows.push({
          userId: u.id,
          name: u.name,
          color: u.color,
          x: wr.x,
          y: wr.y,
          width: wr.width,
          height: wr.height,
        });
      }
    }
    return rows;
  }, [presenceUsers, nodes]);

  if (!showPresence || prototypePreview || presenceUsers.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[55] overflow-visible">
      {remoteSelections.map((r, i) => (
        <div key={`${r.userId}-${i}-${r.x}-${r.y}`} className="absolute" style={{ left: r.x, top: r.y, width: r.width, height: r.height }}>
          <div
            className="absolute inset-0 rounded-[2px] border-2 border-dashed opacity-90"
            style={{ borderColor: r.color }}
          />
          <EditorHintWrap title={r.name} anchorClassName="contents">
            <div
              className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full border border-black/40 px-1 text-ui font-bold text-white shadow-sm"
              style={{ backgroundColor: r.color }}
            >
              {initialsFromName(r.name)}
            </div>
          </EditorHintWrap>
        </div>
      ))}

      {presenceUsers.map((u) => (
        <div key={u.id} className="absolute" style={{ left: u.cursor.x, top: u.cursor.y, transform: "translate(2px, 2px)" }}>
          <CursorGlyph color={u.color} />
          <div
            className={cn(
              "absolute left-[14px] top-[16px] max-w-[140px] truncate rounded-md border px-1.5 py-0.5 text-ui font-semibold shadow-md",
            )}
            style={{
              borderColor: `${u.color}aa`,
              backgroundColor: "rgba(20,20,20,0.92)",
              color: "#f5f5f5",
            }}
          >
            {u.name}
          </div>
        </div>
      ))}
    </div>
  );
}
