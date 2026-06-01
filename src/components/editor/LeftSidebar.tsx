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
    <aside className="flex w-[min(240px,28vw)] min-w-[180px] max-w-[260px] shrink-0 flex-col border-r border-black/30 bg-chrome-panel shadow-panel">
      <div className="flex h-8 shrink-0 border-b border-black/30">
        {(["layers", "components", "assets", "styles"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setLeftTab(t)}
            className={cn(
              "relative flex-1 text-[10px] font-semibold uppercase tracking-wide transition-colors",
              leftTab === t
                ? "text-white after:absolute after:bottom-0 after:left-1 after:right-1 after:h-0.5 after:rounded-full after:bg-accent"
                : "text-[#7a7a7a] hover:text-[#d4d4d4]",
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
