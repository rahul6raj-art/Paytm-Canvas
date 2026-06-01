import Link from "next/link";
import { isPaytmCraftApiMode } from "@/lib/env";
import { cn } from "@/lib/utils";

type Status = "ready" | "beta" | "mock";

type ChecklistItem = {
  id: string;
  title: string;
  description: string;
  status: Status;
  href?: string;
  hrefLabel?: string;
  note?: string;
};

const STATUS_STYLES: Record<Status, string> = {
  ready: "border-emerald-500/35 bg-emerald-500/10 text-emerald-200",
  beta: "border-sky-500/35 bg-sky-500/10 text-sky-200",
  mock: "border-amber-500/35 bg-amber-500/10 text-amber-200",
};

const STATUS_LABEL: Record<Status, string> = {
  ready: "Ready",
  beta: "Beta",
  mock: "Mock",
};

function buildItems(apiMode: boolean): ChecklistItem[] {
  return [
    {
      id: "dashboard",
      title: "Dashboard",
      description: "Workspaces, file grid, search, and quick actions to start designing.",
      status: "ready",
      href: "/",
      hrefLabel: "Open dashboard",
    },
    {
      id: "templates",
      title: "Templates",
      description: "Starter layouts for mobile, checkout, landing, and product exploration.",
      status: "ready",
      href: "/",
      hrefLabel: "Dashboard → Templates",
      note: "Use the Templates section in the sidebar.",
    },
    {
      id: "ai",
      title: "AI generation",
      description: "Mock prompt-to-layout flow with presets and style variants (no external API).",
      status: "mock",
      href: "/",
      hrefLabel: "Generate from dashboard",
    },
    {
      id: "editor",
      title: "Editor canvas",
      description: "Pan, zoom, marquee selection, shapes, text, pen paths, and transforms.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Open editor",
    },
    {
      id: "layers",
      title: "Layers",
      description: "Tree view with visibility, lock, drag reorder, and rename.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Layers panel",
    },
    {
      id: "inspector",
      title: "Inspector",
      description: "Design properties, layout, constraints, effects, and component controls.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Right panel",
    },
    {
      id: "autolayout",
      title: "Auto layout",
      description: "Frame auto-layout with padding, gap, and alignment on containers.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Select a frame",
    },
    {
      id: "responsive",
      title: "Responsive preview",
      description: "Draft frame sizes in the inspector before applying with undo support.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Responsive preview",
    },
    {
      id: "components",
      title: "Components",
      description: "Create masters from frames, place instances, and detach when needed.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Design inspector",
    },
    {
      id: "prototype",
      title: "Prototype",
      description: "Hotspots, wires between frames, and present mode preview.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Prototype mode",
    },
    {
      id: "comments",
      title: "Comments",
      description: "Pin comments on canvas, panel list, and resolved threads.",
      status: apiMode ? "beta" : "ready",
      href: "/editor",
      hrefLabel: "Comment tool",
      note: apiMode ? "API-backed files sync comments to the mock API." : undefined,
    },
    {
      id: "assets",
      title: "Assets / images",
      description: "Import images, drag from Assets panel, and embed in the document.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Assets tab",
    },
    {
      id: "styles",
      title: "Styles / tokens",
      description: "Color, typography, spacing, and effect styles shared across the file.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Styles tab",
    },
    {
      id: "plugins",
      title: "Plugins",
      description: "Mock marketplace with installable runners (contrast, lorem, tokens).",
      status: "mock",
      href: "/editor",
      hrefLabel: "Plugins",
    },
    {
      id: "inspect",
      title: "Inspect / export",
      description: "Measure distances, copy CSS, and export selection as PNG or SVG.",
      status: "ready",
      href: "/editor",
      hrefLabel: "Inspect mode",
    },
    {
      id: "versions",
      title: "Version history",
      description: "Named snapshots and restore for API-backed files.",
      status: apiMode ? "beta" : "mock",
      href: "/editor",
      hrefLabel: "File → Version history",
      note: apiMode ? "Requires an API-backed file (NEXT_PUBLIC_PAYTM_CRAFT_MODE=api)." : "Enable API mode for snapshots.",
    },
    {
      id: "api",
      title: "API mode",
      description: "Next.js mock API for workspaces, files, comments, and versions.",
      status: apiMode ? "beta" : "mock",
      href: "/",
      hrefLabel: "API dashboard",
      note: apiMode
        ? "Running with mock /api/v1 routes in this deployment."
        : "Set NEXT_PUBLIC_PAYTM_CRAFT_MODE=api to try the API-backed flow.",
    },
  ];
}

export default function DemoChecklistPage() {
  const apiMode = isPaytmCraftApiMode();
  const items = buildItems(apiMode);
  const readyCount = items.filter((i) => i.status === "ready").length;

  return (
    <div className="min-h-dvh bg-[#0f0f10] text-[#e6e6e6] antialiased">
      <header className="border-b border-white/[0.08] bg-[#1a1a1a]">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6b6b6b]">Paytm Craft</p>
            <h1 className="text-[22px] font-semibold tracking-tight text-white">Demo checklist</h1>
            <p className="mt-1 text-[13px] text-[#9a9a9a]">
              {readyCount} of {items.length} areas demo-ready · use this page to walk through the product end-to-end.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-[12px] font-medium hover:bg-white/[0.1]"
            >
              Dashboard
            </Link>
            <Link
              href="/editor"
              className="rounded-lg bg-[#0d99ff] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0b87e0]"
            >
              Open editor
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-white/[0.08] bg-[#1e1e1e] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="text-[14px] font-semibold text-white">{item.title}</h2>
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    STATUS_STYLES[item.status],
                  )}
                >
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#a3a3a3]">{item.description}</p>
              {item.note ? <p className="mt-1 text-[11px] text-[#6b6b6b]">{item.note}</p> : null}
              {item.href && item.hrefLabel ? (
                <Link
                  href={item.href}
                  className="mt-2 inline-block text-[12px] font-medium text-[#0d99ff] hover:underline"
                >
                  {item.hrefLabel} →
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-center text-[11px] text-[#5c5c5c]">
          Tip: press <span className="font-mono text-[#8c8c8c]">⌘K</span> in the editor for commands, or{" "}
          <span className="font-mono text-[#8c8c8c]">⌘/</span> for shortcuts.
        </p>
      </main>
    </div>
  );
}
