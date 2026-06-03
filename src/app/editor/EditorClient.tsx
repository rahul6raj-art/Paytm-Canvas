"use client";

import dynamic from "next/dynamic";

function EditorLoadError({ message }: { message: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-app-bg px-6 text-center text-app-fg">
      <h1 className="text-[16px] font-semibold">Editor failed to load</h1>
      <p className="max-w-md text-[13px] leading-relaxed text-app-muted">
        The editor bundle could not be loaded. This is usually fixed by clearing the Next.js cache and
        restarting the dev server.
      </p>
      <pre className="max-w-lg overflow-x-auto rounded-lg border border-app-border bg-app-inset px-3 py-2 text-left text-[11px] text-app-subtle">
        rm -rf .next && npm run dev
      </pre>
      <p className="max-w-md text-[11px] text-app-subtle">{message}</p>
    </div>
  );
}

/** Client-only editor shell (Zustand, canvas, localStorage). No SSR avoids hydration mismatches. */
const AppShell = dynamic(
  () =>
    import("@/components/editor/AppShell")
      .then((m) => m.AppShell)
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error("[Paytm Craft] Failed to load AppShell", err);
        return function FailedAppShell() {
          return <EditorLoadError message={message} />;
        };
      }),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center bg-chrome font-sans text-[13px] text-app-muted">
        Loading editor…
      </div>
    ),
  },
);

export function EditorClient() {
  return <AppShell />;
}
