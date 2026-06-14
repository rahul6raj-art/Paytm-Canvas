"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  IMPORT_WEB_STEPS,
  importWebFromApi,
  type ImportWebStep,
} from "@/lib/webImport/importWebApi";
import { importWebResponseToPersistSlice } from "@/lib/webImport/webImportToPersistSlice";
import type { ImportWebMode, ViewportPresetId } from "@/lib/webImport/types";
import { VIEWPORT_PRESETS } from "@/lib/webImport/types";
import { validateImportWebUrl } from "@/lib/webImport/urlValidation";
import { cn } from "@/lib/utils";

const MODES: { id: ImportWebMode; label: string; hint: string }[] = [
  { id: "editable", label: "Editable Design", hint: "Convert DOM into editable layers" },
  {
    id: "screenshot",
    label: "Screenshot Only",
    hint: "Import a full-page screenshot as reference",
  },
  {
    id: "editable_with_reference",
    label: "Editable + Screenshot Reference",
    hint: "Layers on top of a locked screenshot behind",
  },
];

export function ImportWebModal() {
  const router = useRouter();
  const open = useEditorStore((s) => s.importWebModalOpen);
  const closeImportWebModal = useEditorStore((s) => s.closeImportWebModal);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);

  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [mode, setMode] = useState<ImportWebMode>("editable");
  const [viewportPreset, setViewportPreset] = useState<ViewportPresetId>("desktop");
  const [customW, setCustomW] = useState(1440);
  const [customH, setCustomH] = useState(900);
  const [loading, setLoading] = useState(false);
  const [activeStep, setActiveStep] = useState<ImportWebStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setUrl("");
      setHtml("");
      setMode("editable");
      setViewportPreset("desktop");
      setCustomW(1440);
      setCustomH(900);
      setLoading(false);
      setActiveStep(null);
      setError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) {
        e.preventDefault();
        closeImportWebModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, closeImportWebModal]);

  const viewport =
    viewportPreset === "custom"
      ? { width: customW, height: customH }
      : VIEWPORT_PRESETS[viewportPreset];

  const runImport = useCallback(async () => {
    setError(null);
    const hasUrl = url.trim().length > 0;
    const hasHtml = html.trim().length > 0;
    if (!hasUrl && !hasHtml) {
      setError("Enter a URL or paste raw HTML.");
      return;
    }
    if (hasUrl) {
      const v = validateImportWebUrl(url);
      if (!v.ok) {
        setError(v.error);
        return;
      }
    }

    setLoading(true);
    setActiveStep("launching");
    try {
      const response = await importWebFromApi(
        {
          url: hasUrl ? url.trim() : undefined,
          html: hasHtml ? html : undefined,
          mode,
          viewport,
        },
        setActiveStep,
      );
      const slice = importWebResponseToPersistSlice(response);
      applyGeneratedDesign(slice, "replace", { recordHistory: false });
      closeImportWebModal();
      router.push("/editor");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setLoading(false);
      setActiveStep(null);
    }
  }, [url, html, mode, viewport, applyGeneratedDesign, closeImportWebModal, router]);

  if (!open) return null;

  const stepIndex = activeStep
    ? IMPORT_WEB_STEPS.findIndex((s) => s.id === activeStep)
    : -1;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 px-4 py-10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Import from Web"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) closeImportWebModal();
      }}
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-app-border bg-gradient-to-b from-[#1e1e22] to-[#141416] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-gradient-to-r from-sky-500 via-cyan-400 to-emerald-400" />
        <div className="flex items-start justify-between gap-3 border-b border-app-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-hover text-sky-300">
              <Globe className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-base font-semibold text-white">Import from Web</h2>
              <p className="text-ui text-app-muted">Capture a live site or HTML into the canvas.</p>
            </div>
          </div>
          <button
            type="button"
            disabled={loading}
            onClick={() => closeImportWebModal()}
            className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="max-h-[min(72vh,640px)] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-2 text-ui-sm text-white">
                <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                Importing…
              </div>
              <ol className="space-y-2">
                {IMPORT_WEB_STEPS.map((step, i) => {
                  const done = stepIndex > i;
                  const active = step.id === activeStep;
                  return (
                    <li
                      key={step.id}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2 text-ui",
                        active && "bg-app-hover text-white",
                        done && !active && "text-emerald-400",
                        !done && !active && "text-app-subtle",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ui font-semibold",
                          done ? "bg-emerald-500/20 text-emerald-400" : active ? "bg-sky-500/30 text-sky-300" : "bg-app-hover",
                        )}
                      >
                        {done ? "✓" : i + 1}
                      </span>
                      {step.label}
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block section-heading text-app-muted">
                  Website URL
                </span>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="h-10 w-full rounded-lg border border-app-border bg-app-hover px-3 text-ui-sm text-white outline-none ring-sky-500/30 placeholder:text-app-subtle focus:border-sky-500/50 focus:ring-2"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block section-heading text-app-muted">
                  Raw HTML (optional)
                </span>
                <textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  rows={4}
                  placeholder="<html>…</html>"
                  className="w-full resize-y rounded-lg border border-app-border bg-app-hover px-3 py-2 font-mono text-ui text-white outline-none ring-sky-500/30 placeholder:text-app-subtle focus:border-sky-500/50 focus:ring-2"
                />
              </label>

              <fieldset>
                <legend className="mb-2 section-heading text-app-muted">
                  Import mode
                </legend>
                <div className="space-y-2">
                  {MODES.map((m) => (
                    <label
                      key={m.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 transition-colors",
                        mode === m.id
                          ? "border-sky-500/50 bg-sky-500/10"
                          : "border-app-border bg-white/[0.02] hover:border-white/[0.14]",
                      )}
                    >
                      <input
                        type="radio"
                        name="import-mode"
                        checked={mode === m.id}
                        onChange={() => setMode(m.id)}
                        className="mt-1"
                      />
                      <span>
                        <span className="block text-ui-sm font-medium text-white">{m.label}</span>
                        <span className="text-ui text-app-muted">{m.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="mb-2 section-heading text-app-muted">
                  Viewport
                </legend>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["desktop", "Desktop 1440×900"],
                      ["tablet", "Tablet 768×1024"],
                      ["mobile", "Mobile 390×844"],
                      ["custom", "Custom"],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setViewportPreset(id)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1.5 text-ui font-medium transition-colors",
                        viewportPreset === id
                          ? "border-sky-500/50 bg-sky-500/15 text-sky-200"
                          : "border-app-border text-app-muted hover:border-white/[0.2]",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {viewportPreset === "custom" ? (
                  <div className="mt-2 flex gap-2">
                    <input
                      type="number"
                      min={320}
                      max={4096}
                      value={customW}
                      onChange={(e) => setCustomW(Number(e.target.value))}
                      className="h-9 w-24 rounded-lg border border-app-border bg-app-hover px-2 text-ui text-white"
                      aria-label="Viewport width"
                    />
                    <span className="self-center text-app-subtle">×</span>
                    <input
                      type="number"
                      min={480}
                      max={4096}
                      value={customH}
                      onChange={(e) => setCustomH(Number(e.target.value))}
                      className="h-9 w-24 rounded-lg border border-app-border bg-app-hover px-2 text-ui text-white"
                      aria-label="Viewport height"
                    />
                  </div>
                ) : null}
              </fieldset>

              {error ? (
                <pre className="whitespace-pre-wrap rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-sans text-ui leading-relaxed text-red-300">
                  {error}
                </pre>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-app-border-subtle px-5 py-4">
          <button
            type="button"
            disabled={loading}
            onClick={() => closeImportWebModal()}
            className="rounded-lg px-4 py-2 text-ui-sm font-medium text-app-muted hover:bg-app-hover hover:text-white disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void runImport()}
            className="rounded-lg bg-sky-600 px-4 py-2 text-ui-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            {loading ? "Importing…" : "Import to canvas"}
          </button>
        </div>
      </div>
    </div>
  );
}
