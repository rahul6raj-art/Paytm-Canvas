"use client";

import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function PresenceActivityFeed() {
  const showPresence = useEditorStore((s) => s.showPresence);
  const prototypePreview = useEditorStore((s) => s.prototypePreview);
  const entries = useEditorStore((s) => s.presenceActivityLog);

  if (!showPresence || prototypePreview) return null;

  const slice = entries.slice(0, 6);

  return (
    <div className="flex max-w-[min(52vw,420px)] min-w-0 flex-1 flex-col items-end justify-center text-right">
      <span className="section-heading mb-0.5">Activity</span>
      <ul className="max-h-[52px] w-full space-y-0.5 overflow-hidden text-ui leading-snug text-app-subtle">
        {slice.length === 0 ? (
          <li className="text-app-subtle">Collaborators will appear here.</li>
        ) : (
          slice.map((e) => (
            <li key={e.id} className="flex justify-end gap-1.5 truncate tabular-nums">
              <span className="shrink-0 text-app-subtle">{formatTime(e.at)}</span>
              <span className={cn("min-w-0 truncate text-[#d6d6d6]")}>{e.text}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
