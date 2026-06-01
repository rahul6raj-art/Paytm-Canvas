"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/stores/useEditorStore";
import { formatShortcutLabel } from "@/lib/commands";
import { cn } from "@/lib/utils";

type Row = { keys: string; label: string };

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <section className="mb-4 last:mb-0">
      <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">{title}</h3>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={`${title}-${r.keys}-${r.label}`} className="flex items-baseline justify-between gap-4 text-[12px] leading-snug">
            <span className="text-[#c4c4c4]">{r.label}</span>
            <span className="shrink-0 text-right text-[11px] tabular-nums text-[#6b6b6b]">{formatShortcutLabel(r.keys)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TOOLS: Row[] = [
  { keys: "V", label: "Move tool" },
  { keys: "F", label: "Frame tool — device presets & draw custom" },
  { keys: "R", label: "Rectangle tool" },
  { keys: "O", label: "Ellipse tool" },
  { keys: "L", label: "Line tool" },
  { keys: "⇧L", label: "Arrow tool" },
  { keys: "P", label: "Pen tool" },
  { keys: "T", label: "Text tool" },
  { keys: "", label: "Polygon / Star (shape menu)" },
  { keys: "H", label: "Hand tool" },
];

const EDITING: Row[] = [
  { keys: "⌘Z", label: "Undo" },
  { keys: "⌘⇧Z", label: "Redo" },
  { keys: "⌘Y", label: "Redo (alternate)" },
  { keys: "⌘C", label: "Copy" },
  { keys: "⌘X", label: "Cut" },
  { keys: "⌘V", label: "Paste" },
  { keys: "⌘⇧V", label: "Paste in place" },
  { keys: "⌘A", label: "Select all (visible, unlocked)" },
  { keys: "⌘L", label: "Lock / unlock selection" },
  { keys: "⌘⇧H", label: "Hide / show selection" },
  { keys: "⌘D", label: "Duplicate selection" },
  { keys: "⌫", label: "Delete selection" },
  { keys: "⌘G", label: "Group selection" },
  { keys: "⌘⇧G", label: "Ungroup selection" },
];

const ARRANGE: Row[] = [
  { keys: "⌘]", label: "Bring forward" },
  { keys: "⌘[", label: "Send backward" },
  { keys: "⌘⇧]", label: "Bring to front" },
  { keys: "⌘⇧[", label: "Send to back" },
  { keys: "", label: "Align & distribute (context menu or command palette)" },
];

const MOVE: Row[] = [
  { keys: "↑ ↓ ← →", label: "Nudge selection 1px" },
  { keys: "⇧↑ ↓ ← →", label: "Nudge selection 10px" },
  { keys: "⇧ (drag handle)", label: "Resize with locked aspect ratio" },
  { keys: "⇧ (drag shape)", label: "Draw square / circle / constrain line" },
  { keys: "⌥ (drag shape)", label: "Draw from center" },
  { keys: "⇧ (rotate handle)", label: "Snap rotation to 15°" },
];

const VIEW: Row[] = [
  { keys: "⌘+", label: "Zoom in" },
  { keys: "⌘−", label: "Zoom out" },
  { keys: "", label: "Toggle layout grid (command palette)" },
  { keys: "", label: "Toggle mock presence (command palette)" },
  { keys: "", label: "Toggle comments (command palette)" },
  { keys: "", label: "Open styles panel (command palette)" },
  { keys: "", label: "Open AI generator (command palette)" },
  { keys: "", label: "Help → demo checklist (command palette or toolbar)" },
  { keys: "⌘.", label: "Show / hide UI (panels & toolbar)" },
  { keys: "⌘K", label: "Command menu" },
  { keys: "⌘/", label: "Keyboard shortcuts overlay" },
];

const FILES: Row[] = [
  { keys: "", label: "Save, import, export — File menu (toolbar)" },
  { keys: "", label: "Open version history (command palette)" },
  { keys: "", label: "Open plugins marketplace (command palette)" },
];

const PROTOTYPE: Row[] = [
  { keys: "", label: "Prototype mode (toolbar tabs)" },
  { keys: "", label: "Present prototype (toolbar)" },
];

const CANVAS: Row[] = [
  { keys: "Esc", label: "Cancel marquee, path, comment placement, or clear selection" },
];

export function ShortcutOverlay() {
  const open = useEditorStore((s) => s.shortcutOverlayOpen);
  const setOpen = useEditorStore((s) => s.setShortcutOverlayOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="max-h-[min(80vh,640px)] w-full max-w-md overflow-y-auto rounded-lg border border-white/[0.1] bg-[#1a1a1a]/95 p-4 shadow-2xl backdrop-blur-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h2 className="text-[14px] font-semibold text-white">Keyboard shortcuts</h2>
            <p className="mt-0.5 text-[11px] text-[#7a7a7a]">⌘ = Ctrl on Windows / Linux</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className={cn(
              "rounded-md border border-white/[0.08] px-2 py-1 text-[11px] font-medium text-[#b8b8b8]",
              "hover:bg-white/[0.06] hover:text-white",
            )}
          >
            Close
          </button>
        </div>
        <div className="columns-1 sm:columns-2 sm:gap-6">
          <div className="break-inside-avoid">
            <Section title="Tools" rows={TOOLS} />
            <Section title="Editing" rows={EDITING} />
            <Section title="Move & resize" rows={MOVE} />
            <Section title="Arrange" rows={ARRANGE} />
          </div>
          <div className="break-inside-avoid">
            <Section title="View" rows={VIEW} />
            <Section title="Files" rows={FILES} />
            <Section title="Prototype" rows={PROTOTYPE} />
            <Section title="Canvas" rows={CANVAS} />
          </div>
        </div>
      </div>
    </div>
  );
}
