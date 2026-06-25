"use client";

import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";
import Link from "next/link";
import {
  Home,
  Clock,
  FileEdit,
  LayoutGrid,
  Users,
  Trash2,
  ChevronDown,
  UserPlus,
  ListChecks,
  Settings,
} from "lucide-react";
import type { MockWorkspace } from "@/lib/mockAuth";
import type { DashboardTeamGroup } from "@/lib/dashboardTeamGrouping";
import { profileSettingsHref } from "@/lib/profileSettingsNavigation";
import { DashboardBrandHeader } from "./DashboardBrandHeader";

export type DashboardNavId = "home" | "recent" | "drafts" | "templates" | "team" | "trash";

const items: { id: DashboardNavId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "drafts", label: "Drafts", icon: FileEdit },
  { id: "templates", label: "Templates", icon: LayoutGrid },
  { id: "team", label: "Manage team", icon: Users },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const sectionLabels: Record<MockWorkspace["section"], string> = {
  personal: "Personal",
  "paytm-design": "Paytm Design",
  "product-team": "Product Team",
  experiments: "Experiments",
};

const selectClassName =
  "h-9 w-full cursor-pointer appearance-none rounded-lg border border-app-border bg-app-inset pl-3 pr-8 text-ui font-medium text-app-fg outline-none transition-colors hover:bg-app-hover focus:border-app-border";

export function DashboardSidebar({
  active,
  onNavigate,
  workspaces,
  activeWorkspace,
  onSwitchWorkspace,
  sidebarVisible,
  onToggleSidebar,
  inviteEmail,
  onInviteEmailChange,
  onInviteSubmit,
  teamGroups,
  orgTeamName,
  teamSwitcher,
  showProfileSettings = false,
}: {
  active: DashboardNavId;
  onNavigate: (id: DashboardNavId) => void;
  workspaces: MockWorkspace[];
  activeWorkspace: MockWorkspace;
  onSwitchWorkspace: (workspaceId: string) => void;
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  inviteEmail: string;
  onInviteEmailChange: (v: string) => void;
  onInviteSubmit: () => void;
  teamGroups?: DashboardTeamGroup[];
  orgTeamName?: string;
  teamSwitcher?: { teams: { id: string; name: string }[]; activeTeamId: string; onSwitchTeam: (teamId: string) => void };
  showProfileSettings?: boolean;
}) {
  return (
    <div className="pointer-events-auto flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <DashboardBrandHeader
        sidebarVisible={sidebarVisible}
        onToggleSidebar={onToggleSidebar}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden pt-3">
      <section className="editor-sidebar-section shrink-0 px-3.5 py-3">
        {teamSwitcher ? (
          <>
            <label className="section-heading">Team</label>
            <div className="relative mt-1.5">
              <select
                value={teamSwitcher.activeTeamId}
                onChange={(e) => teamSwitcher.onSwitchTeam(e.target.value)}
                className={selectClassName}
                aria-label="Active team"
              >
                {teamSwitcher.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 size-icon-ui -translate-y-1/2 text-app-subtle"
                strokeWidth={2}
              />
            </div>
          </>
        ) : null}
        <label className={cn("section-heading", teamSwitcher ? "mt-3 block" : "")}>Workspace</label>
        <div className="relative mt-1.5">
          <select
            value={activeWorkspace.id}
            onChange={(e) => onSwitchWorkspace(e.target.value)}
            className={selectClassName}
            aria-label="Active workspace"
          >
            {teamGroups && teamGroups.length > 0
              ? teamGroups.map((group) => (
                  <optgroup key={group.id} label={group.name}>
                    {group.workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </optgroup>
                ))
              : workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 size-icon-ui -translate-y-1/2 text-app-subtle"
            strokeWidth={2}
          />
        </div>
      </section>

      {teamGroups && teamGroups.length > 0 ? (
        <section className="editor-sidebar-section max-h-40 shrink-0 overflow-y-auto thin-scroll px-2 py-2">
          <p className="section-heading px-1.5">Teams</p>
          <div className="mt-1 space-y-2">
            {teamGroups.map((group) => (
              <div key={group.id}>
                <p className="px-1.5 text-ui font-medium text-app-subtle">{group.name}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {group.workspaces.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => onSwitchWorkspace(w.id)}
                        className={cn(
                          "panel-list-row w-full justify-between",
                          w.id === activeWorkspace.id
                            ? "bg-app-inset text-app-fg"
                            : "text-app-muted hover:bg-app-hover hover:text-app-fg",
                        )}
                      >
                        <span className="truncate">{w.name}</span>
                        {w.id === activeWorkspace.id ? (
                          <span className="shrink-0 text-ui text-app-subtle">Active</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="editor-sidebar-section shrink-0 px-2 py-2">
          <p className="section-heading px-1.5">Sections</p>
          <ul className="mt-1 space-y-0.5">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onSwitchWorkspace(w.id)}
                  className={cn(
                    "panel-list-row w-full justify-between",
                    w.id === activeWorkspace.id
                      ? "bg-app-inset text-app-fg"
                      : "text-app-muted hover:bg-app-hover hover:text-app-fg",
                  )}
                >
                  <span className="truncate">{sectionLabels[w.section]}</span>
                  {w.id === activeWorkspace.id ? (
                    <span className="shrink-0 text-ui text-app-subtle">Active</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="editor-sidebar-section flex min-h-0 flex-1 flex-col overflow-hidden">
        <nav className="thin-scroll flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-2">
          {items.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={cn(
                "panel-list-row w-full",
                active === id
                  ? "bg-app-inset text-app-fg"
                  : "text-app-muted hover:bg-app-hover hover:text-app-fg",
              )}
            >
              <Icon className="size-icon-ui shrink-0 opacity-90" strokeWidth={1.75} />
              {label}
            </button>
          ))}
        </nav>
      </section>

      <section className="editor-sidebar-section shrink-0 px-3.5 py-3">
        <p className="section-heading">{orgTeamName ? "Org team" : "Team"}</p>
        {orgTeamName ? (
          <p className="mt-1 text-ui text-app-muted">
            <span className="font-medium text-app-fg">{orgTeamName}</span>
          </p>
        ) : null}
        <div className="mt-3 flex gap-1.5">
          <input
            value={inviteEmail}
            onChange={(e) => onInviteEmailChange(e.target.value)}
            placeholder="Email"
            className="min-w-0 flex-1 rounded-lg border border-app-border bg-app-inset px-2.5 py-1.5 text-ui text-app-fg outline-none transition-colors placeholder:text-app-subtle hover:bg-app-hover focus:border-app-border"
            onKeyDown={(e) => {
              if (e.key === "Enter") onInviteSubmit();
            }}
          />
          <EditorHintWrap title="Invite to workspace">
            <button
              type="button"
              onClick={onInviteSubmit}
              aria-label="Invite to workspace"
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-app-border bg-app-fg px-2.5 py-1.5 text-ui font-semibold text-app-bg transition-opacity hover:opacity-90"
            >
              <UserPlus className="size-icon-ui" strokeWidth={2} />
              Invite
            </button>
          </EditorHintWrap>
        </div>
      </section>

      <section className="editor-sidebar-section shrink-0 px-2 py-2">
        {showProfileSettings ? (
          <Link
            href={profileSettingsHref("/")}
            className="panel-list-row w-full text-app-muted hover:bg-app-hover hover:text-app-fg"
          >
            <Settings className="size-icon-ui shrink-0 text-app-subtle" strokeWidth={1.75} />
            Profile &amp; settings
          </Link>
        ) : null}
        <Link
          href="/demo-checklist"
          target="_blank"
          rel="noopener noreferrer"
          className="panel-list-row w-full text-app-muted hover:bg-app-hover hover:text-app-fg"
        >
          <ListChecks className="size-icon-ui shrink-0 text-app-subtle" strokeWidth={1.75} />
          Demo checklist
        </Link>
      </section>
      </div>
    </div>
  );
}
