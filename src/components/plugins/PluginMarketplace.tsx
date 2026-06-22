"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plug2, Search, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  craftPluginsWithInstallState,
  type CraftPlugin,
  type CraftPluginCategory,
} from "@/lib/plugins";
import { Button } from "@/components/ui/button";
import { appFieldClass } from "@/lib/appFieldStyles";
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
    return plugins.filter(
      (p) => (cat === "all" ? true : p.category === cat) && matchesSearch(p, query),
    );
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
      className="fixed inset-0 z-[215] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px] sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Plugins"
      onMouseDown={onBackdrop}
    >
      <div
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <header className="shrink-0 border-b border-app-border-subtle px-5 pb-4 pt-5">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border-subtle bg-app-inset text-app-muted">
              <Plug2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-app-fg">Plugins</h2>
              <p className="mt-0.5 text-ui leading-snug text-app-muted">
                Mock marketplace — no network, no third-party scripts.
              </p>
            </div>
          </div>
        </header>

        <div className="shrink-0 space-y-3 border-b border-app-border-subtle px-5 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-app-subtle"
              strokeWidth={2}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search plugins…"
              className={cn(appFieldClass, "h-9 pl-8")}
            />
          </div>
          <div className="flex flex-wrap gap-1 rounded-xl border border-app-border bg-app-inset p-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCat(c)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-ui font-semibold transition-colors",
                  cat === c
                    ? "border border-app-border bg-app-panel text-app-fg shadow-sm"
                    : "text-app-muted hover:text-app-fg",
                )}
              >
                {c === "all" ? "All" : c}
              </button>
            ))}
          </div>
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {filtered.length === 0 ? (
            <p className="rounded-xl border border-dashed border-app-border bg-app-inset py-10 text-center text-ui-sm text-app-subtle">
              No plugins match your filters.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((p) => (
                <article
                  key={p.id}
                  className="flex flex-col rounded-xl border border-app-border bg-app-raised p-4 shadow-sm transition-colors hover:border-app-border hover:bg-app-hover"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border-subtle bg-app-inset text-lg leading-none">
                        {p.icon}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-ui-sm font-semibold text-app-fg">{p.name}</h3>
                        <p className="section-heading">{p.category}</p>
                      </div>
                    </div>
                    {p.installed ? (
                      <span className="shrink-0 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-ui font-semibold text-accent">
                        Installed
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-3 text-ui leading-snug text-app-muted">
                    {p.description}
                  </p>
                  <p className="mt-1 text-ui text-app-subtle">by {p.author}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.installed ? (
                      <>
                        <Button
                          variant="primary"
                          type="button"
                          className="h-8 px-3 text-ui"
                          onClick={() => run(p.id)}
                        >
                          Run
                        </Button>
                        <Button
                          variant="toolbar"
                          type="button"
                          className="h-8 border border-app-border bg-app-panel px-3 text-app-fg hover:bg-app-hover"
                          onClick={() => uninstall(p.id)}
                        >
                          Uninstall
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="toolbar"
                        type="button"
                        className="h-8 border border-app-border bg-app-panel px-3 text-app-fg hover:bg-app-hover"
                        onClick={() => install(p.id)}
                      >
                        Install
                      </Button>
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
