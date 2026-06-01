"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { Home, Clock, FileEdit, LayoutGrid, Users, Trash2, ChevronDown, UserPlus, ListChecks } from "lucide-react";
import type { MockTeamMember, MockUser, MockWorkspace } from "@/lib/mockAuth";

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
}) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-3">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Workspace</label>
        <div className="relative mt-1.5">
          <select
            value={activeWorkspace.id}
            onChange={(e) => onSwitchWorkspace(e.target.value)}
            className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-8 text-[13px] font-medium text-slate-900 outline-none ring-slate-900/10 focus:border-slate-300 focus:bg-white focus:ring-2"
            aria-label="Active workspace"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" strokeWidth={2} />
        </div>
        <p className="mt-2 text-[11px] leading-snug text-slate-500">
          Files and invites below are scoped to{" "}
          <span className="font-medium text-slate-700">{activeWorkspace.name}</span>.
        </p>
      </div>

      <div className="border-b border-slate-100 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sections</div>
        <ul className="mt-1.5 space-y-0.5">
          {workspaces.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => onSwitchWorkspace(w.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                  w.id === activeWorkspace.id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                <span>{sectionLabels[w.section]}</span>
                {w.id === activeWorkspace.id ? (
                  <span className="text-[10px] font-medium text-slate-300">Active</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
              active === id
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} />
            {label}
          </button>
        ))}
      </nav>

      <div className="border-t border-slate-100 p-3">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Team</div>
        <div className="mt-2 flex items-center gap-1">
          {teamPreviewMembers.slice(0, 5).map((m) => (
            <span
              key={m.userId}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-[10px] font-bold text-slate-700"
              title={`${m.name} (${m.role})`}
            >
              {m.initials}
            </span>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onNavigate("team")}
          className="mt-2 text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          Manage team →
        </button>
        <div className="mt-3 flex gap-1.5">
          <input
            value={inviteEmail}
            onChange={(e) => onInviteEmailChange(e.target.value)}
            placeholder="Email"
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[12px] text-slate-900 outline-none ring-slate-900/10 placeholder:text-slate-400 focus:border-slate-300 focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === "Enter") onInviteSubmit();
            }}
          />
          <button
            type="button"
            onClick={onInviteSubmit}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
            title="Invite to workspace"
          >
            <UserPlus className="h-3.5 w-3.5" strokeWidth={2} />
            Invite
          </button>
        </div>
      </div>

      <div className="border-t border-slate-100 px-2 py-2">
        <Link
          href="/demo-checklist"
          target="_blank"
          rel="noopener noreferrer"
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <ListChecks className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.75} />
          Demo checklist
        </Link>
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2.5">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[11px] font-bold text-slate-800"
            style={{ boxShadow: `inset 0 0 0 2px hsl(${currentUser.avatarHue} 70% 45% / 0.25)` }}
          >
            {currentUser.initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-slate-900">{currentUser.name}</p>
            <p className="truncate text-[11px] text-slate-500">{currentUser.email}</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
