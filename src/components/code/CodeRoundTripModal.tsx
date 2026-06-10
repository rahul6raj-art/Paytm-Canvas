"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, Copy, Download, Globe, RefreshCw, Upload, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { exportReactSource, importReactSource } from "@/lib/codeRoundTrip";
import {
  importReactFromLivePreview,
  IMPORT_WEB_STEPS,
} from "@/lib/codeRoundTrip/reactLiveImport";
import { validateReactPreviewUrl } from "@/lib/codeRoundTrip/reactPreviewUrlValidation";
import type { ImportWebStep } from "@/lib/webImport/importWebApi";
import { downloadTextFile } from "@/lib/inspectExport";
import { cn } from "@/lib/utils";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type TabId = "export" | "import";
type ImportMethod = "live" | "parse";

export function CodeRoundTripModal() {
  const router = useRouter();
  const open = useEditorStore((s) => s.codeRoundTripOpen);
  const initialTab = useEditorStore((s) => s.codeRoundTripTab);
  const closeCodeRoundTrip = useEditorStore((s) => s.closeCodeRoundTrip);
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const designTokens = useEditorStore((s) => s.designTokens);
  const assets = useEditorStore((s) => s.assets);
  const fileName = useEditorStore((s) => s.fileName);
  const codeRoundTripSourceHeader = useEditorStore((s) => s.codeRoundTripSourceHeader);
  const setCodeRoundTripSourceHeader = useEditorStore((s) => s.setCodeRoundTripSourceHeader);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);

  const [tab, setTab] = useState<TabId>("export");
  const [importMethod, setImportMethod] = useState<ImportMethod>("live");
  const [previewUrl, setPreviewUrl] = useState("http://localhost:6006");
  const [importSource, setImportSource] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [captureStep, setCaptureStep] = useState<ImportWebStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const captureStepLabel = useMemo(() => {
    if (!captureStep) return null;
    return IMPORT_WEB_STEPS.find((s) => s.id === captureStep)?.label ?? captureStep;
  }, [captureStep]);

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      setStatus(null);
      setCaptureStep(null);
    }
  }, [open, initialTab]);

  const exported = useMemo(() => {
    if (!open) return null;
    return exportReactSource({
      nodes,
      childOrder,
      selectedIds,
      designTokens,
      assets,
      fileName,
      sourceHeader: codeRoundTripSourceHeader,
    });
  }, [
    open,
    nodes,
    childOrder,
    selectedIds,
    designTokens,
    assets,
    fileName,
    codeRoundTripSourceHeader,
  ]);

  const onClose = () => closeCodeRoundTrip();

  const onCopy = useCallback(async () => {
    if (!exported) return;
    const ok = await copyText(exported.source);
    setStatus(ok ? "Copied to clipboard." : "Copy failed.");
  }, [exported]);

  const onDownload = useCallback(() => {
    if (!exported) return;
    downloadTextFile(
      `${exported.componentName}.tsx`,
      exported.source,
      "text/plain;charset=utf-8",
    );
    setStatus("Downloaded .tsx file.");
  }, [exported]);

  const onApplyParseImport = useCallback(async () => {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const result = importReactSource(importSource, { fileName: undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await applyGeneratedDesign(result.slice, importMode, {
        recordHistory: true,
        zoomToFit: true,
      });
      setCodeRoundTripSourceHeader(result.sourceHeader ?? null);
      setStatus(result.message);
      closeCodeRoundTrip();
      router.push("/editor");
    } finally {
      setBusy(false);
    }
  }, [importSource, importMode, applyGeneratedDesign, closeCodeRoundTrip, router, setCodeRoundTripSourceHeader]);

  const onApplyLiveCapture = useCallback(async () => {
    setError(null);
    setStatus(null);
    setBusy(true);
    setCaptureStep("launching");
    try {
      const validated = validateReactPreviewUrl(previewUrl);
      if (!validated.ok) {
        setError(validated.error);
        return;
      }

      const result = await importReactFromLivePreview(
        {
          previewUrl: validated.url,
          sourceCode: importSource.trim() || undefined,
          viewport: { width: 390, height: 844 },
        },
        setCaptureStep,
      );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      await applyGeneratedDesign(result.slice, importMode, {
        recordHistory: true,
        zoomToFit: true,
      });
      setCodeRoundTripSourceHeader(result.sourceHeader ?? null);
      setStatus(result.message);
      closeCodeRoundTrip();
      router.push("/editor");
    } finally {
      setBusy(false);
      setCaptureStep(null);
    }
  }, [
    previewUrl,
    importSource,
    importMode,
    applyGeneratedDesign,
    closeCodeRoundTrip,
    router,
    setCodeRoundTripSourceHeader,
  ]);

  const onFilePick = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setImportSource(text);
      setError(null);
    };
    reader.readAsText(file);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[225] flex items-center justify-center bg-black/60 px-3 py-6 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Design and code round trip"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="flex max-h-[min(92vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-app-border bg-[#1a1a1c] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-app-border px-5 py-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20 text-violet-300">
              <Code2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-[17px] font-semibold text-white">Design ↔ Code</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg p-1.5 text-app-subtle hover:bg-app-hover hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-app-border-subtle px-4 pt-2">
          {(
            [
              ["export", "Canvas → React"],
              ["import", "React → Canvas"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-t-md px-3 py-2 text-[12px] font-semibold transition-colors",
                tab === id
                  ? "bg-[#262626] text-white"
                  : "text-app-subtle hover:text-app-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "export" ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-app-subtle">
                  Exporting:{" "}
                  <span className="font-medium text-app-fg">{exported?.componentName}</span>
                  {exported?.exportRootIds.length
                    ? ` · ${exported.exportRootIds.length} root layer(s)`
                    : null}
                </span>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={onCopy}
                    className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2 py-1 text-[11px] font-medium text-app-fg hover:bg-app-hover"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={onDownload}
                    className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2 py-1 text-[11px] font-medium text-app-fg hover:bg-app-hover"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .tsx
                  </button>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-app-subtle">
                Select a frame before exporting to limit scope. Keep the{" "}
                <code className="text-app-muted">@paytm-craft-payload</code> block when editing
                externally.
              </p>
              <textarea
                readOnly
                value={exported?.source ?? ""}
                className="h-[min(52vh,480px)] w-full resize-y rounded-lg border border-app-border bg-[#0f0f10] p-3 font-mono text-[11px] leading-relaxed text-app-fg focus-visible:border-accent focus-visible:outline-none"
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setImportMethod("live")}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    importMethod === "live"
                      ? "bg-sky-600 text-white"
                      : "border border-app-border bg-app-panel text-app-muted hover:bg-app-hover",
                  )}
                >
                  <Globe className="h-3.5 w-3.5" />
                  Live preview capture
                </button>
                <button
                  type="button"
                  onClick={() => setImportMethod("parse")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors",
                    importMethod === "parse"
                      ? "bg-violet-600 text-white"
                      : "border border-app-border bg-app-panel text-app-muted hover:bg-app-hover",
                  )}
                >
                  Structure parse (.tsx)
                </button>
                <label className="ml-auto flex items-center gap-2 text-[11px] text-app-subtle">
                  Apply mode
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as "replace" | "append")}
                    className="rounded border border-app-border bg-[#262626] px-2 py-1 text-[11px] text-app-fg"
                  >
                    <option value="replace">Replace canvas</option>
                    <option value="append">Append to canvas</option>
                  </select>
                </label>
              </div>

              {importMethod === "live" ? (
                <>
                  <ol className="list-decimal space-y-1 pl-5 text-[11px] text-app-muted">
                    <li>Start dev server or Storybook (e.g. port 6006).</li>
                    <li>Open the screen URL in a browser to confirm it renders.</li>
                    <li>Paste that URL here and capture at 390×844 (mobile).</li>
                  </ol>
                  <label className="block text-[11px] font-medium text-[#b4b4b4]">
                    Preview URL
                    <input
                      type="url"
                      value={previewUrl}
                      onChange={(e) => {
                        setPreviewUrl(e.target.value);
                        setError(null);
                      }}
                      placeholder="http://localhost:6006/iframe.html?id=…"
                      className="mt-1 w-full rounded-lg border border-app-border bg-[#0f0f10] px-3 py-2 font-mono text-[11px] text-app-fg focus-visible:border-accent focus-visible:outline-none"
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2.5 py-1 text-[11px] font-medium text-app-fg hover:bg-app-hover"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Attach .tsx (optional)
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".tsx,.ts,.jsx,.js"
                      className="hidden"
                      onChange={(e) => onFilePick(e.target.files?.[0] ?? null)}
                    />
                  </div>
                  <textarea
                    value={importSource}
                    onChange={(e) => {
                      setImportSource(e.target.value);
                      setError(null);
                    }}
                    placeholder="Optional: paste PMLHomePage.tsx to preserve imports and component names on export…"
                    className="h-[min(28vh,220px)] w-full resize-y rounded-lg border border-app-border bg-[#0f0f10] p-3 font-mono text-[11px] leading-relaxed text-app-fg focus-visible:border-accent focus-visible:outline-none"
                    spellCheck={false}
                  />
                  {captureStepLabel ? (
                    <p className="text-[11px] text-sky-300">{captureStepLabel}…</p>
                  ) : null}
                  <button
                    type="button"
                    disabled={busy || !previewUrl.trim()}
                    onClick={onApplyLiveCapture}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-600 py-2.5 text-[13px] font-semibold text-white hover:bg-sky-500 disabled:opacity-45"
                  >
                    <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    Capture live preview
                  </button>
                </>
              ) : (
                <>
                  <div className="rounded-lg border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[11px] leading-relaxed text-violet-100/90">
                    <strong className="font-semibold">Structure-only import.</strong> Parses JSX without
                    running your app. Custom components become placeholder frames; CSS imports are not
                    applied. For full fidelity use Live preview capture.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2.5 py-1 text-[11px] font-medium text-app-fg hover:bg-app-hover"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload .tsx
                    </button>
                  </div>
                  <textarea
                    value={importSource}
                    onChange={(e) => {
                      setImportSource(e.target.value);
                      setError(null);
                    }}
                    placeholder="Paste or upload your React component (.tsx)…"
                    className="h-[min(44vh,380px)] w-full resize-y rounded-lg border border-app-border bg-[#0f0f10] p-3 font-mono text-[11px] leading-relaxed text-app-fg focus-visible:border-accent focus-visible:outline-none"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    disabled={busy || !importSource.trim()}
                    onClick={onApplyParseImport}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-500 disabled:opacity-45"
                  >
                    <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    Parse structure to canvas
                  </button>
                </>
              )}

              {error ? (
                <pre className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[11px] leading-relaxed text-red-200">
                  {error}
                </pre>
              ) : null}
            </div>
          )}
          {status ? <p className="text-[11px] text-emerald-400">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
