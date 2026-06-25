"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, PanelLeft, Plus, Search, Sparkles, Upload } from "lucide-react";
import { DashboardSidebar, type DashboardNavId } from "./DashboardSidebar";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
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
} from "@/lib/documentPersistence";
import { isFigmaFigFile } from "@/lib/figImport";
import { waitForNextPaint } from "@/lib/figImport/figImportRuntime";
import { FigImportFinishEffect } from "@/components/import/FigImportFinishEffect";
import { FigImportOverlay } from "@/components/import/FigImportOverlay";
import { FigImportToast } from "@/components/import/FigImportToast";
import { AIGenerateModal } from "@/components/ai/AIGenerateModal";
import { AIKeysProvider } from "@/components/ai/useAIKeys";
import { AIAddKeyModal, AIKeysManageModal } from "@/components/ai/AIKeysModals";
import { ImportHub } from "@/components/import/ImportHub";
import { CodeRoundTripModal } from "@/components/code/CodeRoundTripModal";
import { ImportFigmaModal } from "@/components/import/ImportFigmaModal";
import { McpConnectionsModal } from "@/components/mcp/McpConnectionsModal";
import { ImportWebModal } from "@/components/import/ImportWebModal";
import { IntentDialog } from "@/components/ui/IntentDialog";
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
import { DashboardApiTokensPanel } from "@/components/dashboard/DashboardApiTokensPanel";
import { DashboardTopChrome } from "@/components/dashboard/DashboardTopChrome";
import { EditorDocumentPersistence } from "@/components/editor/EditorDocumentPersistence";
import { apiTokenCreatedSuccessMessage, type ApiTokenResourceScope } from "@/lib/apiTokenManagement";
import {
  formatDashboardSavedFileEdited,
  readDashboardSavedFiles,
  removeDashboardSavedFile,
  subscribeDashboardSavedFiles,
  type DashboardSavedFile,
} from "@/lib/dashboardSavedFiles";

function matchesSearch(q: string, ...parts: string[]) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return parts.some((p) => p.toLowerCase().includes(s));
}

const SECTION_ORDER: MockWorkspace["section"][] = ["personal", "paytm-design", "product-team", "experiments"];

function roleBadgeClass(role: MockMemberRole): string {
  switch (role) {
    case "owner":
      return "border-app-border-subtle bg-app-inset text-app-fg";
    case "editor":
      return "border-app-border-subtle bg-app-inset text-app-fg";
    default:
      return "border-app-border-subtle bg-app-inset text-app-muted";
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

      <div className="editor-sidebar-section mb-6 overflow-hidden shadow-none">
        <table className="w-full text-left text-ui">
          <thead className="border-b border-app-panel-edge bg-app-inset section-heading text-app-muted">
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

      <div className="editor-sidebar-section mb-6 p-4 shadow-none">
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
            className="h-9 min-w-0 flex-1 rounded-lg border border-app-border bg-app-inset px-3 text-ui text-app-fg outline-none transition-colors placeholder:text-app-subtle hover:bg-app-hover focus:border-app-border disabled:opacity-60"
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

      <div className="editor-sidebar-section border-dashed p-4 shadow-none">
        <h3 className="text-ui font-semibold text-app-fg">Pending invites</h3>
        {(useApiMembers ? apiPending : pending).length === 0 ? (
          <p className="mt-2 text-ui-sm text-app-muted">No pending invites for this workspace.</p>
        ) : useApiMembers ? (
          <ul className="mt-3 divide-y divide-app-panel-edge rounded-lg border border-app-border-subtle bg-app-inset">
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
          <ul className="mt-3 divide-y divide-app-panel-edge rounded-lg border border-app-border-subtle bg-app-inset">
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
  const [authTick, setAuthTick] = useState(0);
  const [sidebarInviteEmail, setSidebarInviteEmail] = useState("");
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(true);
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
  const [savedFilesTick, setSavedFilesTick] = useState(0);
  const [savedFilesReady, setSavedFilesReady] = useState(false);
  const [deleteFileTarget, setDeleteFileTarget] = useState<DashboardSavedFile | null>(null);

  useEffect(() => subscribeMockAuth(() => setAuthTick((n) => n + 1)), []);
  useEffect(() => {
    setSavedFilesReady(true);
  }, []);
  useEffect(() => subscribeDashboardSavedFiles(() => setSavedFilesTick((n) => n + 1)), []);
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
          setApiUser(null);
          setApiWorkspaces([]);
          setApiTeams([]);
          setApiFilesByWorkspace({});
          setApiMembersByWorkspace({});
          setApiInvitesByWorkspace({});
          setApiTeamMembersByTeam({});
          setApiError(null);
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
          if (e instanceof ApiRequestError && e.status === 401 && (isRemote || isApi)) {
            setApiUser(null);
            setApiWorkspaces([]);
            setApiTeams([]);
            setApiFilesByWorkspace({});
            setApiMembersByWorkspace({});
            setApiInvitesByWorkspace({});
            setApiTeamMembersByTeam({});
            setApiError(null);
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
      setApiUser(null);
      setApiWorkspaces([]);
      setApiTeams([]);
      setApiRefreshKey((k) => k + 1);
      router.replace("/login");
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Sign out failed.");
    }
  }, [router]);

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

  const dashboardSavedFiles = useMemo(() => {
    if (!savedFilesReady) return [];
    void savedFilesTick;
    return readDashboardSavedFiles();
  }, [savedFilesReady, savedFilesTick]);

  const openSavedFile = useCallback(
    async (file: DashboardSavedFile) => {
      const patch = documentToEditorPatch(file.document);
      await openEditor(patch);
    },
    [openEditor],
  );

  const deleteSavedFile = useCallback((file: DashboardSavedFile) => {
    setDeleteFileTarget(file);
  }, []);

  const confirmDeleteSavedFile = useCallback(() => {
    if (!deleteFileTarget) return;
    removeDashboardSavedFile(deleteFileTarget.id);
    setDeleteFileTarget(null);
  }, [deleteFileTarget]);

  const savedFilesMatchingSearch = useMemo(() => {
    const q = search;
    return dashboardSavedFiles.filter((f) => matchesSearch(q, f.name));
  }, [dashboardSavedFiles, search]);

  const savedFilesForWorkspace = useCallback(
    (workspaceId: string) =>
      savedFilesMatchingSearch.filter((f) => f.workspaceId === workspaceId),
    [savedFilesMatchingSearch],
  );

  const savedFilesForActiveNav = useMemo(() => {
    if (nav !== "recent" && nav !== "drafts") return [];
    return savedFilesMatchingSearch
      .filter((f) => f.workspaceId === activeWorkspace.id)
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }, [nav, savedFilesMatchingSearch, activeWorkspace.id]);

  const localOwnerName = getMockCurrentUser().name;
  const localOwnerInitials = getMockCurrentUser().initials;

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

  const renderSavedFileCard = useCallback(
    (file: DashboardSavedFile, workspaceName: string) => (
      <FileCard
        key={file.id}
        name={file.name}
        lastEdited={formatDashboardSavedFileEdited(file.savedAt)}
        ownerName={isApi ? apiOwnerName : localOwnerName}
        ownerInitials={isApi ? apiOwnerInitials : localOwnerInitials}
        workspaceName={workspaceName}
        sharedInitials={[]}
        fileBadge="draft"
        accent={accentGradientForApiId(file.id)}
        onOpen={() => void openSavedFile(file)}
        onDelete={() => deleteSavedFile(file)}
      />
    ),
    [
      isApi,
      apiOwnerName,
      apiOwnerInitials,
      localOwnerName,
      localOwnerInitials,
      openSavedFile,
      deleteSavedFile,
    ],
  );

  if (isApi && apiLoading) {
    return (
      <div
        data-editor-shell
        data-dashboard-shell
        className="flex h-dvh flex-col overflow-hidden bg-transparent font-sans text-app-fg antialiased"
      >
        <div className="relative min-h-0 flex-1 overflow-hidden bg-[hsl(var(--pc-canvas-workspace))]">
          <aside
            className="editor-sidebar-shell absolute inset-y-0 left-0 z-30 flex h-full w-[352px] flex-col gap-2 overflow-hidden p-2"
            aria-hidden
          >
            <div className="editor-sidebar-section h-12 animate-pulse bg-app-inset" />
            <div className="editor-sidebar-section min-h-0 flex-1 animate-pulse bg-app-inset" />
          </aside>
          <main className="thin-scroll absolute inset-y-0 right-0 left-[352px] overflow-y-auto p-2">
            <div className="pointer-events-auto flex w-full flex-col gap-2">
              <div className="editor-sidebar-section px-3.5 py-4 shadow-none">
                <PaytmCraftApiModeBanner />
                <div className="mt-3 h-5 w-48 animate-pulse rounded bg-app-inset" />
                <div className="mt-2 h-3 w-72 max-w-full animate-pulse rounded bg-app-raised" />
              </div>
              <div className="editor-sidebar-section p-4 shadow-none">
                <p className="mb-4 text-ui font-medium text-app-muted">Loading workspaces and files…</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }, (_, i) => (
                    <FileCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (isApi && apiError) {
    return (
      <div
        data-editor-shell
        data-dashboard-shell
        className="flex h-dvh flex-col items-center justify-center gap-4 bg-[hsl(var(--pc-canvas-workspace))] px-6 font-sans text-app-fg antialiased"
      >
        <div className="editor-sidebar-section pointer-events-auto max-w-md p-6 text-center shadow-none">
          <PaytmCraftApiModeBanner />
          <p className="mt-4 text-ui font-semibold text-app-fg">Could not load dashboard</p>
          <p className="mt-2 text-ui text-app-muted">{apiError}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {isApi || isRemote ? (
              <Link
                href="/login"
                className="rounded-lg border border-app-border-subtle bg-app-inset px-4 py-2 text-ui font-semibold text-app-fg transition-colors hover:bg-app-hover"
              >
                Sign in
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setApiRefreshKey((k) => k + 1)}
              className="rounded-lg border border-app-border-subtle bg-app-fg px-4 py-2 text-ui font-semibold text-app-bg transition-opacity hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AIKeysProvider>
    <div
      data-editor-shell
      data-dashboard-shell
      className="flex h-dvh flex-col overflow-hidden bg-transparent font-sans text-app-fg antialiased"
    >
      <AIGenerateModal />
      <AIAddKeyModal />
      <AIKeysManageModal />
      <ImportHub />
      <CodeRoundTripModal />
      <ImportFigmaModal onImportFigFile={onImportFile} />
      <McpConnectionsModal />
      <FigImportOverlay />
      <FigImportFinishEffect />
      <FigImportToast />
      <ImportWebModal />
      <IntentDialog
        open={deleteFileTarget != null}
        title={deleteFileTarget ? `Delete "${deleteFileTarget.name}"?` : "Delete file?"}
        description="This file and all of its content will be removed permanently. This cannot be undone."
        cancelLabel="Cancel"
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteFileTarget(null)}
        onConfirm={confirmDeleteSavedFile}
      />
      <EditorDocumentPersistence />

      <div className="relative min-h-0 flex-1 overflow-hidden bg-[hsl(var(--pc-canvas-workspace))]">
        <DashboardTopChrome leftSidebarVisible={leftSidebarVisible} />
        {leftSidebarVisible ? (
          <aside
            data-dashboard-aside
            className="editor-sidebar-shell absolute inset-y-0 left-0 z-30 flex h-full w-[352px] flex-col gap-2 overflow-hidden p-2"
          >
            <DashboardSidebar
              active={nav}
              onNavigate={setNav}
              workspaces={workspacesForSidebar}
              activeWorkspace={activeWorkspace}
              onSwitchWorkspace={(id) => {
                switchMockWorkspace(id);
              }}
              sidebarVisible={leftSidebarVisible}
              onToggleSidebar={() => setLeftSidebarVisible(false)}
              inviteEmail={sidebarInviteEmail}
              onInviteEmailChange={setSidebarInviteEmail}
              onInviteSubmit={onSidebarInvite}
              teamGroups={visibleTeamGroups}
              orgTeamName={activeOrgTeamName}
              teamSwitcher={
                teamSwitcherProps
                  ? { ...teamSwitcherProps, onSwitchTeam: handleSwitchTeam }
                  : undefined
              }
              showProfileSettings={isApi}
            />
          </aside>
        ) : null}
        {!leftSidebarVisible ? (
          <EditorHintWrap title="Show sidebar" anchorClassName="contents">
            <button
              type="button"
              aria-label="Show sidebar"
              onClick={() => setLeftSidebarVisible(true)}
              className="editor-sidebar-section pointer-events-auto absolute left-2 top-2 z-40 flex h-9 w-9 items-center justify-center text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
            >
              <PanelLeft className="size-icon-ui" strokeWidth={1.75} />
            </button>
          </EditorHintWrap>
        ) : null}

        <main
          className={cn(
            "thin-scroll absolute inset-y-0 right-0 overflow-y-auto p-2 pt-[72px]",
            leftSidebarVisible ? "left-[352px]" : "left-0",
          )}
        >
          <div className="pointer-events-auto flex w-full flex-col gap-2">
            <div className="editor-sidebar-section flex flex-col gap-6 p-4 shadow-none">
            {isApi ? (
              <div className="mb-2">
                <PaytmCraftApiModeBanner />
              </div>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void onNewDesign()}
                className="inline-flex items-center gap-2 rounded-lg border border-app-border-subtle bg-app-fg px-4 py-2 text-ui font-semibold text-app-bg transition-opacity hover:opacity-90"
              >
                <Plus className="size-icon-ui" strokeWidth={2} />
                Create new design
              </button>
              <button
                type="button"
                onClick={() => openAIModal("dashboard")}
                className="inline-flex items-center gap-2 rounded-lg border border-app-border-subtle bg-app-inset px-4 py-2 text-ui font-semibold text-app-fg transition-colors hover:border-app-border hover:bg-app-hover"
              >
                <Sparkles className="size-icon-ui text-app-muted" strokeWidth={2} />
                Generate with AI
              </button>
              <button
                type="button"
                onClick={() => openImportHub()}
                className="inline-flex items-center gap-2 rounded-lg border border-app-border-subtle bg-app-inset px-4 py-2 text-ui font-medium text-app-fg transition-colors hover:border-app-border hover:bg-app-hover"
              >
                <Download className="size-icon-ui" strokeWidth={2} />
                Import design…
              </button>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-app-border-subtle bg-app-inset px-4 py-2 text-ui font-medium text-app-fg transition-colors hover:border-app-border hover:bg-app-hover"
              >
                <Upload className="size-icon-ui" strokeWidth={2} />
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
              <div className="relative ml-auto hidden min-w-[200px] max-w-md flex-1 basis-[220px] md:block">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-icon-ui -translate-y-1/2 text-app-subtle"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  placeholder="Search files and templates…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-app-border bg-app-inset pl-9 pr-3 text-ui text-app-fg outline-none transition-colors placeholder:text-app-subtle hover:bg-app-hover focus:border-app-border"
                />
              </div>
            </div>

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
                                const saved = savedFilesForWorkspace(ws.id);
                                return (
                                  <div key={ws.id}>
                                    <h4 className="mb-2 text-ui font-medium text-app-muted">{ws.name}</h4>
                                    {files.length === 0 && saved.length === 0 ? (
                                      <p className="rounded-lg border border-dashed border-app-border-subtle bg-app-inset px-4 py-6 text-ui text-app-muted">
                                        No files in this workspace match your search.
                                      </p>
                                    ) : (
                                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                        {saved.map((f) => renderSavedFileCard(f, ws.name))}
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
                            const saved = savedFilesForWorkspace(ws.id);
                            return (
                              <div key={ws.id}>
                                <h3 className="mb-2 text-ui-sm font-semibold text-app-fg">{ws.name}</h3>
                                {files.length === 0 && saved.length === 0 ? (
                                  <p className="rounded-lg border border-dashed border-app-border-subtle bg-app-inset px-4 py-6 text-ui text-app-muted">
                                    No files in this workspace match your search.
                                  </p>
                                ) : (
                                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {saved.map((f) => renderSavedFileCard(f, ws.name))}
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
                  ) : apiFilesForActiveNav.length === 0 && savedFilesForActiveNav.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-app-border-subtle bg-app-inset px-4 py-8 text-center text-ui text-app-muted">
                      No files match your search in this workspace.
                    </p>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {savedFilesForActiveNav.map((f) => renderSavedFileCard(f, activeWorkspace.name))}
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
                      const saved = savedFilesForWorkspace(ws.id);
                      return (
                        <div key={ws.id}>
                          <h3 className="mb-2 text-ui-sm font-semibold text-app-fg">{ws.name}</h3>
                          {files.length === 0 && saved.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-app-border-subtle bg-app-inset px-4 py-6 text-ui text-app-muted">
                              No files in this workspace match your search.
                            </p>
                          ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                              {saved.map((f) => renderSavedFileCard(f, ws.name))}
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
                ) : filesForNav.length === 0 && savedFilesForActiveNav.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-app-border-subtle bg-app-inset px-4 py-8 text-center text-ui text-app-muted">
                    No files match your search in this workspace.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {savedFilesForActiveNav.map((f) => renderSavedFileCard(f, activeWorkspace.name))}
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
                  <p className="rounded-lg border border-dashed border-app-border-subtle bg-app-inset px-4 py-8 text-center text-ui text-app-muted">
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
                <div className="rounded-xl border border-dashed border-app-border-subtle bg-app-inset px-6 py-16 text-center">
                  <p className="text-sm font-medium text-app-fg">Trash is empty</p>
                  <p className="mx-auto mt-2 max-w-md text-ui-sm leading-relaxed text-app-muted">
                    Deleted files will appear here. This demo does not persist trash — connect a backend to sync deleted
                    projects.
                  </p>
                </div>
              </section>
            ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
    </AIKeysProvider>
  );
}
