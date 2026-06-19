"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Copy, Check, Upload, RefreshCw, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import { exportSelectionCode } from "@/lib/codeExport";
import { parseCodeToCanvasSlice } from "@/lib/codeImport/importCodeToCanvas";
import { handlePanelFieldKeyDown } from "@/lib/panelFieldKeyboard";
import { cn } from "@/lib/utils";

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type PanelSection = "export" | "import";

export function CodePanel() {
  const nodes = useEditorStore((s) => s.nodes);
  const childOrder = useEditorStore((s) => s.childOrder);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const designTokens = useEditorStore((s) => s.designTokens);
  const assets = useEditorStore((s) => s.assets);
  const codePanelFormat = useEditorStore((s) => s.codePanelFormat);
  const setCodePanelFormat = useEditorStore((s) => s.setCodePanelFormat);
  const setCodeRoundTripSourceHeader = useEditorStore((s) => s.setCodeRoundTripSourceHeader);
  const setCodeRoundTripLink = useEditorStore((s) => s.setCodeRoundTripLink);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);

  const [section, setSection] = useState<PanelSection>("export");
  const [importSource, setImportSource] = useState("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importError, setImportError] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exported = useMemo(
    () =>
      exportSelectionCode({
        nodes,
        childOrder,
        selectedIds,
        designTokens,
        assets,
        format: codePanelFormat,
      }),
    [nodes, childOrder, selectedIds, designTokens, assets, codePanelFormat],
  );

  const onCopy = useCallback(async () => {
    if (!exported.code) return;
    const ok = await copyToClipboard(exported.code);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [exported.code]);

  const setRightPanelTab = useEditorStore((s) => s.setRightPanelTab);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);

  const onApplyImport = useCallback(async () => {
    setImportError(null);
    setImportStatus(null);
    setImportBusy(true);
    try {
      let result;
      try {
        result = await parseCodeToCanvasSlice(importSource, codePanelFormat);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setImportError(`Import failed: ${msg}`);
        return;
      }
      if (!result.ok) {
        setImportError(result.error);
        return;
      }
      await applyGeneratedDesign(result.slice, importMode, {
        recordHistory: true,
        zoomToFit: true,
      });
      setCodeRoundTripSourceHeader(result.sourceHeader ?? null);
      if (result.codeRoundTripLink) {
        setCodeRoundTripLink(result.codeRoundTripLink);
      }
      setImportStatus(
        `${result.message} (${result.layerCount} layers — use View → Zoom to fit if the frame is off-screen.)`,
      );
      setRightPanelTab("design");
      setSection("export");
    } finally {
      setImportBusy(false);
    }
  }, [
    importSource,
    codePanelFormat,
    importMode,
    applyGeneratedDesign,
    setCodeRoundTripSourceHeader,
    setCodeRoundTripLink,
    setRightPanelTab,
  ]);

  const onFilePick = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setImportSource(text);
      setImportError(null);
    };
    reader.readAsText(file);
  }, []);

  const accept =
    codePanelFormat === "html" ? ".html,.htm,.txt" : ".tsx,.ts,.jsx,.js,.txt";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-app-panel-edge px-3 py-2">
        <div className="flex rounded-lg border border-app-border bg-app-panel p-0.5">
          {(
            [
              ["export", "From canvas", ArrowDownToLine],
              ["import", "To canvas", ArrowUpFromLine],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setSection(id);
                setImportError(null);
                setImportStatus(null);
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-ui font-semibold transition-colors",
                section === id ? "bg-[#404040] text-white" : "text-app-subtle hover:text-app-fg",
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex rounded-lg border border-app-border bg-app-panel p-0.5">
          {(["html", "react"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              onClick={() => setCodePanelFormat(fmt)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-ui font-medium transition-colors",
                codePanelFormat === fmt
                  ? fmt === "html"
                    ? "bg-amber-600/90 text-white"
                    : "bg-sky-600/90 text-white"
                  : "text-app-subtle hover:text-app-fg",
              )}
            >
              {fmt === "html" ? "HTML" : "React"}
            </button>
          ))}
        </div>
      </div>

      {section === "export" ? (
        <>
          <div className="shrink-0 border-b border-app-panel-edge px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-ui font-semibold text-white">{exported.rootLabel}</p>
                <p className="text-ui text-app-subtle">
                  {exported.empty
                    ? "Select a layer on the canvas"
                    : `${exported.layerCount} layer(s) · ${exported.wrapperWidth}×${exported.wrapperHeight}`}
                </p>
              </div>
              <button
                type="button"
                disabled={exported.empty}
                onClick={onCopy}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-ui font-medium transition-colors disabled:opacity-40",
                  copied
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
                    : "border-white/10 bg-white/[0.05] text-app-fg hover:bg-app-hover",
                )}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3">
            {exported.empty ? (
              <p className="text-ui leading-relaxed text-app-subtle">
                Select a frame or layer to see generated code. Use{" "}
                <button
                  type="button"
                  className="font-semibold text-violet-300 hover:text-violet-200"
                  onClick={() => setSection("import")}
                >
                  To canvas
                </button>{" "}
                to paste code back as editable layers.
              </p>
            ) : (
              <pre className="whitespace-pre-wrap break-words rounded-lg border border-app-border-subtle bg-[#141416] p-3 font-mono text-ui leading-relaxed text-app-fg">
                {exported.code}
              </pre>
            )}
          </div>
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="thin-scroll min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
            <p className="text-ui leading-relaxed text-app-muted">
              Paste or upload {codePanelFormat === "html" ? "HTML" : "React/TSX"} from this panel or
              another tool. Layers are rebuilt using{" "}
              <code className="text-[#b4b4b4]">data-pc-id</code>, inline styles, and{" "}
              <code className="text-[#b4b4b4]">class</code>
              {codePanelFormat === "react" ? " / className" : ""}.
            </p>
            {codePanelFormat === "react" ? (
              <button
                type="button"
                onClick={() => openCodeRoundTrip("import")}
                className="w-full rounded-lg border border-sky-500/35 bg-sky-500/10 px-3 py-2 text-left text-ui leading-relaxed text-sky-100/95 hover:bg-sky-500/15"
              >
                <span className="font-semibold">Capture live preview</span>
                <span className="mt-0.5 block text-app-muted">
                  Run your app, paste a localhost URL — real colors and typography (not in this panel).
                </span>
              </button>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-app-border bg-app-panel px-2.5 py-1 text-ui font-medium text-app-fg hover:bg-app-hover"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => onFilePick(e.target.files?.[0] ?? null)}
              />
              <label className="ml-auto flex items-center gap-2 text-ui text-app-subtle">
                Apply
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value as "replace" | "append")}
                  className="rounded border border-app-border bg-app-field px-2 py-1 text-ui text-app-fg"
                >
                  <option value="replace">Replace canvas</option>
                  <option value="append">Append</option>
                </select>
              </label>
            </div>

            <textarea
              data-code-import-field
              value={importSource}
              onChange={(e) => {
                setImportSource(e.target.value);
                setImportError(null);
              }}
              onKeyDown={(e) => handlePanelFieldKeyDown(e)}
              onPaste={() => setImportError(null)}
              placeholder={
                codePanelFormat === "html"
                  ? "Paste HTML document or snippet…"
                  : "Paste React component (.tsx) or export from this panel…"
              }
              className="h-[min(36vh,320px)] w-full resize-y rounded-lg border border-app-border bg-[#0f0f10] p-3 font-mono text-ui leading-relaxed text-app-fg focus-visible:border-accent focus-visible:outline-none"
              spellCheck={false}
            />

            {importError ? (
              <pre className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-ui leading-relaxed text-red-200">
                {importError}
              </pre>
            ) : null}
            {importStatus ? (
              <p className="text-ui text-emerald-400">{importStatus}</p>
            ) : null}
          </div>

          <div className="shrink-0 border-t border-app-border p-3">
            <button
              type="button"
              disabled={importBusy || !importSource.trim()}
              onClick={onApplyImport}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-ui-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-45"
            >
              <RefreshCw className={cn("h-4 w-4", importBusy && "animate-spin")} />
              Apply to canvas
            </button>
          </div>
        </div>
      )}

      {section === "export" && !exported.empty ? (
        <p className="shrink-0 border-t border-app-border px-3 py-2 text-ui leading-relaxed text-app-subtle">
          {codePanelFormat === "html"
            ? "Code uses the screen frame at (0,0); child positions are frame-local. Canvas frame position is not exported."
            : "Code uses the screen frame at (0,0); child positions are frame-local. Canvas frame position is not exported."}
        </p>
      ) : null}
    </div>
  );
}
