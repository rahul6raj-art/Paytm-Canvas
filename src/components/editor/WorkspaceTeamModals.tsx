"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, UserPlus, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  getActiveMockWorkspace,
  getMockWorkspaces,
  inviteMockMember,
  switchMockWorkspace,
  subscribeMockAuth,
} from "@/lib/mockAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function WorkspaceTeamModals() {
  const workspacePickerOpen = useEditorStore((s) => s.workspacePickerOpen);
  const teamInviteModalOpen = useEditorStore((s) => s.teamInviteModalOpen);
  const closeWorkspacePicker = useEditorStore((s) => s.closeWorkspacePicker);
  const closeTeamInviteModal = useEditorStore((s) => s.closeTeamInviteModal);

  const [authTick, setAuthTick] = useState(0);
  useEffect(() => subscribeMockAuth(() => setAuthTick((n) => n + 1)), []);

  const workspaces = useMemo(() => {
    void authTick;
    return getMockWorkspaces();
  }, [authTick]);

  const active = useMemo(() => {
    void authTick;
    return getActiveMockWorkspace();
  }, [authTick]);

  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    if (!teamInviteModalOpen) setInviteEmail("");
  }, [teamInviteModalOpen]);

  useEffect(() => {
    if (!workspacePickerOpen && !teamInviteModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeWorkspacePicker();
        closeTeamInviteModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workspacePickerOpen, teamInviteModalOpen, closeWorkspacePicker, closeTeamInviteModal]);

  const onBackdrop = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        closeWorkspacePicker();
        closeTeamInviteModal();
      }
    },
    [closeWorkspacePicker, closeTeamInviteModal],
  );

  const onInvite = useCallback(() => {
    const row = inviteMockMember(inviteEmail);
    if (!row) {
      window.alert("Enter a valid email address.");
      return;
    }
    window.alert(`Invitation saved locally for ${row.email}.\n\nNo server was contacted.`);
    setInviteEmail("");
    closeTeamInviteModal();
  }, [inviteEmail, closeTeamInviteModal]);

  if (!workspacePickerOpen && !teamInviteModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[217] flex items-start justify-center overflow-y-auto bg-black/55 px-3 py-16 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={onBackdrop}
    >
      {workspacePickerOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Switch workspace"
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#1c1c20] to-[#121214] shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-indigo-300">
                <Building2 className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="text-[16px] font-semibold text-white">Switch workspace</h2>
                <p className="text-[12px] text-[#9a9a9a]">Stored in this browser only (localStorage).</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeWorkspacePicker}
              className="rounded-lg p-1.5 text-[#9a9a9a] transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </header>
          <ul className="max-h-[min(60vh,400px)] divide-y divide-white/[0.06] overflow-y-auto px-2 py-2">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => {
                    switchMockWorkspace(w.id);
                    closeWorkspacePicker();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-[13px] transition-colors",
                    w.id === active.id ? "bg-sky-500/15 text-white" : "text-[#d4d4d4] hover:bg-white/[0.06]",
                  )}
                >
                  <span className="font-medium">{w.name}</span>
                  {w.id === active.id ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-300">Current</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {teamInviteModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Invite team member"
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.1] bg-gradient-to-b from-[#1c1c20] to-[#121214] shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.06] text-emerald-300">
                <UserPlus className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="text-[16px] font-semibold text-white">Invite teammate</h2>
                <p className="text-[12px] text-[#9a9a9a]">
                  Adds a pending invite for <span className="text-[#d4d4d4]">{active.name}</span>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeTeamInviteModal}
              className="rounded-lg p-1.5 text-[#9a9a9a] transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </header>
          <div className="space-y-3 px-5 py-4">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@paytm.com"
              className="h-9 border-white/[0.08] bg-black/35 text-[13px] text-white placeholder:text-[#6b6b6b]"
              onKeyDown={(e) => {
                if (e.key === "Enter") onInvite();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="toolbar"
                type="button"
                className="h-8 border border-white/[0.1] bg-transparent text-[12px] text-[#d4d4d4]"
                onClick={closeTeamInviteModal}
              >
                Cancel
              </Button>
              <Button variant="primary" type="button" className="h-8 text-[12px]" onClick={onInvite}>
                Invite (mock)
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
