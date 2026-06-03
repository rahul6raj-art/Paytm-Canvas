"use client";

import { LayersPanel } from "./LayersPanel";
import { ComponentsPanel } from "./ComponentsPanel";
import { AssetsPanel } from "./AssetsPanel";
import { StylesPanel } from "./StylesPanel";
import { PagesPanel } from "./PagesPanel";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";

export function LeftSidebar() {
  const leftTab = useEditorStore((s) => s.leftTab);
  const setLeftTab = useEditorStore((s) => s.setLeftTab);

  return (
    <aside className="flex w-[min(240px,28vw)] min-w-[180px] max-w-[260px] shrink-0 flex-col border-r border-app-border bg-chrome-panel shadow-app-panel">
      <div className="flex h-8 shrink-0 border-b border-app-border">
        {(["layers", "components", "assets", "styles"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setLeftTab(t)}
            className={cn(
              "relative flex-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              leftTab === t
                ? "text-app-fg after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:rounded-full after:bg-accent"
                : "text-app-subtle hover:text-app-fg",
            )}
          >
            {t === "layers"
              ? "Layers"
              : t === "components"
                ? "Comp"
                : t === "assets"
                  ? "Assets"
                  : "Library"}
          </button>
        ))}
      </div>

      {leftTab === "layers" && (
        <>
          <PagesPanel />
          <LayersPanel />
        </>
      )}

      {leftTab === "components" && <ComponentsPanel />}

      {leftTab === "assets" && <AssetsPanel />}

      {leftTab === "styles" && <StylesPanel />}
    </aside>
  );
}
