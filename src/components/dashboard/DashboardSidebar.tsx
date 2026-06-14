"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { Home, Clock, FileEdit, LayoutGrid, Users, Trash2, ChevronDown, UserPlus, ListChecks, LogOut, LogIn } from "lucide-react";
import type { MockTeamMember, MockUser, MockWorkspace } from "@/lib/mockAuth";
import type { DashboardTeamGroup } from "@/lib/dashboardTeamGrouping";

export type DashboardNavId = "home" | "recent" | "drafts" | "templates" | "team" | "trash";

const items: { id: DashboardNavId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "recent", label: "Recent", icon: Clock },
  { id: "drafts", label: "Drafts", icon: FileEdit },
  { id: "templates", label: "Templates", icon: LayoutGrid },
  { id: "team", label: "Team", icon: Users },
  { id: "trash", label: "Trash", icon: Trash2 },
];

const sectionLabels: Record<MockWorkspace["section"], string> = {
  personal: "Personal",
  "paytm-design": "Paytm Design",
  "product-team": "Product Team",
  experiments: "Experiments",
};

export function DashboardSidebar({
  active,
  onNavigate,
  workspaces,
  activeWorkspace,
  onSwitchWorkspace,
  currentUser,
  teamPreviewMembers,
  inviteEmail,
  onInviteEmailChange,
  onInviteSubmit,
  remoteAuthActions,
  teamGroups,
  orgTeamName,
  teamSwitcher,
}: {
  active: DashboardNavId;
  onNavigate: (id: DashboardNavId) => void;
  workspaces: MockWorkspace[];
  activeWorkspace: MockWorkspace;
  onSwitchWorkspace: (workspaceId: string) => void;
  currentUser: MockUser;
  teamPreviewMembers: MockTeamMember[];
  inviteEmail: string;
  onInviteEmailChange: (v: string) => void;
  onInviteSubmit: () => void;
  remoteAuthActions?: { onSignIn: () => void; onSignOut: () => void };
  teamGroups?: DashboardTeamGroup[];
  orgTeamName?: string;
  teamSwitcher?: { teams: { id: string; name: string }[]; activeTeamId: string; onSwitchTeam: (teamId: string) => void };
}) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-app-border bg-app-card">
      <div className="border-b border-app-border-subtle px-3 py-3">
        {teamSwitcher ? (
          <>
            <label className="section-heading">Team</label>
            <div className="relative mt-1.5">
              <select
                value={teamSwitcher.activeTeamId}
                onChange={(e) => teamSwitcher.onSwitchTeam(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-app-border bg-app-raised pl-3 pr-8 text-ui-sm font-medium text-app-fg outline-none ring-slate-900/10 focus:border-slate-300 focus:bg-app-card focus:ring-2"
                aria-label="Active team"
              >
                {teamSwitcher.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" strokeWidth={2} />
            </div>
          </>
        ) : null}
        <label
          className={cn(
            "section-heading",
            teamSwitcher ? "mt-3 block" : "",
          )}
        >
          Workspace
        </label>
        <div className="relative mt-1.5">
          <select
            value={activeWorkspace.id}
            onChange={(e) => onSwitchWorkspace(e.target.value)}
            className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-app-border bg-app-raised pl-3 pr-8 text-ui-sm font-medium text-app-fg outline-none ring-slate-900/10 focus:border-slate-300 focus:bg-app-card focus:ring-2"
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
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-subtle" strokeWidth={2} />
        </div>
        <p className="mt-2 text-ui leading-snug text-app-muted">
          Files and invites below are scoped to{" "}
          <span className="font-medium text-app-fg">{activeWorkspace.name}</span>
          {orgTeamName ? (
            <>
              {" "}
              in <span className="font-medium text-app-fg">{orgTeamName}</span>
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="border-b border-app-border-subtle px-3 py-2">
        <div className="section-heading">
          {teamGroups && teamGroups.length > 0 ? "Teams" : "Sections"}
        </div>
        {teamGroups && teamGroups.length > 0 ? (
          <div className="mt-1.5 space-y-2">
            {teamGroups.map((group) => (
              <div key={group.id}>
                <p className="px-2 text-ui font-semibold text-app-subtle">{group.name}</p>
                <ul className="mt-0.5 space-y-0.5">
                  {group.workspaces.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => onSwitchWorkspace(w.id)}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-ui transition-colors",
                          w.id === activeWorkspace.id ? "bg-app-fg text-app-bg" : "text-app-muted hover:bg-app-inset",
                        )}
                      >
                        <span>{w.name}</span>
                        {w.id === activeWorkspace.id ? (
                          <span className="text-ui font-medium opacity-70">Active</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <ul className="mt-1.5 space-y-0.5">
            {workspaces.map((w) => (
              <li key={w.id}>
                <button
                  type="button"
                  onClick={() => onSwitchWorkspace(w.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-ui transition-colors",
                    w.id === activeWorkspace.id ? "bg-app-fg text-app-bg" : "text-app-muted hover:bg-app-inset",
                  )}
                >
                  <span>{sectionLabels[w.section]}</span>
                  {w.id === activeWorkspace.id ? (
                    <span className="text-ui font-medium opacity-70">Active</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-ui-sm font-medium transition-colors",
              active === id
                ? "bg-app-fg text-app-bg shadow-sm"
                : "text-app-fg hover:bg-app-inset hover:text-app-fg",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-app-border-subtle p-3">
        <div className="section-heading">
          {orgTeamName ? "Org team" : "Team"}
        </div>
        {orgTeamName ? (
          <p className="mt-1 text-ui text-app-muted">
            <span className="font-medium text-app-fg">{orgTeamName}</span>
            <span className="text-app-subtle"> · workspace </span>
            <span className="font-medium text-app-fg">{activeWorkspace.name}</span>
          </p>
        ) : null}
        <div className="mt-2 flex items-center gap-1">
          {teamPreviewMembers.slice(0, 5).map((m) => (
            <span
              key={m.userId}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-app-border bg-app-inset text-ui font-bold text-app-fg"
              title={`${m.name} (${m.role})`}
            >
              {m.initials}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onNavigate("team")}
          className="mt-2 text-ui font-medium text-app-muted underline-offset-2 hover:text-app-fg hover:underline"
        >
          Manage team →
        </button>
        <div className="mt-3 flex gap-1.5">
          <input
            value={inviteEmail}
            onChange={(e) => onInviteEmailChange(e.target.value)}
            placeholder="Email"
            className="min-w-0 flex-1 rounded-md border border-app-border bg-app-card px-2 py-1.5 text-ui text-app-fg outline-none ring-slate-900/10 placeholder:text-app-subtle focus:border-slate-300 focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") onInviteSubmit();
            }}
          />
          <button
            type="button"
            onClick={onInviteSubmit}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-app-fg px-2 py-1.5 text-ui font-semibold text-app-bg hover:bg-app-muted"
            title="Invite to workspace"
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Invite
          </button>
        </div>
      </div>

      <div className="border-t border-app-border-subtle px-2 py-2">
        <Link
          href="/demo-checklist"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-ui font-medium text-app-muted transition-colors hover:bg-app-inset hover:text-app-fg"
        >
          <ListChecks className="h-4 w-4 shrink-0 text-app-subtle" strokeWidth={1.75} />
          Demo checklist
        </Link>
      </div>

      <div className="border-t border-app-border-subtle p-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-app-border-subtle bg-app-raised/80 p-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-app-border bg-app-card text-ui font-bold text-app-fg"
            style={{ boxShadow: `inset 0 0 0 2px hsl(${currentUser.avatarHue} 70% 45% / 0.25)` }}
          >
            {currentUser.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-ui font-semibold text-app-fg">{currentUser.name}</p>
            <p className="truncate text-ui text-app-muted">{currentUser.email}</p>
          </div>
        </div>
        {remoteAuthActions ? (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={remoteAuthActions.onSignIn}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-app-border bg-app-card px-2 py-1.5 text-ui font-medium text-app-fg hover:bg-app-inset"
            >
              <LogIn className="h-3.5 w-3.5" strokeWidth={2} />
              Sign in
            </button>
            <button
              type="button"
              onClick={remoteAuthActions.onSignOut}
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-md border border-app-border bg-app-card px-2 py-1.5 text-ui font-medium text-app-muted hover:bg-app-inset hover:text-app-fg"
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
