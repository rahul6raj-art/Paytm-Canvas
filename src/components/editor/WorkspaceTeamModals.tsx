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
import { isPaytmCraftHttpApiMode } from "@/lib/env";
import { apiClient, type CraftWorkspace, type CraftWorkspaceInvite, type CraftWorkspaceMember } from "@/lib/apiClient";
import { craftWorkspaceRoleLabel } from "@/lib/dashboardApiAdapters";
import { inviteTeammateToWorkspace, workspaceInviteSuccessMessage } from "@/lib/workspaceTeamInvite";

export function WorkspaceTeamModals() {
  const workspacePickerOpen = useEditorStore((s) => s.workspacePickerOpen);
  const teamInviteModalOpen = useEditorStore((s) => s.teamInviteModalOpen);
  const apiWorkspaceId = useEditorStore((s) => s.apiWorkspaceId);
  const closeWorkspacePicker = useEditorStore((s) => s.closeWorkspacePicker);
  const closeTeamInviteModal = useEditorStore((s) => s.closeTeamInviteModal);

  const isApi = isPaytmCraftHttpApiMode();

  const [authTick, setAuthTick] = useState(0);
  useEffect(() => subscribeMockAuth(() => setAuthTick((n) => n + 1)), []);

  const mockWorkspaces = useMemo(() => {
    void authTick;
    return getMockWorkspaces();
  }, [authTick]);

  const mockActive = useMemo(() => {
    void authTick;
    return getActiveMockWorkspace();
  }, [authTick]);

  const [apiWorkspaces, setApiWorkspaces] = useState<CraftWorkspace[]>([]);
  const [apiMembers, setApiMembers] = useState<CraftWorkspaceMember[]>([]);
  const [apiInvites, setApiInvites] = useState<CraftWorkspaceInvite[]>([]);
  const [apiLoading, setApiLoading] = useState(false);

  const contextWorkspaceId = isApi ? (apiWorkspaceId ?? mockActive.id) : mockActive.id;

  const contextWorkspaceName = useMemo(() => {
    if (isApi && apiWorkspaces.length > 0) {
      return apiWorkspaces.find((w) => w.id === contextWorkspaceId)?.name ?? mockActive.name;
    }
    return mockActive.name;
  }, [isApi, apiWorkspaces, contextWorkspaceId, mockActive.name]);

  const pickerWorkspaces = useMemo(() => {
    if (isApi && apiWorkspaces.length > 0) {
      return apiWorkspaces.map((w) => ({ id: w.id, name: w.name }));
    }
    return mockWorkspaces.map((w) => ({ id: w.id, name: w.name }));
  }, [isApi, apiWorkspaces, mockWorkspaces]);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!teamInviteModalOpen) setInviteEmail("");
  }, [teamInviteModalOpen]);

  useEffect(() => {
    if (!isApi || (!workspacePickerOpen && !teamInviteModalOpen)) return;
    let cancelled = false;
    (async () => {
      setApiLoading(true);
      try {
        const workspaces = await apiClient.listWorkspaces();
        if (cancelled) return;
        setApiWorkspaces(workspaces);
        const members = await apiClient.listWorkspaceMembers(contextWorkspaceId);
        const invites = await apiClient.listWorkspaceInvites(contextWorkspaceId);
        if (!cancelled) {
          setApiMembers(members);
          setApiInvites(invites);
        }
      } catch {
        if (!cancelled) {
          setApiWorkspaces([]);
          setApiMembers([]);
          setApiInvites([]);
        }
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isApi, workspacePickerOpen, teamInviteModalOpen, contextWorkspaceId]);

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

  const onInvite = useCallback(async () => {
    if (isApi) {
      setInviting(true);
      try {
        const outcome = await inviteTeammateToWorkspace(contextWorkspaceId, inviteEmail);
        const [members, invites] = await Promise.all([
          apiClient.listWorkspaceMembers(contextWorkspaceId),
          apiClient.listWorkspaceInvites(contextWorkspaceId),
        ]);
        setApiMembers(members);
        setApiInvites(invites);
        window.alert(workspaceInviteSuccessMessage(outcome, contextWorkspaceName));
        setInviteEmail("");
        closeTeamInviteModal();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Invite failed.");
      } finally {
        setInviting(false);
      }
      return;
    }
    const row = inviteMockMember(inviteEmail);
    if (!row) {
      window.alert("Enter a valid email address.");
      return;
    }
    window.alert(`Invitation saved locally for ${row.email}.\n\nNo server was contacted.`);
    setInviteEmail("");
    closeTeamInviteModal();
  }, [
    isApi,
    contextWorkspaceId,
    contextWorkspaceName,
    inviteEmail,
    closeTeamInviteModal,
  ]);

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
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-app-border bg-gradient-to-b from-[#1c1c20] to-[#121214] shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 border-b border-app-border-subtle px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-hover text-indigo-300">
                <Building2 className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">Switch workspace</h2>
                <p className="text-ui text-app-muted">
                  {isApi
                    ? "Workspaces from your API account."
                    : "Stored in this browser only (localStorage)."}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeWorkspacePicker}
              className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </header>
          {apiLoading && isApi ? (
            <p className="px-5 py-4 text-ui-sm text-app-muted">Loading workspaces…</p>
          ) : null}
          <ul className="max-h-[min(60vh,400px)] divide-y divide-white/[0.06] overflow-y-auto px-2 py-2">
            {pickerWorkspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => {
                    switchMockWorkspace(w.id);
                    closeWorkspacePicker();
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-ui-sm transition-colors",
                    w.id === contextWorkspaceId ? "bg-sky-500/15 text-white" : "text-app-fg hover:bg-app-hover",
                  )}
                >
                  <span className="font-medium">{w.name}</span>
                  {w.id === contextWorkspaceId ? (
                    <span className="section-heading text-sky-300">Current</span>
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
          className="relative w-full max-w-md overflow-hidden rounded-2xl border border-app-border bg-gradient-to-b from-[#1c1c20] to-[#121214] shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <header className="flex items-start justify-between gap-3 border-b border-app-border-subtle px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-app-hover text-emerald-300">
                <UserPlus className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="text-base font-semibold text-white">Invite teammate</h2>
                <p className="text-ui text-app-muted">
                  {isApi ? (
                    <>
                      Invite by email — registered users join immediately; others get a pending invite.
                    </>
                  ) : (
                    <>
                      Adds a pending invite for <span className="text-app-fg">{contextWorkspaceName}</span>.
                    </>
                  )}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeTeamInviteModal}
              className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </header>
          <div className="space-y-3 px-5 py-4">
            {isApi && apiInvites.length > 0 ? (
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <p className="section-heading">Pending invites</p>
                <ul className="mt-1.5 space-y-1 text-ui text-app-muted">
                  {apiInvites.slice(0, 5).map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-app-fg">{inv.email}</span>
                      <span className="shrink-0 text-app-subtle">{craftWorkspaceRoleLabel(inv.role)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {isApi && apiMembers.length > 0 ? (
              <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2">
                <p className="section-heading">Current members</p>
                <ul className="mt-1.5 space-y-1 text-ui text-app-muted">
                  {apiMembers.slice(0, 5).map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-2">
                      <span className="truncate text-app-fg">{m.displayName}</span>
                      <span className="shrink-0 text-app-subtle">{craftWorkspaceRoleLabel(m.role)}</span>
                    </li>
                  ))}
                  {apiMembers.length > 5 ? (
                    <li className="text-app-subtle">+{apiMembers.length - 5} more</li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            {apiLoading && isApi ? (
              <p className="text-ui text-app-muted">Loading members…</p>
            ) : null}
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@paytm.com"
              disabled={inviting}
              className="h-9 border-app-border bg-black/35 text-ui-sm text-white placeholder:text-app-subtle disabled:opacity-60"
              onKeyDown={(e) => {
                if (e.key === "Enter") void onInvite();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="toolbar"
                type="button"
                className="h-8 border border-app-border bg-transparent text-ui text-app-fg"
                onClick={closeTeamInviteModal}
                disabled={inviting}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                type="button"
                className="h-8 text-ui"
                onClick={() => void onInvite()}
                disabled={inviting}
              >
                {inviting ? "Sending…" : isApi ? "Invite" : "Invite (mock)"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
