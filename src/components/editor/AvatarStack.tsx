"use client";

import { useEditorStore } from "@/stores/useEditorStore";
import { initialsFromName } from "@/lib/presence";
import { cn } from "@/lib/utils";

export function AvatarStack() {
  const showPresence = useEditorStore((s) => s.showPresence);
  const presenceUsers = useEditorStore((s) => s.presenceUsers);

  if (!showPresence || presenceUsers.length === 0) {
    return null;
  }

  return (
    <div className="flex -space-x-1.5 pl-0.5" aria-label="Collaborators in file">
      {presenceUsers.map((u, i) => (
        <div
          key={u.id}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#2a2a2a] text-[9px] font-bold text-white shadow-sm transition-transform hover:z-10 hover:ring-1 hover:ring-white/25",
          )}
          style={{
            zIndex: 10 - i,
            backgroundColor: u.color,
          }}
          title={u.name}
        >
          {u.avatar ? (
            <span className="text-[10px] leading-none">{u.avatar}</span>
          ) : (
            initialsFromName(u.name)
          )}
        </div>
      ))}
    </div>
  );
}
