"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Plus, Search, Sparkles, Upload } from "lucide-react";
import { DashboardSidebar, type DashboardNavId } from "./DashboardSidebar";
import { FileCard } from "./FileCard";
import { FileCardSkeleton } from "./FileCardSkeleton";
import { TemplateCard } from "./TemplateCard";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  DASHBOARD_MOCK_FILES,
  TEMPLATE_GALLERY,
  blankWorkspace,
  getTemplatePersistSlice,
} from "@/lib/templates";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import {
  documentToEditorPatch,
  parsePaytmCraftDocumentJson,
  readLocalDocument,
} from "@/lib/documentPersistence";
import { isFigmaFigFile } from "@/lib/figImport";
import { waitForNextPaint } from "@/lib/figImport/figImportRuntime";
import { FigImportFinishEffect } from "@/components/import/FigImportFinishEffect";
import { FigImportOverlay } from "@/components/import/FigImportOverlay";
import { FigImportToast } from "@/components/import/FigImportToast";
import { AIGenerateModal } from "@/components/ai/AIGenerateModal";
import { ImportHub } from "@/components/import/ImportHub";
import { CodeRoundTripModal } from "@/components/code/CodeRoundTripModal";
import { ImportFigmaModal } from "@/components/import/ImportFigmaModal";
import { ImportWebModal } from "@/components/import/ImportWebModal";
import {
  getActiveMockWorkspace,
  getMockCurrentUser,
  getMockWorkspaces,
  inviteMockMember,
  readPendingInvites,
  subscribeMockAuth,
  switchMockWorkspace,
  type MockMemberRole,
  type MockWorkspace,
} from "@/lib/mockAuth";
import { useActiveMockWorkspace } from "@/lib/useActiveMockWorkspace";
import type { DashboardMockFile } from "@/lib/templates";
import { cn } from "@/lib/utils";
import { isPaytmCraftHttpApiMode, isPaytmCraftRemoteMode } from "@/lib/env";
import {
  editorHrefForApiFile,
  persistSliceFromApiFileDetail,
} from "@/lib/apiFileHydration";
import { inviteTeammateToWorkspace, workspaceInviteSuccessMessage } from "@/lib/workspaceTeamInvite";
import { apiClient, ApiRequestError, type CraftApiTokenSummary, type CraftFileSummary, type CraftTeam, type CraftUser, type CraftWorkspace, type CraftWorkspaceInvite, type CraftWorkspaceMember } from "@/lib/apiClient";
import { RemoteAuthLoginModal } from "@/components/auth/RemoteAuthLoginModal";
import { signOutRemoteSession, subscribeRemoteAuthRefresh } from "@/lib/remoteAuthSession";
import {
  accentGradientForApiId,
  craftUserToMockUser,
  craftWorkspaceMembersToMockMembers,
  craftWorkspaceRoleLabel,
  craftWorkspaceToMockWorkspace,
  formatApiFileUpdated,
  ownerMemberFromCraftUser,
} from "@/lib/dashboardApiAdapters";
import { buildDashboardTeamGroups } from "@/lib/dashboardTeamGrouping";
import {
  filterTeamGroupsForActiveTeam,
  firstWorkspaceIdInTeam,
  isMultiTeamDashboard,
  readDashboardActiveTeamId,
  resolveDashboardActiveTeamId,
  subscribeDashboardActiveTeam,
  writeDashboardActiveTeamId,
} from "@/lib/dashboardTeamSwitcher";
import { PaytmCraftApiModeBanner } from "@/components/PaytmCraftApiModeBanner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DashboardApiTokensPanel } from "@/components/dashboard/DashboardApiTokensPanel";
import { apiTokenCreatedSuccessMessage, type ApiTokenResourceScope } from "@/lib/apiTokenManagement";

function matchesSearch(q: string, ...parts: string[]) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return parts.some((p) => p.toLowerCase().includes(s));
}

const SECTION_ORDER: MockWorkspace["section"][] = ["personal", "paytm-design", "product-team", "experiments"];

function roleBadgeClass(role: MockMemberRole): string {
  switch (role) {
    case "owner":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "editor":
      return "border-sky-200 bg-sky-50 text-sky-900";
    default:
      return "border-app-border bg-app-inset text-app-fg";
  }
}

function roleLabel(role: MockMemberRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "editor":
      return "Editor";
    default:
      return "Viewer";
  }
}

function DashboardTeamView({
  workspace,
  useApiMembers,
  apiMembers,
  apiPendingInvites,
  membersLoading,
  onInviteApi,
}: {
  workspace: MockWorkspace;
  useApiMembers?: boolean;
  apiMembers?: CraftWorkspaceMember[];
  apiPendingInvites?: CraftWorkspaceInvite[];
  membersLoading?: boolean;
  onInviteApi?: (email: string) => Promise<void>;
}) {
  const ws = workspace;
  const pending = useApiMembers ? [] : readPendingInvites().filter((i) => i.workspaceId === ws.id);
  const apiPending = apiPendingInvites ?? [];
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const apiRoleByUserId = useMemo(() => {
    const map = new Map<string, CraftWorkspaceMember["role"]>();
    for (const m of apiMembers ?? []) map.set(m.userId, m.role);
    return map;
  }, [apiMembers]);

  const handleInvite = async () => {
    if (useApiMembers && onInviteApi) {
      setInviting(true);
      try {
        await onInviteApi(email);
        setEmail("");
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Invite failed.");
      } finally {
        setInviting(false);
      }
      return;
    }
    const row = inviteMockMember(email);
    if (row) {
      window.alert(`Pending invite saved for ${row.email}.`);
      setEmail("");
    } else window.alert("Enter a valid email.");
  };

  return (
    <section>
      <h2 className="mb-1 section-heading text-app-muted">Team</h2>
      <p className="mb-4 text-ui-sm text-app-muted">
        Members and invites for <span className="font-semibold text-app-fg">{ws.name}</span>.
        {useApiMembers
          ? " Membership is loaded from the workspace API."
          : " Everything stays in this browser — no API calls."}
      </p>

      {membersLoading ? (
        <p className="mb-4 text-ui-sm text-app-muted">Loading members…</p>
      ) : null}

      <div className="mb-6 overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm">
        <table className="w-full text-left text-ui-sm">
          <thead className="border-b border-app-border-subtle bg-app-raised section-heading text-app-muted">
            <tr>
              <th className="px-4 py-2.5">Member</th>
              <th className="px-4 py-2.5">Email</th>
              <th className="px-4 py-2.5">Role</th>
            </tr>
          </thead>
          <tbody>
            {ws.members.map((m) => (
              <tr key={m.userId} className="border-b border-app-border-subtle last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-inset text-ui font-bold text-app-fg">
                      {m.initials}
                    </span>
                    <span className="font-medium text-app-fg">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-app-muted">{m.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-2 py-0.5 text-ui font-semibold",
                      roleBadgeClass(m.role),
                    )}
                  >
                    {useApiMembers && apiRoleByUserId.has(m.userId)
                      ? craftWorkspaceRoleLabel(apiRoleByUserId.get(m.userId)!)
                      : roleLabel(m.role)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 rounded-xl border border-app-border bg-app-card p-4 shadow-sm">
        <h3 className="text-ui font-semibold text-app-fg">Invite by email</h3>
        <p className="mt-1 text-ui text-app-muted">
          {useApiMembers
            ? "Adds registered users immediately; others receive a pending invite until they sign up."
            : "Creates a pending invite row stored in localStorage."}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@paytm.com"
            disabled={inviting}
            className="h-9 min-w-0 flex-1 rounded-lg border border-app-border bg-app-card px-3 text-ui-sm text-app-fg outline-none ring-slate-900/10 placeholder:text-app-subtle focus:border-slate-300 focus:ring-2 disabled:opacity-60"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleInvite();
            }}
          />
          <button
            type="button"
            disabled={inviting}
            onClick={() => void handleInvite()}
            className="h-9 shrink-0 rounded-lg bg-app-fg px-4 text-ui-sm font-semibold text-app-bg hover:bg-app-muted disabled:opacity-60"
          >
            {inviting ? "Sending…" : "Send invite"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-app-border bg-app-raised/50 p-4">
        <h3 className="text-ui font-semibold text-app-fg">Pending invites</h3>
        {(useApiMembers ? apiPending : pending).length === 0 ? (
          <p className="mt-2 text-ui-sm text-app-muted">No pending invites for this workspace.</p>
        ) : useApiMembers ? (
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-app-border bg-app-card">
            {apiPending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-ui-sm">
                <span className="font-medium text-app-fg">{p.email}</span>
                <span className="shrink-0 text-ui text-app-muted">
                  Pending · {craftWorkspaceRoleLabel(p.role)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-app-border bg-app-card">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-ui-sm">
                <span className="font-medium text-app-fg">{p.email}</span>
                <span className="shrink-0 text-ui text-app-muted">Pending · local only</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function DashboardShell() {
  const router = useRouter();
  const openAIModal = useEditorStore((s) => s.openAIModal);
  const openImportHub = useEditorStore((s) => s.openImportHub);
  const importRef = useRef<HTMLInputElement>(null);
  const [nav, setNav] = useState<DashboardNavId>("home");
  const [search, setSearch] = useState("");
  const [hasLocalDoc, setHasLocalDoc] = useState(false);
  const [authTick, setAuthTick] = useState(0);
  const [sidebarInviteEmail, setSidebarInviteEmail] = useState("");
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [storedActiveTeamId, setStoredActiveTeamId] = useState<string | null>(() =>
    typeof window !== "undefined" ? readDashboardActiveTeamId() : null,
  );

  const isApi = isPaytmCraftHttpApiMode();
  const isRemote = isPaytmCraftRemoteMode();
  const showApiTokens = isApi || isRemote;

  const [apiRefreshKey, setApiRefreshKey] = useState(0);
  const [apiLoading, setApiLoading] = useState(isApi);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiUser, setApiUser] = useState<CraftUser | null>(null);
  const [apiWorkspaces, setApiWorkspaces] = useState<CraftWorkspace[]>([]);
  const [apiTeams, setApiTeams] = useState<CraftTeam[]>([]);
  const [apiTeamMembersByTeam, setApiTeamMembersByTeam] = useState<Record<string, CraftWorkspaceMember[]>>({});
  const [apiFilesByWorkspace, setApiFilesByWorkspace] = useState<Record<string, CraftFileSummary[]>>({});
  const [apiMembersByWorkspace, setApiMembersByWorkspace] = useState<Record<string, CraftWorkspaceMember[]>>({});
  const [apiInvitesByWorkspace, setApiInvitesByWorkspace] = useState<Record<string, CraftWorkspaceInvite[]>>({});
  const [apiTokens, setApiTokens] = useState<CraftApiTokenSummary[]>([]);
  const [apiTokensLoading, setApiTokensLoading] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => subscribeMockAuth(() => setAuthTick((n) => n + 1)), []);
  useEffect(() => subscribeRemoteAuthRefresh(() => setApiRefreshKey((k) => k + 1)), []);
  useEffect(() => subscribeDashboardActiveTeam(() => setStoredActiveTeamId(readDashboardActiveTeamId())), []);

  useEffect(() => {
    if (!isApi) {
      setApiLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setApiLoading(true);
      setApiError(null);
      try {
        const [user, workspaces, teams] = await Promise.all([
          apiClient.getCurrentUser(),
          apiClient.listWorkspaces(),
          apiClient.listTeams(),
        ]);
        if (cancelled) return;
        if (!user) {
          setApiError("No user returned from API.");
          return;
        }
        setApiUser(user);
        setApiWorkspaces(workspaces);
        setApiTeams(teams);
        const entries = await Promise.all(
          workspaces.map(async (w) => [w.id, await apiClient.listFiles({ workspaceId: w.id })] as const),
        );
        if (cancelled) return;
        setApiFilesByWorkspace(Object.fromEntries(entries));
        setMembersLoading(true);
        try {
          const memberEntries = await Promise.all(
            workspaces.map(async (w) => [w.id, await apiClient.listWorkspaceMembers(w.id)] as const),
          );
          const inviteEntries = await Promise.all(
            workspaces.map(async (w) => [w.id, await apiClient.listWorkspaceInvites(w.id)] as const),
          );
          const teamMemberEntries = await Promise.all(
            teams.map(async (t) => [t.id, await apiClient.listTeamMembers(t.id)] as const),
          );
          if (!cancelled) {
            setApiMembersByWorkspace(Object.fromEntries(memberEntries));
            setApiInvitesByWorkspace(Object.fromEntries(inviteEntries));
            setApiTeamMembersByTeam(Object.fromEntries(teamMemberEntries));
          }
        } finally {
          if (!cancelled) setMembersLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          if (e instanceof ApiRequestError && e.status === 401 && isRemote) {
            setApiError(null);
            setLoginModalOpen(true);
          } else {
            setApiError(e instanceof Error ? e.message : "Failed to load dashboard data.");
          }
        }
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isApi, apiRefreshKey, isRemote]);

  const refreshApiTokens = useCallback(async () => {
    if (!showApiTokens) return;
    setApiTokensLoading(true);
    try {
      const rows = await apiClient.listApiTokens();
      setApiTokens(rows);
    } catch {
      setApiTokens([]);
    } finally {
      setApiTokensLoading(false);
    }
  }, [showApiTokens]);

  useEffect(() => {
    if (!showApiTokens || nav !== "team") return;
    void refreshApiTokens();
  }, [showApiTokens, nav, refreshApiTokens, apiRefreshKey]);

  const handleCreateApiToken = useCallback(
    async (
      name: string,
      expiresInDays: number | null,
      scope: "read" | "write",
      resourceScopes: ApiTokenResourceScope[] = [],
    ) => {
      const created = await apiClient.createApiToken(name, {
        expiresInDays,
        scope,
        resourceScopes: resourceScopes.length ? resourceScopes : undefined,
      });
      await refreshApiTokens();
      window.alert(apiTokenCreatedSuccessMessage(created));
    },
    [refreshApiTokens],
  );

  const handleRevokeApiToken = useCallback(
    async (tokenId: string) => {
      await apiClient.revokeApiToken(tokenId);
      await refreshApiTokens();
    },
    [refreshApiTokens],
  );

  const handleRemoteSignOut = useCallback(async () => {
    try {
      await signOutRemoteSession();
      setApiRefreshKey((k) => k + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Sign out failed.");
    }
  }, []);

  useEffect(() => {
    if (!isApi || apiWorkspaces.length === 0) return;
    const activeId = getActiveMockWorkspace().id;
    if (!apiWorkspaces.some((w) => w.id === activeId)) {
      switchMockWorkspace(apiWorkspaces[0]!.id);
    }
  }, [isApi, apiWorkspaces]);

  const refreshWorkspaceMembers = useCallback(async (workspaceId: string) => {
    const [members, invites] = await Promise.all([
      apiClient.listWorkspaceMembers(workspaceId),
      apiClient.listWorkspaceInvites(workspaceId),
    ]);
    setApiMembersByWorkspace((prev) => ({ ...prev, [workspaceId]: members }));
    setApiInvitesByWorkspace((prev) => ({ ...prev, [workspaceId]: invites }));
    return members;
  }, []);

  const inviteWorkspaceMemberByEmail = useCallback(
    async (workspaceId: string, email: string) => {
      const outcome = await inviteTeammateToWorkspace(workspaceId, email);
      await refreshWorkspaceMembers(workspaceId);
      const wsName =
        apiWorkspaces.find((w) => w.id === workspaceId)?.name ??
        getActiveMockWorkspace().name;
      window.alert(workspaceInviteSuccessMessage(outcome, wsName));
    },
    [refreshWorkspaceMembers, apiWorkspaces],
  );

  const activeWorkspace = useActiveMockWorkspace();

  const workspacesForSidebar = useMemo((): MockWorkspace[] => {
    if (isApi && apiUser && apiWorkspaces.length > 0) {
      const teamById = new Map(apiTeams.map((t) => [t.id, t]));
      return apiWorkspaces.map((w) => {
        const apiMembers = apiMembersByWorkspace[w.id];
        const members =
          apiMembers && apiMembers.length > 0
            ? craftWorkspaceMembersToMockMembers(apiMembers)
            : [ownerMemberFromCraftUser(apiUser)];
        return craftWorkspaceToMockWorkspace(w, members, teamById.get(w.teamId));
      });
    }
    void authTick;
    return getMockWorkspaces();
  }, [isApi, apiUser, apiWorkspaces, apiTeams, apiMembersByWorkspace, authTick]);

  const dashboardTeamGroups = useMemo(() => {
    if (!isApi || apiTeams.length === 0) return undefined;
    const groups = buildDashboardTeamGroups(apiTeams, apiWorkspaces, workspacesForSidebar);
    return groups.length > 0 ? groups : undefined;
  }, [isApi, apiTeams, apiWorkspaces, workspacesForSidebar]);

  const resolvedActiveTeamId = useMemo(() => {
    if (!dashboardTeamGroups) return undefined;
    return resolveDashboardActiveTeamId({
      teamGroups: dashboardTeamGroups,
      activeWorkspaceTeamId: apiWorkspaces.find((w) => w.id === activeWorkspace.id)?.teamId,
      storedTeamId: storedActiveTeamId,
    });
  }, [dashboardTeamGroups, apiWorkspaces, activeWorkspace.id, storedActiveTeamId]);

  const visibleTeamGroups = useMemo(() => {
    if (!dashboardTeamGroups) return undefined;
    return filterTeamGroupsForActiveTeam(dashboardTeamGroups, resolvedActiveTeamId);
  }, [dashboardTeamGroups, resolvedActiveTeamId]);

  const teamSwitcherProps = useMemo(() => {
    if (!isMultiTeamDashboard(dashboardTeamGroups) || !resolvedActiveTeamId || !dashboardTeamGroups) {
      return undefined;
    }
    return {
      teams: dashboardTeamGroups.map((g) => ({ id: g.id, name: g.name })),
      activeTeamId: resolvedActiveTeamId,
    };
  }, [dashboardTeamGroups, resolvedActiveTeamId]);

  useEffect(() => {
    if (!isApi || !resolvedActiveTeamId) return;
    if (storedActiveTeamId !== resolvedActiveTeamId) {
      writeDashboardActiveTeamId(resolvedActiveTeamId);
    }
  }, [isApi, resolvedActiveTeamId, storedActiveTeamId]);

  const handleSwitchTeam = useCallback(
    (teamId: string) => {
      writeDashboardActiveTeamId(teamId);
      const curWs = getActiveMockWorkspace().id;
      const curTeam = apiWorkspaces.find((w) => w.id === curWs)?.teamId;
      if (curTeam !== teamId) {
        const first = firstWorkspaceIdInTeam(apiWorkspaces, teamId);
        if (first) switchMockWorkspace(first);
      }
    },
    [apiWorkspaces],
  );

  const activeOrgTeamId = useMemo(() => {
    if (!isApi) return undefined;
    return resolvedActiveTeamId ?? apiWorkspaces.find((w) => w.id === activeWorkspace.id)?.teamId;
  }, [isApi, apiWorkspaces, activeWorkspace.id, resolvedActiveTeamId]);

  const activeOrgTeamName = useMemo(() => {
    if (!activeOrgTeamId) return undefined;
    return apiTeams.find((t) => t.id === activeOrgTeamId)?.name;
  }, [activeOrgTeamId, apiTeams]);

  const activeWorkspaceForView = useMemo(() => {
    if (isApi) {
      return workspacesForSidebar.find((w) => w.id === activeWorkspace.id) ?? activeWorkspace;
    }
    return activeWorkspace;
  }, [isApi, workspacesForSidebar, activeWorkspace]);

  const currentUserForSidebar = useMemo(() => {
    if (isApi && apiUser) return craftUserToMockUser(apiUser);
    return getMockCurrentUser();
  }, [isApi, apiUser]);

  const teamPreviewMembers = useMemo(() => {
    if (isApi && activeOrgTeamId) {
      const orgMembers = apiTeamMembersByTeam[activeOrgTeamId];
      if (orgMembers && orgMembers.length > 0) {
        return craftWorkspaceMembersToMockMembers(orgMembers);
      }
    }
    const apiMembers = apiMembersByWorkspace[activeWorkspace.id];
    if (isApi && apiMembers && apiMembers.length > 0) {
      return craftWorkspaceMembersToMockMembers(apiMembers);
    }
    if (isApi && apiUser) return [ownerMemberFromCraftUser(apiUser)];
    return activeWorkspaceForView.members;
  }, [
    isApi,
    apiUser,
    activeOrgTeamId,
    apiTeamMembersByTeam,
    apiMembersByWorkspace,
    activeWorkspace.id,
    activeWorkspaceForView.members,
  ]);

  useEffect(() => {
    setHasLocalDoc(readLocalDocument() != null);
  }, []);

  const openEditor = useCallback(
    async (
      slice: EditorPersistSlice,
      apiSession?: { apiFileId: string; apiWorkspaceId?: string; apiRevision?: string },
    ) => {
      await useEditorStore.getState().loadWorkspaceFromPersist(slice, apiSession);
      const href =
        apiSession?.apiFileId != null
          ? editorHrefForApiFile(apiSession.apiFileId)
          : "/editor";
      router.push(href);
    },
    [router],
  );

  const openApiFileById = useCallback(
    async (fileId: string) => {
      try {
        const detail = await apiClient.getFile(fileId);
        if (!detail) {
          window.alert("File not found.");
          return;
        }
        await openEditor(persistSliceFromApiFileDetail(detail), {
          apiFileId: detail.id,
          apiWorkspaceId: detail.workspaceId,
          apiRevision: detail.revision,
        });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Could not open file.");
      }
    },
    [openEditor],
  );

  const onNewDesign = useCallback(async () => {
    if (isPaytmCraftHttpApiMode()) {
      try {
        const wid = getActiveMockWorkspace().id;
        const created = await apiClient.createFile({ workspaceId: wid, name: "Untitled" });
        const detail = await apiClient.getFile(created.id);
        if (!detail) {
          window.alert("Could not load the new file.");
          return;
        }
        await openEditor(persistSliceFromApiFileDetail(detail), {
          apiFileId: created.id,
          apiWorkspaceId: wid,
          apiRevision: detail.revision,
        });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Could not create file.");
      }
      return;
    }
    await openEditor(blankWorkspace());
  }, [openEditor]);

  const onImportFile = useCallback(
    async (file: File | null) => {
      if (!file) return;
      const isFig = isFigmaFigFile(file);
      if (isFig) {
        router.push("/editor");
        await waitForNextPaint();
        await waitForNextPaint();
        try {
          await useEditorStore.getState().importFigmaFile(file);
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Could not import that Figma file.");
        }
        return;
      }
      try {
        const raw = await file.text();
        const doc = parsePaytmCraftDocumentJson(raw);
        if (!doc) {
          window.alert("Invalid file. Use .paytmcraft.json or a Figma .fig export.");
          return;
        }
        if (isPaytmCraftHttpApiMode()) {
          try {
            const wid = getActiveMockWorkspace().id;
            const created = await apiClient.createFile({
              workspaceId: wid,
              name: doc.name || "Imported",
              documentJson: doc,
            });
            setApiRefreshKey((k) => k + 1);
            const patch = documentToEditorPatch(doc);
            await openEditor(
              { ...patch },
              { apiFileId: created.id, apiWorkspaceId: wid, apiRevision: created.revision },
            );
            return;
          } catch (e) {
            window.alert(e instanceof Error ? e.message : "Could not create API file from import.");
            return;
          }
        }
        const patch = documentToEditorPatch(doc);
        await openEditor({ ...patch });
      } catch {
        window.alert("Could not read that file.");
      }
    },
    [openEditor],
  );

  const onOpenRecovered = useCallback(async () => {
    const doc = readLocalDocument();
    if (!doc) return;
    const patch = documentToEditorPatch(doc);
    await openEditor({ ...patch });
  }, [openEditor]);

  const mockFiltered = useMemo(() => {
    const q = search;
    return DASHBOARD_MOCK_FILES.filter((f) => matchesSearch(q, f.name, f.ownerName, f.workspaceName));
  }, [search]);

  const templatesFiltered = useMemo(() => {
    const q = search;
    return TEMPLATE_GALLERY.filter((t) => matchesSearch(q, t.title, t.description));
  }, [search]);

  const filesForNav = useMemo((): DashboardMockFile[] => {
    const wid = activeWorkspace.id;
    if (nav === "home") return [];
    if (nav === "recent") return mockFiltered.filter((f) => f.kind === "recent" && f.workspaceId === wid);
    if (nav === "drafts") return mockFiltered.filter((f) => f.kind === "draft" && f.workspaceId === wid);
    if (nav === "team") return [];
    if (nav === "templates" || nav === "trash") return [];
    return mockFiltered.filter((f) => f.workspaceId === wid);
  }, [nav, mockFiltered, activeWorkspace.id]);

  const filesBySectionForHome = useMemo(() => {
    const map = new Map<string, DashboardMockFile[]>();
    for (const sec of SECTION_ORDER) {
      const ws = workspacesForSidebar.find((w) => w.section === sec);
      if (!ws) continue;
      map.set(ws.id, mockFiltered.filter((f) => f.workspaceId === ws.id));
    }
    return map;
  }, [mockFiltered, workspacesForSidebar]);

  const apiFilesFilteredInWorkspace = useCallback(
    (workspaceId: string): CraftFileSummary[] => {
      const list = apiFilesByWorkspace[workspaceId] ?? [];
      const q = search.trim().toLowerCase();
      if (!q) return list;
      return list.filter((f) => f.name.toLowerCase().includes(q));
    },
    [apiFilesByWorkspace, search],
  );

  const apiFilesForActiveNav = useMemo((): CraftFileSummary[] => {
    const list = apiFilesByWorkspace[activeWorkspace.id] ?? [];
    const sorted = [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const q = search.trim().toLowerCase();
    const filtered = !q ? sorted : sorted.filter((f) => f.name.toLowerCase().includes(q));
    if (nav === "recent") return filtered.slice(0, 12);
    if (nav === "drafts") return filtered;
    return filtered;
  }, [apiFilesByWorkspace, activeWorkspace.id, nav, search]);

  const sectionTitle = useMemo(() => {
    switch (nav) {
      case "home":
        return teamSwitcherProps ? "Files in team" : dashboardTeamGroups ? "Files by team" : "Files by workspace";
      case "recent":
        return "Recent files";
      case "drafts":
        return "Drafts";
      case "team":
        return "Team";
      case "templates":
        return "Templates";
      case "trash":
        return "Trash";
      default:
        return "Files";
    }
  }, [nav, dashboardTeamGroups, teamSwitcherProps]);

  const onSidebarInvite = useCallback(() => {
    if (isApi) {
      void inviteWorkspaceMemberByEmail(activeWorkspace.id, sidebarInviteEmail)
        .then(() => setSidebarInviteEmail(""))
        .catch((e) => {
          window.alert(e instanceof Error ? e.message : "Invite failed.");
        });
      return;
    }
    const row = inviteMockMember(sidebarInviteEmail);
    if (row) {
      window.alert(`Invitation saved locally for ${row.email}.`);
      setSidebarInviteEmail("");
    } else {
      window.alert("Enter a valid email address.");
    }
  }, [isApi, activeWorkspace.id, sidebarInviteEmail, inviteWorkspaceMemberByEmail]);

  const apiOwnerName = apiUser?.displayName ?? "You";
  const apiOwnerInitials = apiUser ? craftUserToMockUser(apiUser).initials : "Y";

  if (isApi && apiLoading) {
    return (
      <div className="flex min-h-dvh bg-app-bg text-app-fg antialiased">
        <aside className="hidden w-[240px] shrink-0 border-r border-app-border bg-app-card md:block" aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-app-border bg-app-card px-6 py-4">
            <PaytmCraftApiModeBanner />
            <div className="mt-3 h-5 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-app-inset" />
          </header>
          <main className="flex-1 px-6 py-6">
            <div className="mx-auto max-w-6xl">
              <p className="mb-4 text-ui-sm font-medium text-app-muted">Loading workspaces and files…</p>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <FileCardSkeleton key={i} />
                ))}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isApi && apiError) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-app-bg px-6 text-app-fg antialiased">
        <PaytmCraftApiModeBanner />
        <p className="text-sm font-semibold text-red-800">Could not load dashboard</p>
        <p className="max-w-md text-center text-ui-sm text-app-muted">{apiError}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {isRemote ? (
            <button
              type="button"
              onClick={() => setLoginModalOpen(true)}
              className="rounded-lg border border-app-border bg-app-card px-4 py-2 text-ui-sm font-semibold text-app-fg hover:bg-app-raised"
            >
              Sign in
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setApiRefreshKey((k) => k + 1)}
            className="rounded-lg bg-app-fg px-4 py-2 text-ui-sm font-semibold text-app-bg hover:bg-app-muted"
          >
            Retry
          </button>
        </div>
        <RemoteAuthLoginModal
          open={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
          onSuccess={() => setApiRefreshKey((k) => k + 1)}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-app-bg text-app-fg antialiased">
      <AIGenerateModal />
      <ImportHub />
      <CodeRoundTripModal />
      <ImportFigmaModal onImportFigFile={onImportFile} />
      <FigImportOverlay />
      <FigImportFinishEffect />
      <FigImportToast />
      <ImportWebModal />
      <RemoteAuthLoginModal
        open={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onSuccess={() => setApiRefreshKey((k) => k + 1)}
        defaultEmail="rahul.verma@paytm.com"
      />
      <DashboardSidebar
        active={nav}
        onNavigate={setNav}
        workspaces={workspacesForSidebar}
        activeWorkspace={activeWorkspace}
        onSwitchWorkspace={(id) => {
          switchMockWorkspace(id);
        }}
        currentUser={currentUserForSidebar}
        teamPreviewMembers={teamPreviewMembers}
        inviteEmail={sidebarInviteEmail}
        onInviteEmailChange={setSidebarInviteEmail}
        onInviteSubmit={onSidebarInvite}
        remoteAuthActions={
          isRemote
            ? {
                onSignIn: () => setLoginModalOpen(true),
                onSignOut: () => void handleRemoteSignOut(),
              }
            : undefined
        }
        teamGroups={visibleTeamGroups}
        orgTeamName={activeOrgTeamName}
        teamSwitcher={
          teamSwitcherProps
            ? { ...teamSwitcherProps, onSwitchTeam: handleSwitchTeam }
            : undefined
        }
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-app-border bg-app-card px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-semibold tracking-tight text-app-fg">Paytm Craft</h1>
            <p className="text-ui text-app-muted">
              <span className="font-medium text-app-fg">{activeWorkspace.name}</span>
              {activeOrgTeamName ? (
                <>
                  <span className="text-app-subtle"> · </span>
                  <span>{activeOrgTeamName}</span>
                </>
              ) : null}
              <span className="text-app-subtle"> · </span>
              Design, prototype, and ship product UI.
            </p>
          </div>
          {isApi ? <PaytmCraftApiModeBanner /> : null}
          <div className="relative hidden max-w-md flex-1 basis-[200px] md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" strokeWidth={2} />
            <input
              type="search"
              placeholder="Search files and templates…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-app-border bg-app-raised pl-9 pr-3 text-ui-sm text-app-fg outline-none placeholder:text-app-subtle focus:border-accent/40 focus:bg-app-card focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle size="sm" />
            <Link
              href="/demo-checklist"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg border border-app-border bg-app-raised px-2.5 py-1 text-ui font-medium text-app-muted transition-colors hover:border-slate-300 hover:bg-app-card sm:inline"
            >
              Demo checklist
            </Link>
            <span className="hidden rounded-full border border-app-border bg-app-raised px-2.5 py-1 text-ui font-medium text-app-muted sm:inline">
              {activeWorkspace.slug}
            </span>
          </div>
        </header>

        <main className="thin-scroll flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-8">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onNewDesign()}
                className="inline-flex items-center gap-2 rounded-lg bg-app-fg px-4 py-2 text-ui-sm font-semibold text-app-bg shadow-sm transition-colors hover:bg-app-muted"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Create new design
              </button>
              <button
                type="button"
                onClick={() => openAIModal("dashboard")}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-400/40 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-ui-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-95"
              >
                <Sparkles className="h-4 w-4 text-white" strokeWidth={2} />
                Generate with AI
              </button>
              <button
                type="button"
                onClick={() => openImportHub()}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-ui-sm font-semibold text-sky-900 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100"
              >
                <Download className="h-4 w-4" strokeWidth={2} />
                Import design…
              </button>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-4 py-2 text-ui-sm font-medium text-app-fg shadow-sm transition-colors hover:border-slate-300 hover:bg-app-raised"
              >
                <Upload className="h-4 w-4" strokeWidth={2} />
                Import file…
              </button>
              <input
                ref={importRef}
                type="file"
                accept=".paytmcraft.json,.fig,application/json,.json,application/octet-stream"
                className="sr-only"
                aria-hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  void onImportFile(f ?? null);
                }}
              />
              <Link
                href="/editor"
                className="text-ui font-medium text-app-muted underline-offset-2 hover:text-app-fg hover:underline"
              >
                Open last editor session
              </Link>
            </div>

            {hasLocalDoc ? (
              <section>
                <h2 className="mb-3 section-heading text-app-muted">Recovered</h2>
                <div className="max-w-sm rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm">
                  <p className="text-ui-sm font-medium text-amber-950">Recovered local document</p>
                  <p className="mt-1 text-ui leading-relaxed text-amber-900/80">
                    A file was found in this browser&apos;s storage. Open it to continue where you left off.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenRecovered}
                    className="mt-3 rounded-lg bg-amber-900 px-3 py-1.5 text-ui font-semibold text-amber-50 hover:bg-amber-950"
                  >
                    Open recovered file
                  </button>
                </div>
              </section>
            ) : null}

            {nav === "team" ? (
              <>
                <DashboardTeamView
                  workspace={activeWorkspaceForView}
                  useApiMembers={isApi}
                  apiMembers={apiMembersByWorkspace[activeWorkspace.id]}
                  apiPendingInvites={apiInvitesByWorkspace[activeWorkspace.id]}
                  membersLoading={isApi && membersLoading}
                  onInviteApi={
                    isApi
                      ? (email) => inviteWorkspaceMemberByEmail(activeWorkspace.id, email)
                      : undefined
                  }
                />
                {showApiTokens ? (
                  <DashboardApiTokensPanel
                    tokens={apiTokens}
                    loading={apiTokensLoading}
                    onCreate={handleCreateApiToken}
                    onRevoke={handleRevokeApiToken}
                  />
                ) : null}
              </>
            ) : null}

            {nav !== "templates" && nav !== "trash" && nav !== "team" ? (
              <section>
                <h2 className="mb-3 section-heading text-app-muted">{sectionTitle}</h2>
                {isApi ? (
                  nav === "home" ? (
                    <div className="flex flex-col gap-8">
                      {(visibleTeamGroups ?? dashboardTeamGroups)
                        ? (visibleTeamGroups ?? dashboardTeamGroups)!.map((group) => (
                            <div key={group.id} className="flex flex-col gap-6">
                              <h3 className="text-ui-sm font-semibold text-app-fg">{group.name}</h3>
                              {group.workspaces.map((ws) => {
                                const files = apiFilesFilteredInWorkspace(ws.id);
                                return (
                                  <div key={ws.id}>
                                    <h4 className="mb-2 text-ui font-medium text-app-muted">{ws.name}</h4>
                                    {files.length === 0 ? (
                                      <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-6 text-ui-sm text-app-muted">
                                        No files in this workspace match your search.
                                      </p>
                                    ) : (
                                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {files.map((f) => (
                                          <FileCard
                                            key={f.id}
                                            name={f.name}
                                            lastEdited={formatApiFileUpdated(f.updatedAt)}
                                            ownerName={apiOwnerName}
                                            ownerInitials={apiOwnerInitials}
                                            workspaceName={ws.name}
                                            sharedInitials={[]}
                                            fileBadge="team"
                                            accent={accentGradientForApiId(f.id)}
                                            onOpen={() => void openApiFileById(f.id)}
                                          />
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ))
                        : SECTION_ORDER.map((sec) => {
                            const ws = workspacesForSidebar.find((w) => w.section === sec);
                            if (!ws) return null;
                            const files = apiFilesFilteredInWorkspace(ws.id);
                            return (
                              <div key={ws.id}>
                                <h3 className="mb-2 text-ui-sm font-semibold text-app-fg">{ws.name}</h3>
                                {files.length === 0 ? (
                                  <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-6 text-ui-sm text-app-muted">
                                    No files in this workspace match your search.
                                  </p>
                                ) : (
                                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {files.map((f) => (
                                      <FileCard
                                        key={f.id}
                                        name={f.name}
                                        lastEdited={formatApiFileUpdated(f.updatedAt)}
                                        ownerName={apiOwnerName}
                                        ownerInitials={apiOwnerInitials}
                                        workspaceName={ws.name}
                                        sharedInitials={[]}
                                        fileBadge="team"
                                        accent={accentGradientForApiId(f.id)}
                                        onOpen={() => void openApiFileById(f.id)}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                    </div>
                  ) : apiFilesForActiveNav.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-8 text-center text-ui-sm text-app-muted">
                      No files match your search in this workspace.
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {apiFilesForActiveNav.map((f) => (
                        <FileCard
                          key={f.id}
                          name={f.name}
                          lastEdited={formatApiFileUpdated(f.updatedAt)}
                          ownerName={apiOwnerName}
                          ownerInitials={apiOwnerInitials}
                          workspaceName={activeWorkspace.name}
                          sharedInitials={[]}
                          fileBadge="team"
                          accent={accentGradientForApiId(f.id)}
                          onOpen={() => void openApiFileById(f.id)}
                        />
                      ))}
                    </div>
                  )
                ) : nav === "home" ? (
                  <div className="flex flex-col gap-8">
                    {SECTION_ORDER.map((sec) => {
                      const ws = workspacesForSidebar.find((w) => w.section === sec);
                      if (!ws) return null;
                      const files = filesBySectionForHome.get(ws.id) ?? [];
                      return (
                        <div key={ws.id}>
                          <h3 className="mb-2 text-ui-sm font-semibold text-app-fg">{ws.name}</h3>
                          {files.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-6 text-ui-sm text-app-muted">
                              No files in this workspace match your search.
                            </p>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {files.map((f) => (
                                <FileCard
                                  key={f.id}
                                  name={f.name}
                                  lastEdited={f.lastEditedLabel}
                                  ownerName={f.ownerName}
                                  ownerInitials={f.ownerInitials}
                                  workspaceName={f.workspaceName}
                                  sharedInitials={f.sharedInitials}
                                  fileBadge={f.fileBadge}
                                  accent={f.accent}
                                  onOpen={() => {
                                    const slice = getTemplatePersistSlice(f.templateId);
                                    if (slice) openEditor(slice);
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : filesForNav.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-8 text-center text-ui-sm text-app-muted">
                    No files match your search in this workspace.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filesForNav.map((f) => (
                      <FileCard
                        key={f.id}
                        name={f.name}
                        lastEdited={f.lastEditedLabel}
                        ownerName={f.ownerName}
                        ownerInitials={f.ownerInitials}
                        workspaceName={f.workspaceName}
                        sharedInitials={f.sharedInitials}
                        fileBadge={f.fileBadge}
                        accent={f.accent}
                        onOpen={() => {
                          const slice = getTemplatePersistSlice(f.templateId);
                          if (slice) openEditor(slice);
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {(nav === "home" || nav === "templates") && (
              <section>
                <h2 className="mb-3 section-heading text-app-muted">Templates</h2>
                {templatesFiltered.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-8 text-center text-ui-sm text-app-muted">
                    No templates match your search.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {templatesFiltered.map((t) => (
                      <TemplateCard
                        key={t.id}
                        title={t.title}
                        description={t.description}
                        accent={t.accent}
                        onUse={() => {
                          const slice = getTemplatePersistSlice(t.id);
                          if (slice) openEditor(slice);
                        }}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {nav === "trash" ? (
              <section>
                <h2 className="mb-3 section-heading text-app-muted">Trash</h2>
                <div className="rounded-xl border border-dashed border-app-border bg-app-card px-6 py-16 text-center shadow-sm">
                  <p className="text-sm font-medium text-app-fg">Trash is empty</p>
                  <p className="mx-auto mt-2 max-w-md text-ui-sm leading-relaxed text-app-muted">
                    Deleted files will appear here. This demo does not persist trash — connect a backend to sync deleted
                    projects.
                  </p>
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
