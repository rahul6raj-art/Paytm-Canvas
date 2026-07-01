"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Code2, Copy, Download, Globe, RefreshCw, Upload, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { exportReactSource } from "@/lib/codeRoundTrip";
import { looksLikeReactSource } from "@/lib/codeRoundTrip/reactImport";
import { parseCodeToCanvasSlice } from "@/lib/codeImport/importCodeToCanvas";
import {
  importReactFromLivePreview,
  IMPORT_WEB_STEPS,
} from "@/lib/codeRoundTrip/reactLiveImport";
import { validateReactPreviewUrl } from "@/lib/codeRoundTrip/reactPreviewUrlValidation";
import type { ImportWebStep } from "@/lib/webImport/importWebApi";
import { downloadTextFile } from "@/lib/inspectExport";
import { CodeRoundTripLinkPanel } from "@/components/craftBridge/CodeRoundTripLinkPanel";
import {
  useCanExportToLinkedSource,
  useExportToLinkedSource,
} from "@/lib/craftBridge/useExportToLinkedSource";
import { pickCodeExportRootIds } from "@/lib/codeExport/frameRelativeExport";
import { Button } from "@/components/ui/button";
import { appFieldClass } from "@/lib/appFieldStyles";
import { cn } from "@/lib/utils";

const codeFieldClass = cn(
  appFieldClass,
  "h-auto min-h-[var(--inspector-control-height)] resize-y py-2 font-mono leading-relaxed",
);

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
  const codeRoundTripLink = useEditorStore((s) => s.codeRoundTripLink);
  const setCodeRoundTripSourceHeader = useEditorStore((s) => s.setCodeRoundTripSourceHeader);
  const setCodeRoundTripLink = useEditorStore((s) => s.setCodeRoundTripLink);
  const updateCodeRoundTripLink = useEditorStore((s) => s.updateCodeRoundTripLink);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);
  const craftBridgeSyncStatus = useEditorStore((s) => s.craftBridgeSyncStatus);
  const craftBridgeSyncError = useEditorStore((s) => s.craftBridgeSyncError);
  const exportToLinkedSource = useExportToLinkedSource();
  const canSendToCode = useCanExportToLinkedSource();

  const [tab, setTab] = useState<TabId>("export");
  const [importMethod, setImportMethod] = useState<ImportMethod>("live");
  const [previewUrl, setPreviewUrl] = useState("http://localhost:5173/?screen=signup");
  const [importSource, setImportSource] = useState("");
  const [companionCss, setCompanionCss] = useState<string[]>([]);
  const [pageCssPaths, setPageCssPaths] = useState<string[]>([]);
  const [pageCssLabel, setPageCssLabel] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [captureStep, setCaptureStep] = useState<ImportWebStep | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pageFolderRef = useRef<HTMLInputElement>(null);

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
      codeRoundTripLink,
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
    codeRoundTripLink,
  ]);

  const exportRootId = useMemo(
    () => pickCodeExportRootIds(selectedIds, nodes, childOrder)[0] ?? null,
    [selectedIds, nodes, childOrder],
  );
  const exportRoot = exportRootId ? nodes[exportRootId] : null;

  const onSendToCode = useCallback(async () => {
    setError(null);
    setStatus(null);
    if (!canSendToCode) {
      setError("Link your repo file first — set repo root and source path below.");
      return;
    }
    setBusy(true);
    try {
      const result = await exportToLinkedSource();
      if (!result.ok) {
        setError(result.error ?? "Send to code failed.");
        return;
      }
      if (result.skipped) {
        setStatus("Source already up to date — no file changes written.");
        return;
      }
      setStatus(
        result.absolutePath
          ? `Sent to code → ${result.absolutePath}`
          : "Sent to code successfully.",
      );
    } finally {
      setBusy(false);
    }
  }, [canSendToCode, exportToLinkedSource]);

  const onClose = () => closeCodeRoundTrip();

  const onCopy = useCallback(async () => {
    if (!exported) return;
    const ok = await copyText(exported.source);
    setStatus(ok ? "Copied to clipboard." : "Copy failed.");
  }, [exported]);

  const onDownload = useCallback(async () => {
    if (!exported) return;
    const saved = await downloadTextFile(
      `${exported.componentName}.tsx`,
      exported.source,
      "text/plain;charset=utf-8",
    );
    if (saved) setStatus("Downloaded .tsx file.");
  }, [exported]);

  const onApplyParseImport = useCallback(async () => {
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const result = await parseCodeToCanvasSlice(importSource, "react", {
        fileName: undefined,
        companionCss,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await applyGeneratedDesign(result.slice, importMode, {
        recordHistory: true,
        zoomToFit: true,
      });
      setCodeRoundTripSourceHeader(result.sourceHeader ?? null);
      if (pageCssPaths.length > 0) {
        if (codeRoundTripLink) {
          updateCodeRoundTripLink({ cssPaths: pageCssPaths });
        } else {
          setCodeRoundTripLink({
            repoRoot: "",
            sourcePath: pageCssPaths[0]?.replace(/\/[^/]+\.css$/, ".tsx") ?? "",
            cssPaths: pageCssPaths,
            syncMode: "manual",
            watchSource: false,
          });
        }
      } else if (result.codeRoundTripLink) {
        setCodeRoundTripLink(result.codeRoundTripLink);
      }
      setStatus(
        `${result.message} (${result.layerCount} layers on canvas — zoom with View → Zoom to fit if needed.)`,
      );
      closeCodeRoundTrip();
      router.push("/editor");
    } finally {
      setBusy(false);
    }
  }, [importSource, companionCss, pageCssPaths, codeRoundTripLink, importMode, applyGeneratedDesign, closeCodeRoundTrip, router, setCodeRoundTripSourceHeader, setCodeRoundTripLink, updateCodeRoundTripLink]);

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
      setCompanionCss([]);
      setPageCssPaths([]);
      setPageCssLabel(null);
      setError(null);
    };
    reader.readAsText(file);
  }, []);

  const onPageFilesPick = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const tsxFiles = list.filter((f) => f.name.endsWith(".tsx") && !f.name.includes(".stories."));
    const htmlFiles = list.filter((f) => f.name.endsWith(".html") || f.name.endsWith(".htm"));
    const cssFiles = list.filter((f) => f.name.endsWith(".css"));
    if (tsxFiles.length === 0 && htmlFiles.length === 0) {
      setError("Select a page folder with a .tsx or .html file and optional .css files.");
      return;
    }
    const mainTsx =
      tsxFiles.find((f) => /Page\.tsx$/i.test(f.name)) ??
      tsxFiles.find((f) => !f.name.startsWith("index.")) ??
      tsxFiles[0];
    const mainHtml =
      htmlFiles.find((f) => /Page\.html$/i.test(f.name)) ??
      htmlFiles.find((f) => f.name === "index.html") ??
      htmlFiles[0];
    const mainFile = mainTsx ?? mainHtml;
    if (!mainFile) {
      setError("Select a page folder with at least one .tsx or .html file.");
      return;
    }

    const readAll = async () => {
      const readText = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () =>
            resolve(typeof reader.result === "string" ? reader.result : "");
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        });

      const tsxText = await readText(mainFile);
      const cssTexts = await Promise.all(cssFiles.map((f) => readText(f)));
      const cssRelPaths = cssFiles.map((f) => {
        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
        return rel?.trim() || f.name;
      });
      setImportSource(tsxText);
      setCompanionCss(cssTexts.filter(Boolean));
      setPageCssPaths(cssRelPaths);
      setPageCssLabel(
        cssFiles.length > 0
          ? `${mainFile.name} + ${cssFiles.map((f) => f.name).join(", ")}`
          : mainFile.name,
      );
      setError(null);
      setImportMethod("parse");
    };

    void readAll().catch(() => setError("Could not read page files."));
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[225] flex items-center justify-center bg-black/55 px-4 py-4 backdrop-blur-[2px] sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-label="Design and code round trip"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="relative flex max-h-[min(92vh,880px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={1.75} />
        </button>

        <header className="shrink-0 border-b border-app-border-subtle px-5 pb-4 pt-5">
          <div className="flex items-start gap-3 pr-8">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-app-border-subtle bg-app-inset text-app-muted">
              <Code2 className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold tracking-tight text-app-fg">
                Design ↔ Code
              </h2>
              <p className="mt-0.5 text-ui leading-snug text-app-muted">
                Export canvas to React or import code back onto the canvas.
              </p>
            </div>
          </div>
        </header>

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
                "rounded-t-lg px-3 py-2 text-ui font-semibold transition-colors",
                tab === id
                  ? "border border-b-transparent border-app-border bg-app-panel text-app-fg"
                  : "text-app-muted hover:text-app-fg",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-4">
          {tab === "export" ? (
            <div className="space-y-3">
              <CodeRoundTripLinkPanel />
              <div className="rounded-xl border border-app-border bg-app-inset p-3">
                <p className="text-ui leading-relaxed text-app-subtle">
                  {exportRoot ? (
                    <>
                      Selected screen:{" "}
                      <span className="font-medium text-app-fg">{exportRoot.name}</span>
                      {codeRoundTripLink?.sourcePath ? (
                        <>
                          {" "}
                          →{" "}
                          <span className="font-medium text-app-fg">
                            {codeRoundTripLink.sourcePath}
                          </span>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>Select a screen frame on the canvas before sending to code.</>
                  )}
                </p>
                <Button
                  variant="primary"
                  type="button"
                  disabled={busy || !exportRoot || craftBridgeSyncStatus === "syncing"}
                  onClick={() => void onSendToCode()}
                  className="mt-3 h-10 w-full gap-2 text-ui-sm font-semibold"
                >
                  <RefreshCw
                    className={cn(
                      "h-4 w-4",
                      (busy || craftBridgeSyncStatus === "syncing") && "animate-spin",
                    )}
                  />
                  Send to code
                </Button>
                {craftBridgeSyncStatus === "error" && craftBridgeSyncError ? (
                  <p className="mt-2 text-ui text-red-300">{craftBridgeSyncError}</p>
                ) : null}
                {error ? (
                  <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-ui leading-relaxed text-red-200">
                    {error}
                  </pre>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-ui text-app-subtle">
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
                    className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2 py-1 text-ui font-medium text-app-fg hover:bg-app-hover"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={onDownload}
                    className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2 py-1 text-ui font-medium text-app-fg hover:bg-app-hover"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .tsx
                  </button>
                </div>
              </div>
              <p className="text-ui leading-relaxed text-app-subtle">
                Select a frame before exporting to limit scope. Keep the{" "}
                <code className="text-app-muted">@paytm-craft-payload</code> block when editing
                externally.
              </p>
              <textarea
                readOnly
                value={exported?.source ?? ""}
                className={cn(codeFieldClass, "h-[min(52vh,480px)]")}
                spellCheck={false}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex flex-wrap gap-1 rounded-xl border border-app-border bg-app-inset p-1">
                  <button
                    type="button"
                    onClick={() => setImportMethod("live")}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-ui font-semibold transition-colors",
                      importMethod === "live"
                        ? "border border-app-border bg-app-panel text-app-fg shadow-sm"
                        : "text-app-muted hover:text-app-fg",
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Live screen capture
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMethod("parse")}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-ui font-semibold transition-colors",
                      importMethod === "parse"
                        ? "border border-app-border bg-app-panel text-app-fg shadow-sm"
                        : "text-app-muted hover:text-app-fg",
                    )}
                  >
                    Structure only (.tsx)
                  </button>
                </div>
                <label className="ml-auto flex items-center gap-2 text-ui text-app-subtle">
                  Apply mode
                  <select
                    value={importMode}
                    onChange={(e) => setImportMode(e.target.value as "replace" | "append")}
                    className={cn(appFieldClass, "h-9 w-auto shrink-0")}
                  >
                    <option value="replace">Replace canvas</option>
                    <option value="append">Append to canvas</option>
                  </select>
                </label>
              </div>

              {importMethod === "live" ? (
                <>
                  <div className="rounded-xl border border-app-border bg-app-inset px-3 py-2 text-ui leading-relaxed text-app-subtle">
                    <strong className="font-semibold text-app-fg">Editable layers only.</strong> Craft reads
                    computed CSS from your running app and builds frames, text, and controls you can select and
                    edit. It does not place a flat screenshot on the canvas.
                  </div>
                  <ol className="list-decimal space-y-1 pl-5 text-ui text-app-muted">
                    <li>
                      In your app repo: <code className="text-app-fg">npm run dev</code> (Vite) or{" "}
                      <code className="text-app-fg">npm run storybook</code>
                    </li>
                    <li>
                      Open the screen in a browser (e.g.{" "}
                      <code className="text-app-fg">http://localhost:5173/?screen=signup</code>)
                    </li>
                    <li>Paste that URL below → Capture at 390×844</li>
                    <li>
                      Optional: attach <code className="text-app-fg">PMLSignupPage.tsx</code> so layer names
                      match your source on export
                    </li>
                  </ol>
                  <p className="text-ui text-app-subtle">
                    First time? In Craft repo run: <code className="text-app-fg">npm run setup:browsers</code>
                  </p>
                  <label className="block space-y-1">
                    <span className="section-heading">Preview URL</span>
                    <input
                      type="url"
                      value={previewUrl}
                      onChange={(e) => {
                        setPreviewUrl(e.target.value);
                        setError(null);
                      }}
                      placeholder="http://localhost:5173/?screen=signup"
                      className={cn(appFieldClass, "font-mono")}
                    />
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2.5 py-1 text-ui font-medium text-app-fg hover:bg-app-hover"
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
                      const next = e.target.value;
                      setImportSource(next);
                      setError(null);
                    }}
                    placeholder="Optional: paste PMLSignupPage.tsx to preserve component names on export…"
                    className={cn(codeFieldClass, "h-[min(28vh,220px)]")}
                    spellCheck={false}
                  />
                  {captureStepLabel ? (
                    <p className="text-ui text-app-muted">{captureStepLabel}…</p>
                  ) : null}
                  <Button
                    variant="primary"
                    type="button"
                    disabled={busy || !previewUrl.trim()}
                    onClick={onApplyLiveCapture}
                    className="h-10 w-full gap-2 text-ui-sm font-semibold"
                  >
                    <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    Capture live preview
                  </Button>
                </>
              ) : (
                <>
                  <div className="rounded-xl border border-app-border bg-app-inset px-3 py-2 text-ui leading-relaxed text-app-subtle">
                    <strong className="font-semibold text-app-fg">Structure + page CSS.</strong> Upload the
                    whole page folder (e.g. <code className="text-app-fg">PMLSignupPage.tsx</code> +{" "}
                    <code className="text-app-fg">PMLSignupPage.css</code>) for layout and colors from your
                    stylesheet. Custom components still become placeholders — use Live capture for pixel
                    fidelity.
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="toolbar"
                      type="button"
                      onClick={() => pageFolderRef.current?.click()}
                      className="gap-1 border border-app-border bg-app-panel text-app-fg hover:bg-app-hover"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload page folder
                    </Button>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2.5 py-1 text-ui font-medium text-app-fg hover:bg-app-hover"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload .tsx only
                    </button>
                    {pageCssLabel ? (
                      <span className="text-ui text-app-muted">Loaded: {pageCssLabel}</span>
                    ) : null}
                  </div>
                  <input
                    ref={pageFolderRef}
                    type="file"
                    multiple
                    accept=".tsx,.ts,.css"
                    className="hidden"
                    onChange={(e) => {
                      onPageFilesPick(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <textarea
                    value={importSource}
                    onChange={(e) => {
                      const next = e.target.value;
                      setImportSource(next);
                      setError(null);
                      if (looksLikeReactSource(next)) setImportMethod("parse");
                    }}
                    placeholder="Paste or upload your React component (.tsx)…"
                    className={cn(codeFieldClass, "h-[min(44vh,380px)]")}
                    spellCheck={false}
                  />
                  <Button
                    variant="primary"
                    type="button"
                    disabled={busy || !importSource.trim()}
                    onClick={onApplyParseImport}
                    className="h-10 w-full gap-2 text-ui-sm font-semibold"
                  >
                    <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
                    Parse structure to canvas
                  </Button>
                </>
              )}

              {error ? (
                <pre className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-ui leading-relaxed text-red-200">
                  {error}
                </pre>
              ) : null}
            </div>
          )}
          {status ? <p className="text-ui text-emerald-500">{status}</p> : null}
        </div>
      </div>
    </div>
  );
}
