"use client";

import { useCallback, useState } from "react";
import { ArrowDownToLine, FolderInput, Link2, RefreshCw } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { useImportFromLinkedSource } from "@/components/craftBridge/CraftBridgeSourceWatcher";
import { useExportToLinkedSource } from "@/lib/craftBridge/useExportToLinkedSource";
import { bridgeFetch } from "@/lib/craftBridge/bridgeFetch";
import type { CraftBridgeConflictPolicy } from "@/lib/craftBridge/types";
import { Button } from "@/components/ui/button";
import { appFieldClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";

function formatSyncStatus(
  status: "idle" | "syncing" | "synced" | "error",
  lastSyncedAt?: string,
): string {
  if (status === "syncing") return "Syncing…";
  if (status === "error") return "Sync failed";
  if (lastSyncedAt) {
    const ago = Math.max(0, Math.round((Date.now() - Date.parse(lastSyncedAt)) / 1000));
    if (ago < 5) return "Synced just now";
    if (ago < 60) return `Synced ${ago}s ago`;
    return `Synced ${Math.round(ago / 60)}m ago`;
  }
  return status === "synced" ? "Synced" : "Not synced yet";
}

export function CodeRoundTripLinkPanel() {
  const link = useEditorStore((s) => s.codeRoundTripLink);
  const setCraftBridgeSyncStatus = useEditorStore((s) => s.setCraftBridgeSyncStatus);
  const setCodeRoundTripLink = useEditorStore((s) => s.setCodeRoundTripLink);
  const updateCodeRoundTripLink = useEditorStore((s) => s.updateCodeRoundTripLink);
  const syncStatus = useEditorStore((s) => s.craftBridgeSyncStatus);
  const syncError = useEditorStore((s) => s.craftBridgeSyncError);
  const importFromSource = useImportFromLinkedSource();
  const exportToSource = useExportToLinkedSource();
  const [pageImportPath, setPageImportPath] = useState("");
  const [pageImportBusy, setPageImportBusy] = useState(false);
  const [pageImportError, setPageImportError] = useState<string | null>(null);

  const onSyncNow = useCallback(async () => {
    await exportToSource();
  }, [exportToSource]);

  const onImportPageFolder = useCallback(async () => {
    const repoRoot = link?.repoRoot?.trim();
    const pagePath = (pageImportPath || link?.sourcePath)?.trim();
    if (!repoRoot || !pagePath) {
      setPageImportError("Set repo root and page folder path first.");
      return;
    }
    setPageImportBusy(true);
    setPageImportError(null);
    try {
      const res = await bridgeFetch("/api/craft-bridge/import-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoRoot,
          pagePath,
          previewUrl: link?.previewUrl,
        }),
      });
      const body = (await res.json()) as {
        error?: string;
        cssPaths?: string[];
        layerCount?: number;
      };
      if (!res.ok) {
        setPageImportError(body.error ?? `Import failed (${res.status})`);
        return;
      }
      setCraftBridgeSyncStatus(
        "syncing",
        "Import queued — placing screen on this canvas…",
      );
    } catch {
      setPageImportError("Could not reach Craft bridge API.");
    } finally {
      setPageImportBusy(false);
    }
  }, [
    link?.repoRoot,
    link?.sourcePath,
    link?.previewUrl,
    pageImportPath,
    setCraftBridgeSyncStatus,
  ]);

  const enabled = !!link?.repoRoot?.trim() && !!link?.sourcePath?.trim();

  return (
    <div className="space-y-3 rounded-xl border border-app-border bg-app-inset p-3">
      <div className="flex items-center gap-2 text-ui font-semibold text-app-fg">
        <Link2 className="h-4 w-4 text-app-subtle" />
        Source file bridge
      </div>
      <p className="text-ui text-app-subtle">
        Link a page folder (<code className="text-ui">.tsx</code> /{" "}
        <code className="text-ui">.html</code> + <code className="text-ui">.css</code>). With a preview
        URL, <strong className="font-medium text-app-fg">Send to code</strong> updates text in your
        React file only — it does not rewrite layout CSS or replace the screen with Craft export output.
      </p>

      <label className="block space-y-1">
        <span className="text-ui text-app-subtle">Repo root (absolute path)</span>
        <input
          type="text"
          value={link?.repoRoot ?? ""}
          onChange={(e) => {
            const repoRoot = e.target.value;
            if (!link) {
              setCodeRoundTripLink({
                repoRoot,
                sourcePath: "",
                syncMode: "manual",
                watchSource: false,
              });
              return;
            }
            updateCodeRoundTripLink({ repoRoot });
          }}
          placeholder="/Users/you/projects/my-app"
          className={appFieldClass}
        />
      </label>

      <label className="block space-y-1">
        <span className="text-ui text-app-subtle">Source path (relative)</span>
        <input
          type="text"
          value={link?.sourcePath ?? ""}
          onChange={(e) => {
            const sourcePath = e.target.value;
            if (!link) {
              setCodeRoundTripLink({
                repoRoot: "",
                sourcePath,
                syncMode: "manual",
                watchSource: false,
              });
              return;
            }
            updateCodeRoundTripLink({ sourcePath });
          }}
          placeholder="src/screens/PMLSignupPage"
          className={appFieldClass}
        />
      </label>

      {link?.cssPaths && link.cssPaths.length > 0 ? (
        <p className="text-ui text-app-subtle">
          Linked CSS:{" "}
          <span className="font-medium text-app-fg">
            {link.cssPaths.map((p) => p.split("/").pop()).join(", ")}
          </span>
        </p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-ui text-app-subtle">Page folder to import (relative)</span>
        <input
          type="text"
          value={pageImportPath}
          onChange={(e) => setPageImportPath(e.target.value)}
          placeholder={link?.sourcePath?.replace(/\/[^/]+\.tsx$/, "") ?? "src/screens/PMLSignupPage"}
          className={appFieldClass}
          disabled={!link?.repoRoot?.trim()}
        />
      </label>

      <Button
        variant="primary"
        type="button"
        disabled={!link?.repoRoot?.trim() || pageImportBusy}
        onClick={() => void onImportPageFolder()}
        className="h-9 w-full gap-1.5 text-ui font-semibold"
      >
        <FolderInput className={cn("h-4 w-4", pageImportBusy && "animate-pulse")} />
        Import page folder from repo (.tsx/.html + .css)
      </Button>
      {pageImportError ? (
        <p className="text-ui text-red-300">{pageImportError}</p>
      ) : null}

      <label className="block space-y-1">
        <span className="text-ui text-app-subtle">Preview URL (optional, for live capture)</span>
        <input
          type="text"
          value={link?.previewUrl ?? ""}
          onChange={(e) => {
            if (!link) return;
            updateCodeRoundTripLink({ previewUrl: e.target.value || undefined });
          }}
          placeholder="http://localhost:5173"
          className={appFieldClass}
          disabled={!link}
        />
      </label>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui text-app-subtle">Canvas → source</span>
          <span className="rounded-md border border-app-border bg-app-panel px-2 py-1 text-ui font-medium text-app-muted">
            manual only
          </span>
          <span className="text-ui text-app-subtle">
            Right-click layer → Update source code
          </span>
        </div>
        {link?.previewUrl ? (
          <p className="text-ui text-app-subtle">
            Live-linked pages export text edits into your real React file. Import from source re-captures the preview — it does not parse JSX into grey blocks.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui text-app-subtle">Source → canvas</span>
          <button
            type="button"
            disabled={!link}
            onClick={() => link && updateCodeRoundTripLink({ watchSource: !link.watchSource })}
            className={cn(
              "rounded-md border px-2 py-1 text-ui font-medium",
              link?.watchSource
                ? "border-accent/40 bg-accent/15 text-app-fg"
                : "border-app-border text-app-subtle hover:text-app-fg",
              !link && "opacity-40",
            )}
          >
            {link?.watchSource ? "Watch on" : "Watch off"}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ui text-app-subtle">On conflict</span>
          {(["ask", "source-wins", "canvas-wins"] as CraftBridgeConflictPolicy[]).map((policy) => (
            <button
              key={policy}
              type="button"
              disabled={!link}
              onClick={() => link && updateCodeRoundTripLink({ conflictPolicy: policy })}
              className={cn(
                "rounded-md border px-2 py-1 text-ui font-medium",
                (link?.conflictPolicy ?? "ask") === policy
                  ? "border-accent/40 bg-accent/15 text-app-fg"
                  : "border-app-border text-app-subtle hover:text-app-fg",
                !link && "opacity-40",
              )}
            >
              {policy}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={!enabled || syncStatus === "syncing"}
          onClick={() => void onSyncNow()}
          className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2 py-1 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncStatus === "syncing" && "animate-spin")} />
          Export to source
        </button>
        <button
          type="button"
          disabled={!enabled || syncStatus === "syncing"}
          onClick={() => void importFromSource()}
          className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2 py-1 text-ui font-medium text-app-fg hover:bg-app-hover disabled:opacity-40"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
          Import from source
        </button>
      </div>

      <p
        className={cn(
          "text-ui",
          syncStatus === "error" ? "text-red-300" : "text-app-subtle",
        )}
      >
        {syncStatus === "error" && syncError
          ? syncError
          : formatSyncStatus(syncStatus, link?.lastSyncedAt)}
        {enabled ? ` → ${link!.sourcePath}` : null}
        {link?.watchSource ? " · watching source" : null}
      </p>

    </div>
  );
}
