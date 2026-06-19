"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

/** Brief feedback when Send to code writes (or fails) on the linked source file. */
export function CraftBridgeSyncToast() {
  const status = useEditorStore((s) => s.craftBridgeSyncStatus);
  const error = useEditorStore((s) => s.craftBridgeSyncError);
  const link = useEditorStore((s) => s.codeRoundTripLink);
  const setCraftBridgeSyncStatus = useEditorStore((s) => s.setCraftBridgeSyncStatus);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (status === "idle") {
      setVisible(false);
      return;
    }
    setVisible(true);
    if (status === "synced" || status === "error") {
      const t = window.setTimeout(() => {
        setVisible(false);
        setCraftBridgeSyncStatus("idle", null);
      }, 4200);
      return () => window.clearTimeout(t);
    }
  }, [status, setCraftBridgeSyncStatus]);

  if (!visible || status === "idle") return null;

  const file = link?.sourcePath?.split("/").pop();

  return (
    <div
      className={cn(
        "pointer-events-auto fixed bottom-6 left-1/2 z-[240] flex max-w-[min(92vw,420px)] -translate-x-1/2 items-start gap-2 rounded-xl border px-3 py-2.5 text-ui shadow-2xl",
        status === "error"
          ? "border-red-500/35 bg-[#2a1518] text-red-100"
          : "border-emerald-500/35 bg-[#14261c] text-emerald-50",
      )}
      role="status"
    >
      {status === "syncing" ? (
        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
      ) : status === "error" ? (
        <X className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Check className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="min-w-0">
        {status === "syncing" ? (
          <p>
            Updating source{file ? `: ${file}` : ""}
            {link?.previewUrl ? " (text only)…" : link?.cssPaths?.length ? " + CSS…" : "…"}
          </p>
        ) : status === "error" ? (
          <p>{error ?? "Could not update source file."}</p>
        ) : (
          <p>
            Updated source{file ? `: ${file}` : ""}
            {link?.previewUrl ? (
              <span className="mt-0.5 block truncate text-emerald-200/80">
                Text props only — canvas layout unchanged
              </span>
            ) : link?.cssPaths?.length ? (
              <span className="mt-0.5 block truncate text-emerald-200/80">
                + {link.cssPaths.map((p) => p.split("/").pop()).join(", ")}
              </span>
            ) : link?.sourcePath ? (
              <span className="mt-0.5 block truncate text-emerald-200/80">{link.sourcePath}</span>
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}
