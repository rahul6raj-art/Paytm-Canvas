"use client";

import { useRef, useState } from "react";
import { ChevronDown, PanelLeft } from "lucide-react";
import { PaytmCraftLogo } from "@/components/PaytmCraftLogo";
import { EditorNestedMenuDropdown } from "./menu/EditorNestedMenuDropdown";
import { EditorHintWrap } from "./EditorHoverHint";

export function EditorSidebarBrandHeader({
  sidebarVisible,
  onToggleSidebar,
}: {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
}) {
  const [logoMenuOpen, setLogoMenuOpen] = useState(false);
  const logoMenuRef = useRef<HTMLDivElement>(null);
  const logoAnchorRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="editor-sidebar-section flex shrink-0 items-center gap-3 px-3 py-1.5">
      <div className="relative min-w-0 flex-1" ref={logoMenuRef}>
        <button
          ref={logoAnchorRef}
          type="button"
          aria-expanded={logoMenuOpen}
          aria-haspopup="menu"
          className="flex h-9 min-w-0 w-full items-center gap-3 rounded-lg text-ui font-semibold text-app-fg transition-colors hover:bg-app-hover"
          onClick={() => setLogoMenuOpen((o) => !o)}
        >
          <PaytmCraftLogo className="size-icon-ui shrink-0" />
          <span className="truncate">Paytm Craft</span>
          <ChevronDown className="size-icon-ui shrink-0 text-app-subtle" strokeWidth={2} />
        </button>
        <EditorNestedMenuDropdown
          open={logoMenuOpen}
          onClose={() => setLogoMenuOpen(false)}
          anchorRef={logoAnchorRef}
        />
      </div>
      <div className="mx-0.5 h-5 w-px shrink-0 bg-app-panel-edge" aria-hidden />
      <EditorHintWrap title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}>
        <button
          type="button"
          aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          aria-pressed={sidebarVisible}
          onClick={onToggleSidebar}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
        >
          <PanelLeft className="size-icon-ui" strokeWidth={1.75} />
        </button>
      </EditorHintWrap>
    </div>
  );
}
