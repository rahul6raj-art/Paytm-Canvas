"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  getActiveMockWorkspace,
  getMockSharePeopleForActiveWorkspace,
  subscribeMockAuth,
} from "@/lib/mockAuth";
import { appFieldClass } from "@/lib/appFieldStyles";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ShareModal() {
  const open = useEditorStore((s) => s.shareModalOpen);
  const close = useEditorStore((s) => s.closeShareModal);
  const fileName = useEditorStore((s) => s.fileName);

  const [authTick, setAuthTick] = useState(0);
  useEffect(() => subscribeMockAuth(() => setAuthTick((n) => n + 1)), []);

  const workspace = useMemo(() => {
    void authTick;
    return getActiveMockWorkspace();
  }, [authTick]);

  const people = useMemo(() => {
    void authTick;
    return getMockSharePeopleForActiveWorkspace();
  }, [authTick]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [invitePermission, setInvitePermission] = useState<"view" | "edit">("view");
  const [anyoneWithLink, setAnyoneWithLink] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setInviteEmail("");
      setInvitePermission("view");
      setAnyoneWithLink(false);
      setCopied(false);
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

  const mockLink = useMemo(() => {
    const slug = workspace.slug.replace(/\s+/g, "-");
    return `https://craft.paytm.mock/${slug}/${encodeURIComponent(fileName.slice(0, 24))}`;
  }, [workspace.slug, fileName]);

  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) close();
    },
    [close],
  );

  const onCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(mockLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.alert(`Mock link (copy manually):\n${mockLink}`);
    }
  }, [mockLink]);

  const onSendInvite = useCallback(() => {
    const email = inviteEmail.trim();
    if (!email) {
      window.alert("Enter an email address.");
      return;
    }
    window.alert(
      `Invite queued locally (mock).\n\n${email} — ${invitePermission === "edit" ? "Can edit" : "Can view"}\nWorkspace: ${workspace.name}\n\nNo server was contacted.`,
    );
    setInviteEmail("");
  }, [inviteEmail, invitePermission, workspace.name]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[218] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px] sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onMouseDown={onBackdrop}
    >
      <div
        className="relative flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl"
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
              <Share2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-app-fg">Share</h2>
              <p className="mt-0.5 text-ui leading-snug text-app-muted">
                Local preview — no backend or network.
              </p>
            </div>
          </div>
        </header>

        <div className="thin-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div>
            <p className="section-heading">File</p>
            <p className="mt-1 truncate text-ui-sm font-medium text-app-fg">{fileName}</p>
            <p className="mt-0.5 text-ui text-app-muted">
              Workspace: <span className="text-app-fg">{workspace.name}</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-app-border bg-app-inset p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2 text-ui font-medium text-app-fg">
                <Link2 className="h-3.5 w-3.5 shrink-0 text-app-subtle" strokeWidth={2} />
                Anyone with the link
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={anyoneWithLink}
                onClick={() => setAnyoneWithLink((v) => !v)}
                className={cn(
                  "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
                  anyoneWithLink
                    ? "border-accent/40 bg-accent/20"
                    : "border-app-border bg-app-hover",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-app-fg shadow-sm transition-transform",
                    anyoneWithLink ? "left-5" : "left-0.5",
                  )}
                />
              </button>
            </div>
            <p className="text-ui leading-snug text-app-subtle">
              {anyoneWithLink
                ? "Mock: link access would be on (stored only in this dialog for the session)."
                : "Mock: restricted to people listed below."}
            </p>
            <Button
              variant="toolbar"
              type="button"
              className="h-9 w-full justify-center gap-2 border border-app-border bg-app-panel text-app-fg hover:bg-app-hover"
              onClick={onCopyLink}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2} />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={2} />
              )}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>

          <div>
            <p className="section-heading">People with access</p>
            <ul className="mt-2 divide-y divide-app-border-subtle overflow-hidden rounded-xl border border-app-border bg-app-inset">
              {people.map((p) => (
                <li key={p.email} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-panel text-ui font-semibold text-app-fg">
                      {p.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-ui-sm font-medium text-app-fg">{p.name}</p>
                      <p className="truncate text-ui text-app-subtle">{p.email}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-app-border bg-app-panel px-2 py-0.5 text-ui font-medium text-app-muted">
                    {p.access}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="section-heading">Invite</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="h-9 flex-1"
              />
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value === "edit" ? "edit" : "view")}
                className={cn(appFieldClass, "h-9 shrink-0 sm:w-[7.5rem]")}
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
            <Button
              variant="toolbar"
              type="button"
              className="mt-2 h-9 w-full justify-center border border-app-border bg-white text-black hover:bg-white/90 hover:text-black"
              onClick={onSendInvite}
            >
              Send invite (mock)
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
