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
  validatePaytmCraftDocument,
} from "@/lib/documentPersistence";
import { isFigmaFigFile } from "@/lib/figImport";
import { waitForNextPaint } from "@/lib/figImport/figImportRuntime";
import { FigImportOverlay } from "@/components/import/FigImportOverlay";
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
import { isPaytmCraftApiMode } from "@/lib/env";
import { apiClient, type CraftFileSummary, type CraftUser, type CraftWorkspace, type CraftFileDetail } from "@/lib/apiClient";
import {
  accentGradientForApiId,
  craftUserToMockUser,
  craftWorkspaceToMockWorkspace,
  formatApiFileUpdated,
  ownerMemberFromCraftUser,
} from "@/lib/dashboardApiAdapters";
import { PaytmCraftApiModeBanner } from "@/components/PaytmCraftApiModeBanner";
import { ThemeToggle } from "@/components/ThemeToggle";

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

function persistSliceFromApiFileDetail(detail: CraftFileDetail): EditorPersistSlice {
  const raw = detail.documentJson;
  if (raw != null && validatePaytmCraftDocument(raw)) {
    const patch = documentToEditorPatch(raw);
    return { ...patch, fileName: detail.name };
  }
  const slice = blankWorkspace();
  return { ...slice, fileName: detail.name };
}

function DashboardTeamView({ workspace }: { workspace: MockWorkspace }) {
  const ws = workspace;
  const pending = readPendingInvites().filter((i) => i.workspaceId === ws.id);
  const [email, setEmail] = useState("");

  return (
    <section>
      <h2 className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-app-muted">Team</h2>
      <p className="mb-4 text-[13px] text-app-muted">
        Members and invites for <span className="font-semibold text-app-fg">{ws.name}</span>. Everything stays in this
        browser — no API calls.
      </p>

      <div className="mb-6 overflow-hidden rounded-xl border border-app-border bg-app-card shadow-sm">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-app-border-subtle bg-app-raised text-[11px] font-semibold uppercase tracking-wide text-app-muted">
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
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-inset text-[10px] font-bold text-app-fg">
                      {m.initials}
                    </span>
                    <span className="font-medium text-app-fg">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-app-muted">{m.email}</td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold", roleBadgeClass(m.role))}>
                    {roleLabel(m.role)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-6 rounded-xl border border-app-border bg-app-card p-4 shadow-sm">
        <h3 className="text-[12px] font-semibold text-app-fg">Invite by email</h3>
        <p className="mt-1 text-[12px] text-app-muted">Creates a pending invite row stored in localStorage.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@paytm.com"
            className="h-9 min-w-0 flex-1 rounded-lg border border-app-border bg-app-card px-3 text-[13px] text-app-fg outline-none ring-slate-900/10 placeholder:text-app-subtle focus:border-slate-300 focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const row = inviteMockMember(email);
                if (row) {
                  window.alert(`Pending invite saved for ${row.email}.`);
                  setEmail("");
                } else window.alert("Enter a valid email.");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              const row = inviteMockMember(email);
              if (row) {
                window.alert(`Pending invite saved for ${row.email}.`);
                setEmail("");
              } else window.alert("Enter a valid email.");
            }}
            className="h-9 shrink-0 rounded-lg bg-app-fg px-4 text-[13px] font-semibold text-app-bg hover:bg-app-muted"
          >
            Send invite
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-app-border bg-app-raised/50 p-4">
        <h3 className="text-[12px] font-semibold text-app-fg">Pending invites</h3>
        {pending.length === 0 ? (
          <p className="mt-2 text-[13px] text-app-muted">No pending invites for this workspace.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 rounded-lg border border-app-border bg-app-card">
            {pending.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-[13px]">
                <span className="font-medium text-app-fg">{p.email}</span>
                <span className="shrink-0 text-[11px] text-app-muted">Pending · local only</span>
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

  const isApi = isPaytmCraftApiMode();

  const [apiRefreshKey, setApiRefreshKey] = useState(0);
  const [apiLoading, setApiLoading] = useState(isApi);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiUser, setApiUser] = useState<CraftUser | null>(null);
  const [apiWorkspaces, setApiWorkspaces] = useState<CraftWorkspace[]>([]);
  const [apiFilesByWorkspace, setApiFilesByWorkspace] = useState<Record<string, CraftFileSummary[]>>({});

  useEffect(() => subscribeMockAuth(() => setAuthTick((n) => n + 1)), []);

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
        const [user, workspaces] = await Promise.all([apiClient.getCurrentUser(), apiClient.listWorkspaces()]);
        if (cancelled) return;
        if (!user) {
          setApiError("No user returned from API.");
          return;
        }
        setApiUser(user);
        setApiWorkspaces(workspaces);
        const entries = await Promise.all(
          workspaces.map(async (w) => [w.id, await apiClient.listFiles({ workspaceId: w.id })] as const),
        );
        if (cancelled) return;
        setApiFilesByWorkspace(Object.fromEntries(entries));
      } catch (e) {
        if (!cancelled) {
          setApiError(e instanceof Error ? e.message : "Failed to load dashboard data.");
        }
      } finally {
        if (!cancelled) setApiLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isApi, apiRefreshKey]);

  useEffect(() => {
    if (!isApi || apiWorkspaces.length === 0) return;
    const activeId = getActiveMockWorkspace().id;
    if (!apiWorkspaces.some((w) => w.id === activeId)) {
      switchMockWorkspace(apiWorkspaces[0]!.id);
    }
  }, [isApi, apiWorkspaces]);

  const activeWorkspace = useActiveMockWorkspace();

  const workspacesForSidebar = useMemo((): MockWorkspace[] => {
    if (isApi && apiUser && apiWorkspaces.length > 0) {
      const m = ownerMemberFromCraftUser(apiUser);
      return apiWorkspaces.map((w) => craftWorkspaceToMockWorkspace(w, [m]));
    }
    void authTick;
    return getMockWorkspaces();
  }, [isApi, apiUser, apiWorkspaces, authTick]);

  const currentUserForSidebar = useMemo(() => {
    if (isApi && apiUser) return craftUserToMockUser(apiUser);
    return getMockCurrentUser();
  }, [isApi, apiUser]);

  const teamPreviewMembers = useMemo(() => {
    if (isApi && apiUser) return [ownerMemberFromCraftUser(apiUser)];
    return activeWorkspace.members;
  }, [isApi, apiUser, activeWorkspace.members]);

  useEffect(() => {
    setHasLocalDoc(readLocalDocument() != null);
  }, []);

  const openEditor = useCallback(
    async (slice: EditorPersistSlice, apiSession?: { apiFileId: string; apiWorkspaceId?: string }) => {
      await useEditorStore.getState().loadWorkspaceFromPersist(slice, apiSession);
      router.push("/editor");
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
        });
      } catch (e) {
        window.alert(e instanceof Error ? e.message : "Could not open file.");
      }
    },
    [openEditor],
  );

  const onNewDesign = useCallback(async () => {
    if (isPaytmCraftApiMode()) {
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
        } catch {
          window.alert("Could not import that Figma file.");
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
        if (isPaytmCraftApiMode()) {
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
              { apiFileId: created.id, apiWorkspaceId: wid },
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
        return "Files by workspace";
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
  }, [nav]);

  const onSidebarInvite = useCallback(() => {
    const row = inviteMockMember(sidebarInviteEmail);
    if (row) {
      window.alert(`Invitation saved locally for ${row.email}.`);
      setSidebarInviteEmail("");
    } else {
      window.alert("Enter a valid email address.");
    }
  }, [sidebarInviteEmail]);

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
              <p className="mb-4 text-[13px] font-medium text-app-muted">Loading workspaces and files…</p>
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
        <p className="text-[14px] font-semibold text-red-800">Could not load dashboard</p>
        <p className="max-w-md text-center text-[13px] text-app-muted">{apiError}</p>
        <button
          type="button"
          onClick={() => setApiRefreshKey((k) => k + 1)}
          className="rounded-lg bg-app-fg px-4 py-2 text-[13px] font-semibold text-app-bg hover:bg-app-muted"
        >
          Retry
        </button>
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
      <ImportWebModal />
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
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-app-border bg-app-card px-6 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold tracking-tight text-app-fg">Paytm Craft</h1>
            <p className="text-[12px] text-app-muted">
              <span className="font-medium text-app-fg">{activeWorkspace.name}</span>
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
              className="h-9 w-full rounded-lg border border-app-border bg-app-raised pl-9 pr-3 text-[13px] text-app-fg outline-none placeholder:text-app-subtle focus:border-accent/40 focus:bg-app-card focus:ring-1 focus:ring-accent/30"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle size="sm" />
            <Link
              href="/demo-checklist"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-lg border border-app-border bg-app-raised px-2.5 py-1 text-[11px] font-medium text-app-muted transition-colors hover:border-slate-300 hover:bg-app-card sm:inline"
            >
              Demo checklist
            </Link>
            <span className="hidden rounded-full border border-app-border bg-app-raised px-2.5 py-1 text-[11px] font-medium text-app-muted sm:inline">
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
                className="inline-flex items-center gap-2 rounded-lg bg-app-fg px-4 py-2 text-[13px] font-semibold text-app-bg shadow-sm transition-colors hover:bg-app-muted"
              >
                <Plus className="h-4 w-4" strokeWidth={2} />
                Create new design
              </button>
              <button
                type="button"
                onClick={() => openAIModal("dashboard")}
                className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-[13px] font-semibold text-app-bg shadow-sm transition-opacity hover:opacity-95"
              >
                <Sparkles className="h-4 w-4" strokeWidth={2} />
                Generate with AI
              </button>
              <button
                type="button"
                onClick={() => openImportHub()}
                className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-[13px] font-semibold text-sky-900 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100"
              >
                <Download className="h-4 w-4" strokeWidth={2} />
                Import design…
              </button>
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-lg border border-app-border bg-app-card px-4 py-2 text-[13px] font-medium text-app-fg shadow-sm transition-colors hover:border-slate-300 hover:bg-app-raised"
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
                className="text-[12px] font-medium text-app-muted underline-offset-2 hover:text-app-fg hover:underline"
              >
                Open last editor session
              </Link>
            </div>

            {hasLocalDoc ? (
              <section>
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-app-muted">Recovered</h2>
                <div className="max-w-sm rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 shadow-sm">
                  <p className="text-[13px] font-medium text-amber-950">Recovered local document</p>
                  <p className="mt-1 text-[12px] leading-relaxed text-amber-900/80">
                    A file was found in this browser&apos;s storage. Open it to continue where you left off.
                  </p>
                  <button
                    type="button"
                    onClick={onOpenRecovered}
                    className="mt-3 rounded-lg bg-amber-900 px-3 py-1.5 text-[12px] font-semibold text-amber-50 hover:bg-amber-950"
                  >
                    Open recovered file
                  </button>
                </div>
              </section>
            ) : null}

            {nav === "team" ? (
              <DashboardTeamView workspace={activeWorkspace} />
            ) : null}

            {nav !== "templates" && nav !== "trash" && nav !== "team" ? (
              <section>
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-app-muted">{sectionTitle}</h2>
                {isApi ? (
                  nav === "home" ? (
                    <div className="flex flex-col gap-8">
                      {SECTION_ORDER.map((sec) => {
                        const ws = workspacesForSidebar.find((w) => w.section === sec);
                        if (!ws) return null;
                        const files = apiFilesFilteredInWorkspace(ws.id);
                        return (
                          <div key={ws.id}>
                            <h3 className="mb-2 text-[13px] font-semibold text-app-fg">{ws.name}</h3>
                            {files.length === 0 ? (
                              <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-6 text-[13px] text-app-muted">
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
                    <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-8 text-center text-[13px] text-app-muted">
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
                          <h3 className="mb-2 text-[13px] font-semibold text-app-fg">{ws.name}</h3>
                          {files.length === 0 ? (
                            <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-6 text-[13px] text-app-muted">
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
                  <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-8 text-center text-[13px] text-app-muted">
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
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-app-muted">Templates</h2>
                {templatesFiltered.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-app-border bg-app-card px-4 py-8 text-center text-[13px] text-app-muted">
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
                <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-app-muted">Trash</h2>
                <div className="rounded-xl border border-dashed border-app-border bg-app-card px-6 py-16 text-center shadow-sm">
                  <p className="text-[14px] font-medium text-app-fg">Trash is empty</p>
                  <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-app-muted">
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
