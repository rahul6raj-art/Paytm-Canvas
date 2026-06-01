"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { getPluginById } from "@/lib/plugins";
import {
  accessibilityAuditMock,
  contrastReportFromSelection,
  extractDesignTokens,
  reactExportPreview,
  summarizeSelection,
} from "@/lib/pluginRunner";
import { cn } from "@/lib/utils";

export function PluginRunner() {
  const activeId = useEditorStore((s) => s.activePluginId);
  const close = useEditorStore((s) => s.closeActivePlugin);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const fileName = useEditorStore((s) => s.fileName);
  const applyLorem = useEditorStore((s) => s.applyPluginLoremIpsumToSelection);
  const applyRename = useEditorStore((s) => s.applyPluginRenameSelection);
  const applyIcon = useEditorStore((s) => s.applyPluginIconInSelection);

  const [tick, setTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId) {
      setToast(null);
      setTick(0);
    }
  }, [activeId]);

  useEffect(() => {
    if (!activeId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, close]);

  const meta = activeId ? getPluginById(activeId) : undefined;

  const selectionLines = useMemo(
    () => summarizeSelection(selectedIds, nodes),
    [selectedIds, nodes, tick, activeId],
  );

  const contrast = useMemo(() => {
    if (activeId !== "contrast-checker") return null;
    return contrastReportFromSelection(selectedIds, nodes, childOrder);
  }, [activeId, selectedIds, nodes, childOrder, tick]);

  const tokens = useMemo(() => {
    if (activeId !== "token-extractor") return [];
    return extractDesignTokens(nodes);
  }, [activeId, nodes, tick]);

  const jsxPreview = useMemo(() => {
    if (activeId !== "export-react") return "";
    return reactExportPreview(selectedIds, nodes, childOrder);
  }, [activeId, selectedIds, nodes, childOrder, tick]);

  const audit = useMemo(() => {
    if (activeId !== "accessibility-audit") return [];
    return accessibilityAuditMock(fileName, selectedIds, nodes);
  }, [activeId, fileName, selectedIds, nodes, tick]);

  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) close();
    },
    [close],
  );

  const onApply = useCallback(
    (kind: "lorem" | "rename" | "icon") => {
      if (kind === "lorem") applyLorem();
      if (kind === "rename") applyRename();
      if (kind === "icon") applyIcon();
      setToast("Applied to the document. Undo with ⌘Z / Ctrl+Z.");
      setTimeout(() => setToast(null), 4200);
    },
    [applyLorem, applyRename, applyIcon],
  );

  if (!activeId || !meta) return null;

  const mutating = activeId === "lorem-ipsum" || activeId === "rename-layers" || activeId === "icon-generator";

  return (
    <div
      className="fixed inset-0 z-[225] flex items-center justify-center bg-black/50 px-3 py-8 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Plugin: ${meta.name}`}
      onMouseDown={onBackdrop}
    >
      <div
        className="flex max-h-[min(86vh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-[#161618] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Plugin</p>
            <h2 className="text-[16px] font-semibold text-white">{meta.name}</h2>
            <p className="mt-0.5 text-[12px] text-[#9a9a9a]">{meta.description}</p>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-[#9a9a9a] hover:bg-white/[0.06] hover:text-white"
            aria-label="Close plugin"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <section className="mb-4 rounded-xl border border-white/[0.06] bg-black/30 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Selection</p>
            <ul className="mt-2 space-y-1">
              {selectionLines.map((l, i) => (
                <li key={`${i}-${l.label}`} className="flex justify-between gap-3 text-[12px]">
                  <span className="truncate font-medium text-[#d4d4d4]">{l.label}</span>
                  <span className="shrink-0 text-[#8c8c8c]">{l.value}</span>
                </li>
              ))}
            </ul>
          </section>

          {activeId === "contrast-checker" && contrast ? (
            <section className="space-y-2 rounded-xl border border-white/[0.06] bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Contrast (mock)</p>
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded border border-white/10" style={{ background: contrast.foreground }} />
                  <span className="text-[#a3a3a3]">Text</span>
                </span>
                <span className="text-[#5c5c5c]">vs</span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-5 w-5 rounded border border-white/10" style={{ background: contrast.background }} />
                  <span className="text-[#a3a3a3]">Surface</span>
                </span>
              </div>
              <p className="text-[22px] font-semibold tabular-nums text-white">
                {contrast.ratio != null ? `${contrast.ratio.toFixed(2)} : 1` : "—"}
              </p>
              {contrast.wcag ? (
                <div className="flex flex-wrap gap-2 text-[11px]">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      contrast.wcag.aaNormal ? "bg-emerald-500/15 text-emerald-200" : "bg-rose-500/15 text-rose-100",
                    )}
                  >
                    AA normal {contrast.wcag.aaNormal ? "pass" : "fail"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      contrast.wcag.aaLarge ? "bg-emerald-500/15 text-emerald-200" : "bg-amber-500/15 text-amber-100",
                    )}
                  >
                    AA large {contrast.wcag.aaLarge ? "pass" : "fail"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      contrast.wcag.aaaNormal ? "bg-sky-500/15 text-sky-100" : "bg-white/[0.06] text-[#b8b8b8]",
                    )}
                  >
                    AAA normal {contrast.wcag.aaaNormal ? "pass" : "—"}
                  </span>
                </div>
              ) : null}
              <p className="text-[12px] leading-relaxed text-[#a3a3a3]">{contrast.note}</p>
            </section>
          ) : null}

          {activeId === "token-extractor" ? (
            <section className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Tokens (document)</p>
              <div className="mt-2 max-h-52 overflow-y-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#161618] text-[#6b6b6b]">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Kind</th>
                      <th className="py-1 pr-2 font-medium">Value</th>
                      <th className="py-1 font-medium">Uses</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#d4d4d4]">
                    {tokens.map((t) => (
                      <tr key={`${t.kind}-${t.value}`} className="border-t border-white/[0.04]">
                        <td className="py-1 pr-2 capitalize text-[#8c8c8c]">{t.kind}</td>
                        <td className="py-1 pr-2 font-mono text-[11px]">{t.value}</td>
                        <td className="py-1 tabular-nums text-[#8c8c8c]">{t.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {tokens.length === 0 ? <p className="py-4 text-center text-[12px] text-[#6b6b6b]">No tokens found.</p> : null}
              </div>
            </section>
          ) : null}

          {activeId === "export-react" ? (
            <section className="rounded-xl border border-white/[0.06] bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">JSX preview</p>
              <pre className="thin-scroll mt-2 max-h-52 overflow-auto rounded-lg bg-black/50 p-3 text-[11px] leading-relaxed text-emerald-100/90">
                {jsxPreview}
              </pre>
            </section>
          ) : null}

          {activeId === "accessibility-audit" ? (
            <section className="space-y-2 rounded-xl border border-white/[0.06] bg-black/30 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Checklist (mock)</p>
              <ul className="space-y-2">
                {audit.map((a, i) => (
                  <li
                    key={`${a.title}-${i}`}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-[12px]",
                      a.severity === "pass" && "border-emerald-500/20 bg-emerald-500/5 text-emerald-50",
                      a.severity === "warn" && "border-amber-500/25 bg-amber-500/5 text-amber-50",
                      a.severity === "info" && "border-white/[0.06] bg-white/[0.03] text-[#d4d4d4]",
                    )}
                  >
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-0.5 text-[11px] leading-snug text-[#a3a3a3]">{a.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {activeId === "lorem-ipsum" ? (
            <section className="rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[12px] text-[#a3a3a3]">
              Replaces <span className="font-medium text-white">directly selected</span> text layers with deterministic
              lorem ipsum. Choose text on the canvas, then apply.
            </section>
          ) : null}

          {activeId === "rename-layers" ? (
            <section className="rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[12px] text-[#a3a3a3]">
              Renames <span className="font-medium text-white">top-level selected</span> layers using short type-based
              names (Screen, Card, Label, …).
            </section>
          ) : null}

          {activeId === "icon-generator" ? (
            <section className="rounded-xl border border-white/[0.06] bg-black/30 p-3 text-[12px] text-[#a3a3a3]">
              Adds a small <span className="font-medium text-white">vector group</span> with a path mark into the
              resolved target frame (selected frame, ancestor frame, or first artboard).
            </section>
          ) : null}

          {toast ? (
            <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100">
              {toast}
            </p>
          ) : null}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-black/25 px-5 py-3">
          <button
            type="button"
            onClick={() => setTick((x) => x + 1)}
            className="text-[12px] font-medium text-[#8c8c8c] hover:text-white"
          >
            Refresh scan
          </button>
          <div className="flex gap-2">
            {mutating ? (
              <>
                {activeId === "lorem-ipsum" ? (
                  <button
                    type="button"
                    onClick={() => onApply("lorem")}
                    className="rounded-lg bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    Apply to text
                  </button>
                ) : null}
                {activeId === "rename-layers" ? (
                  <button
                    type="button"
                    onClick={() => onApply("rename")}
                    className="rounded-lg bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    Rename selection
                  </button>
                ) : null}
                {activeId === "icon-generator" ? (
                  <button
                    type="button"
                    onClick={() => onApply("icon")}
                    className="rounded-lg bg-gradient-to-r from-sky-600 to-violet-600 px-4 py-2 text-[12px] font-semibold text-white shadow-sm hover:opacity-95"
                  >
                    Insert icon mark
                  </button>
                ) : null}
              </>
            ) : null}
            <button
              type="button"
              onClick={close}
              className="rounded-lg border border-white/[0.1] bg-white/[0.05] px-4 py-2 text-[12px] font-medium text-white hover:bg-white/[0.09]"
            >
              Done
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
