"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Paytm Craft] editor error boundary", error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-app-bg px-6 text-center text-app-fg">
      <div className="max-w-md space-y-2">
        <h1 className="text-[18px] font-semibold text-app-fg">Something went wrong in the editor.</h1>
        <p className="text-[13px] leading-relaxed text-app-muted">
          Your work may still be in browser storage. Try reloading the editor, or return to the dashboard to open the
          file again.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0b87e0]"
        >
          Reload editor
        </button>
        <Link
          href="/"
          className="rounded-lg border border-app-border bg-app-hover px-4 py-2 text-[13px] font-medium text-app-fg hover:bg-app-card/[0.1]"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
