"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  generateDesignFromPromptAsync,
  type AIStyleId,
  type AIGeneratePreview,
  type AIGenerateResult,
} from "@/lib/aiMockGenerator";
import {
  getOpenAIModelById,
  getStoredOpenAIModelId,
  openAIModelsByCategory,
  setStoredOpenAIModelId,
} from "@/lib/openaiModels";
import { cn } from "@/lib/utils";

const PRESETS = [
  "Mobile app",
  "Landing page",
  "Dashboard",
  "Checkout",
  "Settings",
  "Profile",
  "Design system",
] as const;

const STYLES: { id: AIStyleId; label: string }[] = [
  { id: "minimal", label: "Minimal" },
  { id: "bold", label: "Bold" },
  { id: "fintech", label: "Fintech" },
  { id: "dark", label: "Dark" },
  { id: "playful", label: "Playful" },
];

const LOADING_STEPS = ["Generating layout…", "Creating components…", "Applying styles…"] as const;

export function AIGenerateModal() {
  const router = useRouter();
  const open = useEditorStore((s) => s.aiModalOpen);
  const source = useEditorStore((s) => s.aiModalSource);
  const closeAIModal = useEditorStore((s) => s.closeAIModal);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);

  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<string | undefined>(undefined);
  const [style, setStyle] = useState<AIStyleId>("fintech");
  const [modelId, setModelId] = useState(() => getStoredOpenAIModelId());
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<AIGenerateResult | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      setPrompt("");
      setPreset(undefined);
      setStyle("fintech");
      setModelId(getStoredOpenAIModelId());
      setLoading(false);
      setLoadStep(0);
      setResult(null);
      clearTimers();
    }
  }, [open, clearTimers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        clearTimers();
        closeAIModal();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, clearTimers, closeAIModal]);

  const selectedModel = getOpenAIModelById(modelId);
  const modelGroups = openAIModelsByCategory();

  const runGenerate = useCallback(() => {
    if (!prompt.trim() && !preset) return;
    setResult(null);
    setLoading(true);
    setLoadStep(0);
    clearTimers();
    const total = 800 + Math.floor(Math.random() * 400);
    const stepMs = total / LOADING_STEPS.length;
    LOADING_STEPS.forEach((_, i) => {
      const id = window.setTimeout(() => setLoadStep(i), Math.floor(i * stepMs));
      timersRef.current.push(id);
    });
    const doneId = window.setTimeout(() => {
      void (async () => {
        const gen = await generateDesignFromPromptAsync(prompt, { preset, style, model: modelId });
        setResult(gen);
        setLoading(false);
        setLoadStep(0);
      })();
    }, total);
    timersRef.current.push(doneId);
  }, [prompt, preset, style, modelId, clearTimers]);

  const onClose = () => {
    clearTimers();
    closeAIModal();
  };

  const recordHistory = source === "editor";

  const applyReplace = useCallback(() => {
    if (!result) return;
    applyGeneratedDesign(result.slice, "replace", { recordHistory });
    if (source === "dashboard") router.push("/editor");
    onClose();
  }, [result, applyGeneratedDesign, recordHistory, source, router]);

  const applyAppend = useCallback(() => {
    if (!result) return;
    applyGeneratedDesign(result.slice, "append", { recordHistory });
    onClose();
  }, [result, applyGeneratedDesign, recordHistory]);

  const openInEditor = useCallback(() => {
    if (!result) return;
    applyGeneratedDesign(result.slice, "replace", { recordHistory: false });
    router.push("/editor");
    onClose();
  }, [result, applyGeneratedDesign, router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 px-4 py-10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Generate with AI"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-app-border bg-gradient-to-b from-[#1e1e22] to-[#141416] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 via-sky-400 to-emerald-400" />
        <div className="flex items-start justify-between gap-3 border-b border-app-border-subtle px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-hover text-violet-300">
              <Sparkles className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-[15px] font-semibold text-white">Generate with AI</h2>
              <p className="text-[12px] text-app-muted">Pick an OpenAI model, then describe your screen.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>

        <div className="max-h-[min(72vh,640px)] overflow-y-auto px-5 py-4">
          {!result ? (
            <>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-app-subtle">
                Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the screen you want — e.g. “UPI checkout with order summary”"
                rows={4}
                disabled={loading}
                className="mb-4 w-full resize-none rounded-xl border border-app-border bg-black/30 px-3 py-2.5 text-[13px] leading-relaxed text-app-fg outline-none ring-0 placeholder:text-app-subtle focus:border-violet-500/40"
              />

              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-subtle">Model</p>
              <select
                value={modelId}
                disabled={loading}
                onChange={(e) => {
                  const next = e.target.value;
                  setModelId(next);
                  setStoredOpenAIModelId(next);
                }}
                className="mb-1.5 w-full rounded-xl border border-app-border bg-black/30 px-3 py-2.5 text-[13px] text-app-fg outline-none focus:border-violet-500/40 disabled:opacity-50"
                aria-label="OpenAI model"
              >
                {modelGroups.map((group) => (
                  <optgroup key={group.category} label={group.label}>
                    {group.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {m.recommended ? " · recommended" : ""}
                        {m.deprecated ? " · legacy" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {selectedModel ? (
                <p className="mb-4 text-[11px] leading-relaxed text-[#8a8a8a]">{selectedModel.description}</p>
              ) : (
                <p className="mb-4 text-[11px] text-[#8a8a8a]">Unknown model — using default.</p>
              )}

              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-subtle">Presets</p>
              <div className="mb-4 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={loading}
                    onClick={() => setPreset((cur) => (cur === p ? undefined : p))}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      preset === p
                        ? "border-violet-500/50 bg-violet-500/20 text-violet-100"
                        : "border-app-border bg-app-hover text-app-muted hover:border-white/[0.14]",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-app-subtle">Style</p>
              <div className="mb-5 flex flex-wrap gap-1.5">
                {STYLES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    disabled={loading}
                    onClick={() => setStyle(id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      style === id
                        ? "border-sky-500/50 bg-sky-500/15 text-sky-100"
                        : "border-app-border bg-app-hover text-app-muted hover:border-white/[0.14]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {loading ? (
                <div className="rounded-xl border border-app-border-subtle bg-black/25 px-4 py-6 text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                  <p className="text-[13px] font-medium text-white">{LOADING_STEPS[loadStep] ?? LOADING_STEPS[0]}</p>
                  <p className="mt-1 text-[11px] text-app-subtle">
                    Generating with {selectedModel?.label ?? modelId}…
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={runGenerate}
                  disabled={!prompt.trim() && !preset}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 py-2.5 text-[13px] font-semibold text-white shadow-lg transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Sparkles className="h-4 w-4" strokeWidth={2} />
                  Generate
                </button>
              )}
            </>
          ) : (
            <PreviewPanel preview={result.preview} />
          )}
        </div>

        {result ? (
          <div className="flex flex-col gap-2 border-t border-app-border-subtle bg-black/20 px-5 py-4">
            {source === "dashboard" ? (
              <button
                type="button"
                onClick={openInEditor}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-sky-600 py-2.5 text-[13px] font-semibold text-white shadow-md"
              >
                Open in editor
              </button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={applyReplace}
                  className="flex-1 rounded-xl border border-rose-500/35 bg-rose-500/15 py-2.5 text-[12px] font-semibold text-rose-100 hover:bg-rose-500/25"
                >
                  Replace current file
                </button>
                <button
                  type="button"
                  onClick={applyAppend}
                  className="flex-1 rounded-xl border border-emerald-500/35 bg-emerald-500/15 py-2.5 text-[12px] font-semibold text-emerald-100 hover:bg-emerald-500/25"
                >
                  Add to current file
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setResult(null);
              }}
              className="text-center text-[12px] font-medium text-app-subtle hover:text-white"
            >
              ← Edit prompt
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PreviewPanel({ preview }: { preview: AIGeneratePreview }) {
  return (
    <div className="rounded-xl border border-app-border bg-black/25 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-app-subtle">Preview</p>
      <p className="mt-2 text-[14px] font-semibold text-white">{preview.fileName}</p>
      <p className="mt-1 text-[12px] text-[#a3a3a3]">{preview.flowLabel}</p>
      {preview.modelLabel ? (
        <p className="mt-1 text-[11px] text-app-subtle">
          Model: <span className="text-app-muted">{preview.modelLabel}</span>
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-app-subtle">
          <span className="font-medium text-app-fg">{preview.frameCount}</span> frames
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-app-subtle">Palette</span>
          {preview.palette.map((c) => (
            <span
              key={c}
              className="h-6 w-6 rounded-md border border-white/10 shadow-inner"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
