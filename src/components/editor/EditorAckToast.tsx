"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import {
  CANVAS_TOOL_RAIL_ACK_TOAST_BOTTOM_OFFSET,
} from "@/lib/canvasToolRail";
import { useEditorStore } from "@/stores/useEditorStore";

const TOAST_DISMISS_MS = 2_400;
const TOAST_RAIL_GAP_PX = 10;

type ToastAnchor = { left: number; bottom: number };

/** Keep the ack toast centered above the canvas tool rail (follows drag). */
function useAnchoredAboveCanvasToolRail(active: boolean): ToastAnchor | null {
  const [anchor, setAnchor] = useState<ToastAnchor | null>(null);

  useEffect(() => {
    if (!active) {
      setAnchor(null);
      return;
    }

    let raf = 0;
    const measure = () => {
      const rail = document.querySelector("[data-canvas-tool-rail]");
      if (!(rail instanceof HTMLElement)) {
        setAnchor(null);
        return;
      }
      const rect = rail.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        setAnchor(null);
        return;
      }
      setAnchor({
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + TOAST_RAIL_GAP_PX,
      });
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    schedule();
    window.addEventListener("resize", schedule);
    document.addEventListener("pointermove", schedule, { capture: true });

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      document.removeEventListener("pointermove", schedule, { capture: true });
    };
  }, [active]);

  return anchor;
}

/** Brief success/error acknowledgment (copy as PNG, etc.). */
export function EditorAckToast() {
  const message = useEditorStore((s) => s.ackToast);
  const setAckToast = useEditorStore((s) => s.setAckToast);
  const anchor = useAnchoredAboveCanvasToolRail(Boolean(message));

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => setAckToast(null), TOAST_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [message, setAckToast]);

  if (!message) return null;

  const isError = /could not|failed|error/i.test(message);

  return (
    <div
      className="pointer-events-auto fixed z-[245] w-[min(92vw,24rem)] -translate-x-1/2"
      style={
        anchor
          ? { left: anchor.left, bottom: anchor.bottom }
          : {
              left: "50%",
              bottom: `${CANVAS_TOOL_RAIL_ACK_TOAST_BOTTOM_OFFSET}px`,
            }
      }
      role="status"
      aria-live="polite"
    >
      <div
        className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 shadow-xl ${
          isError
            ? "border-red-500/40 bg-[#2a1518] text-red-100"
            : "border-app-border bg-app-panel text-app-fg"
        }`}
      >
        {isError ? (
          <X className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
        )}
        <p className="flex-1 text-ui-sm">{message}</p>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-app-subtle hover:bg-app-hover hover:text-app-fg"
          aria-label="Dismiss"
          onClick={() => setAckToast(null)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
