"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CircleHelp,
  LogOut,
  Play,
  Plug2,
  Share2,
  Sparkles,
  Users,
} from "lucide-react";
import { AvatarStack } from "./AvatarStack";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEditorStore } from "@/stores/useEditorStore";
import { cn } from "@/lib/utils";
import { DEFAULT_MOCK_WORKSPACE, getActiveMockWorkspace, getMockCurrentUser, subscribeMockAuth } from "@/lib/mockAuth";
import { isPaytmCraftRemoteMode } from "@/lib/env";
import { signOutRemoteSession } from "@/lib/remoteAuthSession";
import { EditorHintWrap } from "./EditorHoverHint";

export function EditorMenuBarTrailing() {
  const router = useRouter();
  const openPrototypePreview = useEditorStore((s) => s.openPrototypePreview);
  const openShareModal = useEditorStore((s) => s.openShareModal);
  const openHelpDemoChecklist = useEditorStore((s) => s.openHelpDemoChecklist);
  const openAIModal = useEditorStore((s) => s.openAIModal);
  const openPluginMarketplace = useEditorStore((s) => s.openPluginMarketplace);
  const showPresence = useEditorStore((s) => s.showPresence);
  const presenceUsers = useEditorStore((s) => s.presenceUsers);
  const togglePresence = useEditorStore((s) => s.togglePresence);

  const workspace = useSyncExternalStore(
    subscribeMockAuth,
    () => getActiveMockWorkspace(),
    () => DEFAULT_MOCK_WORKSPACE,
  );
  const currentUser = getMockCurrentUser();

  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!accountMenuRef.current) return;
      if (!accountMenuRef.current.contains(e.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [accountMenuOpen]);

  return (
    <div className="ml-auto flex shrink-0 items-center gap-1 border-l border-app-border-subtle pl-1.5">
      <EditorHintWrap hintLabel="Present prototype" hintSide="bottom">
        <Button
          variant="toolbar"
          type="button"
          className="h-6 gap-1 border border-app-border-subtle px-1.5 text-ui font-medium shadow-none md:px-2"
          onClick={() => openPrototypePreview()}
        >
          <Play className="h-3 w-3 shrink-0" strokeWidth={2} />
          <span className="hidden md:inline">Present</span>
        </Button>
      </EditorHintWrap>
      <Button
        variant="primary"
        className="h-6 gap-1 px-2 text-ui font-semibold shadow-sm md:px-2.5"
        onClick={() => openShareModal()}
      >
        <Share2 className="h-3 w-3 shrink-0" strokeWidth={2} />
        <span className="hidden sm:inline">Share</span>
      </Button>
      <ThemeToggle size="sm" />
      <div className="relative shrink-0" ref={accountMenuRef}>
        <EditorHintWrap hintLabel="Account" hintSide="bottom">
          <button
            type="button"
            aria-label="Account menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((o) => !o)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-toolbar-well text-ui font-bold text-white shadow-inner transition-colors hover:border-white/[0.2] hover:bg-app-hover"
            style={{
              boxShadow: `inset 0 0 0 1px hsl(${currentUser.avatarHue} 65% 42% / 0.35)`,
            }}
          >
            {currentUser.initials}
          </button>
        </EditorHintWrap>
        {accountMenuOpen ? (
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-1 w-56 editor-floating-menu border border-app-border bg-app-surface py-1 shadow-lg"
          >
            <div className="border-b border-app-border-subtle px-3 py-2">
              <p className="truncate text-ui font-semibold text-app-fg">{currentUser.name}</p>
              <p className="truncate text-ui text-app-subtle">{currentUser.email}</p>
              <p className="mt-1 text-ui text-app-subtle">{workspace.name}</p>
            </div>
            <Link
              href="/"
              role="menuitem"
              className="block px-3 py-1.5 text-ui text-app-fg hover:bg-app-hover"
              onClick={() => setAccountMenuOpen(false)}
            >
              Back to dashboard
            </Link>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-ui text-app-fg hover:bg-app-hover"
              onClick={() => {
                setAccountMenuOpen(false);
                void (async () => {
                  if (isPaytmCraftRemoteMode()) {
                    try {
                      await signOutRemoteSession();
                      router.push("/");
                    } catch (e) {
                      window.alert(e instanceof Error ? e.message : "Sign out failed.");
                    }
                    return;
                  }
                  window.alert("Sign out is a mock action — no session exists.");
                })();
              }}
            >
              <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80" strokeWidth={2} />
              {isPaytmCraftRemoteMode() ? "Sign out" : "Sign out (mock)"}
            </button>
          </div>
        ) : null}
      </div>
      <div className="hidden items-center gap-1 border-l border-app-border-subtle pl-1 sm:flex">
        <EditorHintWrap hintLabel="Help and demo checklist" hintSide="bottom">
          <Button
            variant="toolbar"
            type="button"
            className="h-6 gap-1 border border-app-border bg-app-toolbar-well px-1.5 text-ui font-medium text-app-fg shadow-none hover:bg-app-hover xl:px-2"
            aria-label="Help"
            onClick={() => openHelpDemoChecklist()}
          >
            <CircleHelp className="h-3 w-3 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">Help</span>
          </Button>
        </EditorHintWrap>
        <EditorHintWrap hintLabel="Generate design with AI (mock)" hintSide="bottom">
          <Button
            variant="toolbar"
            type="button"
            className="h-6 gap-1 border border-violet-500/25 bg-violet-500/10 px-1.5 text-ui font-medium text-violet-100 shadow-none hover:bg-violet-500/20 xl:px-2"
            onClick={() => openAIModal("editor")}
          >
            <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">AI</span>
          </Button>
        </EditorHintWrap>
        <EditorHintWrap hintLabel="Plugins marketplace" hintSide="bottom">
          <Button
            variant="toolbar"
            type="button"
            className="hidden h-6 gap-1 border border-app-border bg-app-toolbar-well px-1.5 text-ui font-medium text-app-fg shadow-none hover:bg-app-hover lg:flex xl:px-2"
            onClick={() => openPluginMarketplace()}
          >
            <Plug2 className="h-3 w-3 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">Plugins</span>
          </Button>
        </EditorHintWrap>
        <EditorHintWrap
          hintLabel={showPresence ? "Turn mock presence off" : "Turn mock presence on"}
          hintSide="bottom"
        >
          <button
            type="button"
            onClick={() => togglePresence()}
            className={cn(
              "hidden h-6 items-center gap-1 rounded-md border px-1.5 text-ui font-medium transition-colors lg:flex",
              showPresence
                ? "border-[rgba(13,153,255,0.35)] bg-[rgba(13,153,255,0.12)] text-white"
                : "border-app-border bg-app-toolbar-well text-app-muted hover:bg-app-hover hover:text-app-fg",
            )}
          >
            <Users className="h-3 w-3 shrink-0" strokeWidth={2} />
            <span className="hidden xl:inline">Presence</span>
          </button>
        </EditorHintWrap>
        {showPresence ? (
          <span className="hidden whitespace-nowrap text-ui tabular-nums text-app-subtle xl:inline">
            {presenceUsers.length > 0 ? `${presenceUsers.length} online` : "Live"}
          </span>
        ) : null}
        <span className="hidden lg:block">
          <AvatarStack />
        </span>
      </div>
    </div>
  );
}
