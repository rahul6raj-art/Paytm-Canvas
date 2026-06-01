"use client";

import dynamic from "next/dynamic";

/** Client-only editor shell (Zustand, canvas, localStorage). No SSR avoids hydration mismatches. */
const AppShell = dynamic(
  () => import("@/components/editor/AppShell").then((m) => m.AppShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center bg-chrome font-sans text-[13px] text-[#9a9a9a]">
        Loading editor…
      </div>
    ),
  },
);

export function EditorClient() {
  return <AppShell />;
}
