"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Link2, Share2, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  getActiveMockWorkspace,
  getMockSharePeopleForActiveWorkspace,
  subscribeMockAuth,
} from "@/lib/mockAuth";
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
      className="fixed inset-0 z-[218] flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Share"
      onMouseDown={onBackdrop}
    >
      <div
        className="relative my-4 flex max-h-[min(calc(100vh-2rem),640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#1c1c20] to-[#121214] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="h-0.5 w-full bg-gradient-to-r from-sky-400 via-indigo-500 to-violet-500" />
        <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-sky-300">
              <Share2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold text-white">Share</h2>
              <p className="text-[12px] text-[#9a9a9a]">Local preview — no backend or network.</p>
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

        <div className="space-y-5 px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">File</p>
            <p className="mt-1 truncate text-[14px] font-medium text-white">{fileName}</p>
            <p className="mt-0.5 text-[12px] text-[#9a9a9a]">
              Workspace: <span className="text-[#d4d4d4]">{workspace.name}</span>
            </p>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-white/[0.08] bg-black/25 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#d4d4d4]">
                <Link2 className="h-3.5 w-3.5 text-[#8c8c8c]" strokeWidth={2} />
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
                    ? "border-sky-500/50 bg-sky-500/25"
                    : "border-white/[0.1] bg-white/[0.06]",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                    anyoneWithLink ? "left-5" : "left-0.5",
                  )}
                />
              </button>
            </div>
            <p className="text-[11px] leading-snug text-[#6b6b6b]">
              {anyoneWithLink
                ? "Mock: link access would be on (stored only in this dialog for the session)."
                : "Mock: restricted to people listed below."}
            </p>
            <Button
              variant="toolbar"
              type="button"
              className="h-8 justify-center gap-2 border border-white/[0.1] bg-white/[0.06] text-[12px] text-white hover:bg-white/[0.1]"
              onClick={onCopyLink}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
              {copied ? "Copied" : "Copy link"}
            </Button>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">People with access</p>
            <ul className="mt-2 divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-black/20">
              {people.map((p) => (
                <li key={p.email} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/[0.1] bg-white/[0.06] text-[11px] font-bold text-white">
                      {p.initials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-white">{p.name}</p>
                      <p className="truncate text-[11px] text-[#8c8c8c]">{p.email}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-[#c4c4c4]">
                    {p.access}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Invite</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Email address"
                className="h-9 flex-1 border-white/[0.08] bg-black/35 text-[13px] text-white placeholder:text-[#6b6b6b]"
              />
              <select
                value={invitePermission}
                onChange={(e) => setInvitePermission(e.target.value === "edit" ? "edit" : "view")}
                className="h-9 shrink-0 rounded-md border border-white/[0.1] bg-black/40 px-2 text-[12px] text-[#e6e6e6] outline-none ring-sky-500/30 focus:ring-2"
              >
                <option value="view">Can view</option>
                <option value="edit">Can edit</option>
              </select>
            </div>
            <Button
              variant="primary"
              type="button"
              className="mt-2 h-8 w-full text-[12px] sm:w-auto"
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
