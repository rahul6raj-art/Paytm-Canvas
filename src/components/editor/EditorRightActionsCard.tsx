"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Code2, LogOut, Play, Settings, Share2 } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { useCraftAuth } from "@/components/auth/CraftAuthProvider";
import { signOutCraftSession } from "@/lib/craftAuthSession";
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "./useAnchoredDropdown";
import { EditorHintWrap } from "./EditorHoverHint";
import { cn } from "@/lib/utils";
import { getMockCurrentUser } from "@/lib/mockAuth";
import { profileSettingsHref } from "@/lib/profileSettingsNavigation";

export function EditorRightActionsCard() {
  const router = useRouter();
  const pathname = usePathname();
  const pageSearchParams = useSearchParams();
  const isDashboard = pathname === "/";
  const profileSettingsPath = profileSettingsHref(
    `${pathname}${pageSearchParams.toString() ? `?${pageSearchParams.toString()}` : ""}`,
  );
  const openPrototypePreview = useEditorStore((s) => s.openPrototypePreview);
  const openShareModal = useEditorStore((s) => s.openShareModal);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);
  const { user, authEnabled } = useCraftAuth();

  const [accountOpen, setAccountOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const accountAnchorRef = useRef<HTMLButtonElement>(null);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const position = useAnchoredDropdownPosition(accountAnchorRef, accountOpen, 6, {
    viewportClamp: true,
    maxHeight: 320,
    width: 240,
  });
  useDismissAnchoredDropdown(accountOpen, () => setAccountOpen(false), accountAnchorRef, accountMenuRef);

  useEffect(() => setMounted(true), []);

  const displayUser = user ?? getMockCurrentUser();

  const accountMenu =
    accountOpen && mounted ? (
      <div
        ref={accountMenuRef}
        role="menu"
        aria-label="Account"
        data-editor-shell
        className="editor-floating-menu fixed z-[500] overflow-hidden border border-app-border bg-app-panel py-1 shadow-xl"
        style={anchoredMenuStyle(position)}
      >
        <div className="border-b border-app-border-subtle px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <UserAvatar
              name={displayUser.name}
              initials={displayUser.initials}
              avatarUrl={displayUser.avatarUrl}
              avatarHue={displayUser.avatarHue}
              size="md"
            />
            <div className="min-w-0">
              <p className="truncate text-ui font-semibold text-app-fg">{displayUser.name}</p>
              {displayUser.email ? (
                <p className="truncate text-ui text-app-muted">{displayUser.email}</p>
              ) : null}
            </div>
          </div>
        </div>
        {authEnabled && user ? (
          <Link
            href={profileSettingsPath}
            role="menuitem"
            className="editor-menu-dropdown-item !justify-start gap-2.5"
            onClick={() => setAccountOpen(false)}
          >
            <Settings className="size-icon-ui shrink-0 text-app-muted" strokeWidth={1.75} />
            Profile &amp; settings
          </Link>
        ) : (
          <button
            type="button"
            role="menuitem"
            className="editor-menu-dropdown-item !justify-start gap-2.5"
            onClick={() => setAccountOpen(false)}
          >
            <Settings className="size-icon-ui shrink-0 text-app-muted" strokeWidth={1.75} />
            Settings
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          className="editor-menu-dropdown-item !justify-start gap-2.5"
          onClick={() => {
            setAccountOpen(false);
            void (async () => {
              if (isPaytmCraftHttpApiMode() && user) {
                try {
                  await signOutCraftSession();
                  router.replace("/login");
                  router.refresh();
                } catch (e) {
                  window.alert(e instanceof Error ? e.message : "Sign out failed.");
                }
                return;
              }
              if (!isPaytmCraftHttpApiMode()) {
                window.alert("Sign out is a mock action — no session exists.");
              }
            })();
          }}
        >
          <LogOut className="size-icon-ui shrink-0 text-app-muted" strokeWidth={1.75} />
          {isPaytmCraftHttpApiMode() && user ? "Sign out" : "Sign out (mock)"}
        </button>
      </div>
    ) : null;

  return (
    <>
      <div className="editor-sidebar-section flex shrink-0 flex-wrap items-center gap-1 px-3 py-1.5">
        {!isDashboard ? (
          <>
            <EditorHintWrap hintLabel="Preview prototype" hintSide="left">
              <button
                type="button"
                aria-label="Preview"
                onClick={() => openPrototypePreview()}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
              >
                <Play className="size-icon-ui" strokeWidth={1.75} />
              </button>
            </EditorHintWrap>
            <EditorHintWrap hintLabel="Design ↔ Code" hintSide="left">
              <button
                type="button"
                aria-label="Code"
                onClick={() => openCodeRoundTrip("export")}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
              >
                <Code2 className="size-icon-ui" strokeWidth={1.75} />
              </button>
            </EditorHintWrap>
          </>
        ) : null}
        <EditorHintWrap hintLabel="Share" hintSide="left">
          <button
            type="button"
            aria-label="Share"
            onClick={() => openShareModal()}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
          >
            <Share2 className="size-icon-ui" strokeWidth={1.75} />
          </button>
        </EditorHintWrap>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <ThemeToggle variant="editor" />
          <EditorHintWrap hintLabel="Account" hintSide="left">
            <button
              ref={accountAnchorRef}
              type="button"
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen((o) => !o)}
              className={cn(
                "inline-flex min-w-0 items-center gap-1 rounded-full border border-app-border-subtle bg-app-inset py-0.5 pl-0.5 pr-1.5 text-ui font-medium text-app-fg transition-colors",
                "hover:border-app-border hover:bg-app-hover",
                accountOpen && "border-app-border bg-app-hover",
              )}
            >
              <UserAvatar
                name={displayUser.name}
                initials={displayUser.initials}
                avatarUrl={displayUser.avatarUrl}
                avatarHue={displayUser.avatarHue}
                size="sm"
              />
              <ChevronDown
                className={cn(
                  "h-3 w-3 shrink-0 text-app-subtle transition-transform duration-200",
                  accountOpen && "rotate-180",
                )}
                strokeWidth={2.5}
              />
            </button>
          </EditorHintWrap>
        </div>
      </div>
      {accountMenu && mounted ? createPortal(accountMenu, document.body) : null}
    </>
  );
}
