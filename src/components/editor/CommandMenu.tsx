"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  ALL_COMMANDS,
  COMMAND_BY_ID,
  type CommandCategory,
  type CommandDefinition,
  formatShortcutLabel,
  groupCommandsByCategory,
  pushRecentCommandId,
  readRecentCommandIds,
  searchCommands,
} from "@/lib/commands";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: CommandCategory[] = [
  "Tools",
  "Editing",
  "Arrange",
  "Actions",
  "Modes",
  "View",
  "Plugins",
  "Workspace",
  "Files",
];

function matchesQuery(c: CommandDefinition, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    c.title.toLowerCase().includes(s) ||
    c.subtitle.toLowerCase().includes(s) ||
    c.category.toLowerCase().includes(s) ||
    c.keywords?.some((k) => k.toLowerCase().includes(s)) === true
  );
}

export function CommandMenu() {
  const open = useEditorStore((s) => s.commandMenuOpen);
  const setOpen = useEditorStore((s) => s.setCommandMenuOpen);
  const storeSlice = useEditorStore(
    useShallow((s) => ({
      selectedIds: s.selectedIds,
      editorMode: s.editorMode,
      tool: s.tool,
      childOrder: s.childOrder,
      nodes: s.nodes,
      installedPluginIds: s.installedPluginIds,
    })),
  );

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const snapshot = useEditorStore.getState;

  const filtered = useMemo(() => searchCommands(query, snapshot()), [query, storeSlice]);

  const { groupedRows, flatIds } = useMemo(() => {
    const st = snapshot();
    const q = query.trim();
    const recentIds = readRecentCommandIds();
    const recentCmds: CommandDefinition[] = [];
    const seen = new Set<string>();
    for (const rid of recentIds) {
      const c = COMMAND_BY_ID[rid];
      if (!c || !c.enabled(st) || !matchesQuery(c, q)) continue;
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      recentCmds.push(c);
    }

    const rest = filtered.filter((c) => !seen.has(c.id));
    const grouped = groupCommandsByCategory(rest);

    const rows: Array<{ type: "header"; label: string } | { type: "cmd"; cmd: CommandDefinition }> = [];
    if (recentCmds.length > 0) {
      rows.push({ type: "header", label: "Recent" });
      for (const c of recentCmds) rows.push({ type: "cmd", cmd: c });
    }
    for (const cat of CATEGORY_ORDER) {
      const list = grouped.get(cat) ?? [];
      if (list.length === 0) continue;
      rows.push({ type: "header", label: cat });
      for (const c of list) rows.push({ type: "cmd", cmd: c });
    }

    const flatIds = rows.filter((r): r is { type: "cmd"; cmd: CommandDefinition } => r.type === "cmd").map((r) => r.cmd.id);
    return { groupedRows: rows, flatIds };
  }, [filtered, query, storeSlice]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedId(null);
    queueMicrotask(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (flatIds.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !flatIds.includes(selectedId)) {
      setSelectedId(flatIds[0]!);
    }
  }, [open, flatIds, selectedId]);

  const runCommand = useCallback(
    (cmd: CommandDefinition) => {
      const st = snapshot();
      if (!cmd.enabled(st)) return;
      cmd.run(st);
      pushRecentCommandId(cmd.id);
      setOpen(false);
      setQuery("");
      setSelectedId(null);
    },
    [setOpen, snapshot],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (flatIds.length === 0) return;
        const i = selectedId ? flatIds.indexOf(selectedId) : -1;
        const next = flatIds[Math.min(i + 1, flatIds.length - 1)]!;
        setSelectedId(next);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (flatIds.length === 0) return;
        const i = selectedId ? flatIds.indexOf(selectedId) : 0;
        const next = flatIds[Math.max(i - 1, 0)]!;
        setSelectedId(next);
        return;
      }
      if (e.key === "Enter") {
        if (!selectedId) return;
        const cmd = COMMAND_BY_ID[selectedId];
        if (!cmd) return;
        e.preventDefault();
        runCommand(cmd);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, flatIds, selectedId, runCommand, setOpen]);

  useEffect(() => {
    if (!open || !selectedId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-command-id="${selectedId}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [open, selectedId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/55 pt-[12vh] px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        className="flex max-h-[min(90vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/[0.1] bg-[#1a1a1a]/95 shadow-2xl backdrop-blur-md"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/[0.06] px-2 py-1.5">
          <input
            ref={inputRef}
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search commands…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-8 w-full rounded-md border border-transparent bg-white/[0.04] px-2 text-[12px] text-[#ececec] outline-none ring-0 placeholder:text-[#6b6b6b] focus:border-accent/40"
          />
        </div>
        <div ref={listRef} className="max-h-[min(52vh,420px)] overflow-y-auto py-1">
          {groupedRows.length === 0 ? (
            <p className="px-3 py-4 text-center text-[12px] text-[#7a7a7a]">No matching commands.</p>
          ) : (
            groupedRows.map((row, idx) =>
              row.type === "header" ? (
                <div
                  key={`h-${row.label}-${idx}`}
                  className="sticky top-0 z-[1] bg-[#1a1a1a]/95 px-3 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]"
                >
                  {row.label}
                </div>
              ) : (
                <button
                  key={row.cmd.id}
                  type="button"
                  data-command-id={row.cmd.id}
                  onMouseEnter={() => setSelectedId(row.cmd.id)}
                  onClick={() => runCommand(row.cmd)}
                  disabled={!row.cmd.enabled(snapshot())}
                  className={cn(
                    "flex w-full items-start gap-2 px-3 py-1.5 text-left text-[12px] leading-snug transition-colors",
                    row.cmd.id === selectedId ? "bg-accent/18 text-white" : "text-[#d4d4d4] hover:bg-white/[0.05]",
                    !row.cmd.enabled(snapshot()) && "cursor-not-allowed opacity-40 hover:bg-transparent",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{row.cmd.title}</div>
                    <div className="text-[11px] text-[#7a7a7a]">{row.cmd.subtitle}</div>
                  </div>
                  {row.cmd.shortcut ? (
                    <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-[#6b6b6b]">
                      {formatShortcutLabel(row.cmd.shortcut)}
                    </span>
                  ) : null}
                </button>
              ),
            )
          )}
        </div>
        <div className="flex items-center justify-between border-t border-white/[0.06] px-3 py-1 text-[10px] text-[#5c5c5c]">
          <span>↑↓ navigate · ↵ run · esc close</span>
          <span>{ALL_COMMANDS.length} commands</span>
        </div>
      </div>
    </div>
  );
}
