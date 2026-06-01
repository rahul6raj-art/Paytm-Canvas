"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plug2, Search, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  craftPluginsWithInstallState,
  type CraftPlugin,
  type CraftPluginCategory,
} from "@/lib/plugins";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CATEGORIES: Array<"all" | CraftPluginCategory> = [
  "all",
  "Design",
  "Productivity",
  "Export",
  "AI",
  "Accessibility",
];

function matchesSearch(p: CraftPlugin, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return (
    p.name.toLowerCase().includes(s) ||
    p.description.toLowerCase().includes(s) ||
    p.author.toLowerCase().includes(s) ||
    p.category.toLowerCase().includes(s)
  );
}

export function PluginMarketplace() {
  const open = useEditorStore((s) => s.pluginMarketplaceOpen);
  const close = useEditorStore((s) => s.closePluginMarketplace);
  const installed = useEditorStore((s) => s.installedPluginIds);
  const install = useEditorStore((s) => s.installPlugin);
  const uninstall = useEditorStore((s) => s.uninstallPlugin);
  const run = useEditorStore((s) => s.runPlugin);

  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<"all" | CraftPluginCategory>("all");

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCat("all");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const plugins = useMemo(() => craftPluginsWithInstallState(installed), [installed]);

  const filtered = useMemo(() => {
    return plugins.filter((p) => (cat === "all" ? true : p.category === cat) && matchesSearch(p, query));
  }, [plugins, cat, query]);

  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) close();
    },
    [close],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[215] flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Plugins"
      onMouseDown={onBackdrop}
    >
      <div
        className="relative my-4 flex max-h-[min(calc(100vh-2rem),720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#1c1c20] to-[#121214] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-emerald-400 via-sky-500 to-violet-500" />
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-300">
              <Plug2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-[16px] font-semibold text-white">Plugins</h2>
              <p className="text-[12px] text-[#9a9a9a]">Mock marketplace — no network, no third-party scripts.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-1.5 text-[#9a9a9a] transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="border-b border-white/[0.06] px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6b6b6b]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins…"
              className="h-9 border-white/[0.08] bg-black/35 pl-8 text-[13px]"
            />
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  cat === c
                    ? "border-sky-500/45 bg-sky-500/15 text-sky-100"
                    : "border-white/[0.08] bg-white/[0.04] text-[#b8b8b8] hover:border-white/[0.14]",
                )}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[min(70vh,560px)] overflow-y-auto px-5 py-4">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/[0.1] bg-black/20 py-10 text-center text-[13px] text-[#8c8c8c]">
              No plugins match your filters.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col rounded-xl border border-white/[0.08] bg-black/25 p-3.5 shadow-inner"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-[18px] leading-none">
                        {p.icon}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-[13px] font-semibold text-white">{p.name}</h3>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-[#6b6b6b]">{p.category}</p>
                      </div>
                    </div>
                    {p.installed ? (
                      <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                        Installed
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-[#a3a3a3]">{p.description}</p>
                  <p className="mt-1 text-[11px] text-[#6b6b6b]">by {p.author}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.installed ? (
                      <>
                        <button
                          type="button"
                          onClick={() => run(p.id)}
                          className="rounded-lg bg-gradient-to-r from-sky-600 to-violet-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:opacity-95"
                        >
                          Run
                        </button>
                        <button
                          type="button"
                          onClick={() => uninstall(p.id)}
                          className="rounded-lg border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-[12px] font-medium text-[#d4d4d4] hover:bg-white/[0.08]"
                        >
                          Uninstall
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => install(p.id)}
                        className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-500/20"
                      >
                        Install
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
