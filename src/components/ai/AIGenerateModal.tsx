"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  ChevronDown,
  LayoutGrid,
  Loader2,
  Palette,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { AIContextAttachments } from "@/components/ai/AIContextAttachments";
import {
  buildContextPrompt,
  readyAttachmentCount,
  revokeAllAttachmentPreviews,
  type AIContextAttachment,
} from "@/lib/aiGenerateContext";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  generateDesignFromPromptAsync,
  type AIStyleId,
  type AIGeneratePreview,
  type AIGenerateResult,
} from "@/lib/aiMockGenerator";
import {
  aiModelSelectGroups,
  getAIModelById,
  getStoredAIModelId,
  setStoredAIModelId,
} from "@/lib/aiModels";
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
  const [modelId, setModelId] = useState(() => getStoredAIModelId());
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<AIGenerateResult | null>(null);
  const [attachments, setAttachments] = useState<AIContextAttachment[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const timersRef = useRef<number[]>([]);
  const toolsRef = useRef<HTMLDivElement>(null);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      setPrompt("");
      setPreset(undefined);
      setStyle("fintech");
      setModelId(getStoredAIModelId());
      setLoading(false);
      setLoadStep(0);
      setResult(null);
      setToolsOpen(false);
      setAttachments((prev) => {
        revokeAllAttachmentPreviews(prev);
        return [];
      });
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

  useEffect(() => {
    if (!toolsOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [toolsOpen]);

  const selectedModel = getAIModelById(modelId);
  const modelGroups = aiModelSelectGroups();

  const contextPrompt = buildContextPrompt(attachments);
  const contextCount = readyAttachmentCount(attachments);
  const canGenerate = Boolean(prompt.trim() || preset || contextPrompt);

  const runGenerate = useCallback(() => {
    if (!canGenerate || loading) return;
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
        const gen = await generateDesignFromPromptAsync(prompt, {
          preset,
          style,
          model: modelId,
          contextPrompt: contextPrompt || undefined,
          contextAttachmentCount: contextCount || undefined,
        });
        setResult(gen);
        setLoading(false);
        setLoadStep(0);
      })();
    }, total);
    timersRef.current.push(doneId);
  }, [canGenerate, loading, prompt, preset, style, modelId, contextPrompt, contextCount, clearTimers]);

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
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/55 px-4 py-10 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Generate with AI"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!result ? (
          <div className="relative overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl shadow-app-panel">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to create"
              rows={3}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runGenerate();
                }
              }}
              className="min-h-[108px] w-full resize-none border-0 bg-transparent px-5 pb-2 pt-5 pr-12 text-[15px] leading-relaxed text-app-fg outline-none ring-0 placeholder:text-app-muted disabled:opacity-50"
            />

            <AIContextAttachments
              variant="minimal"
              minimalPart="chips"
              attachments={attachments}
              disabled={loading}
              onChange={setAttachments}
            />

            <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-1">
              <div className="flex items-center gap-2">
                <AIContextAttachments
                  variant="minimal"
                  minimalPart="button"
                  attachments={attachments}
                  disabled={loading}
                  onChange={setAttachments}
                />

                <div ref={toolsRef} className="relative">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setToolsOpen((v) => !v)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded-full border border-app-border bg-app-panel px-3 text-[12px] font-medium text-app-muted transition-colors",
                      "hover:bg-app-hover hover:text-app-fg",
                      toolsOpen && "border-accent/40 bg-app-hover text-app-fg",
                    )}
                  >
                    <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
                    Tools
                  </button>
                  {toolsOpen ? (
                    <div className="absolute left-0 top-full z-10 mt-2 w-48 rounded-xl border border-app-border bg-app-panel py-1 shadow-2xl">
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-[12px] text-app-fg hover:bg-app-hover"
                        onClick={() => {
                          setPrompt("A fintech dashboard with balance card, spending chart, and recent transactions");
                          setToolsOpen(false);
                        }}
                      >
                        Example prompt
                      </button>
                      <button
                        type="button"
                        disabled={!prompt.trim()}
                        className="block w-full px-3 py-2 text-left text-[12px] text-app-fg hover:bg-app-hover disabled:opacity-40"
                        onClick={() => {
                          setPrompt("");
                          setToolsOpen(false);
                        }}
                      >
                        Clear prompt
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <button
                type="button"
                disabled={!canGenerate || loading}
                onClick={runGenerate}
                aria-label="Generate"
                title={loading ? LOADING_STEPS[loadStep] : "Generate"}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                  canGenerate && !loading
                    ? "bg-accent text-white hover:brightness-110"
                    : "bg-app-hover text-app-muted",
                )}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                ) : (
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                )}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-app-border-subtle bg-app-toolbar-well px-3 py-2.5">
              <PillSelect
                icon={Zap}
                label="Screen"
                value={preset ?? ""}
                disabled={loading}
                onChange={(v) => setPreset(v || undefined)}
                options={[
                  { value: "", label: "Any screen" },
                  ...PRESETS.map((p) => ({ value: p, label: p })),
                ]}
              />
              <PillSelect
                icon={LayoutGrid}
                label="Model"
                value={modelId}
                disabled={loading}
                onChange={(v) => {
                  setModelId(v);
                  setStoredAIModelId(v);
                }}
                optionGroups={modelGroups.map((g) => ({
                  label: g.label,
                  options: g.models.map((m) => ({
                    value: m.id,
                    label: `${m.label}${m.recommended ? " · rec" : ""}`,
                  })),
                }))}
              />
              <PillSelect
                icon={Palette}
                label="Style"
                value={style}
                disabled={loading}
                onChange={(v) => setStyle(v as AIStyleId)}
                options={STYLES.map((s) => ({ value: s.id, label: s.label }))}
              />
            </div>

            {loading ? (
              <p className="border-t border-app-border-subtle px-4 py-2 text-center text-[11px] text-app-muted">
                {LOADING_STEPS[loadStep] ?? LOADING_STEPS[0]} · {selectedModel?.label ?? modelId}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl border border-app-border bg-app-panel text-app-fg shadow-2xl shadow-app-panel">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-app-muted transition-colors hover:bg-app-hover hover:text-app-fg"
              aria-label="Close"
            >
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
            <div className="p-5">
              <PreviewPanel preview={result.preview} />
            </div>
            <div className="flex flex-col gap-2 border-t border-app-border-subtle bg-app-toolbar-well px-4 py-3">
              {source === "dashboard" ? (
                <button
                  type="button"
                  onClick={openInEditor}
                  className="w-full rounded-full bg-accent py-2.5 text-[13px] font-semibold text-white hover:brightness-110"
                >
                  Open in editor
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={applyReplace}
                    className="flex-1 rounded-full border border-app-border bg-app-panel py-2 text-[12px] font-semibold text-app-fg transition-colors hover:bg-app-hover"
                  >
                    Replace file
                  </button>
                  <button
                    type="button"
                    onClick={applyAppend}
                    className="flex-1 rounded-full border border-accent/40 bg-accent/10 py-2 text-[12px] font-semibold text-accent transition-colors hover:bg-accent/20"
                  >
                    Add to file
                  </button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setResult(null)}
                className="text-center text-[12px] font-medium text-app-muted hover:text-app-fg"
              >
                ← Edit prompt
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PillSelect({
  icon: Icon,
  label,
  value,
  onChange,
  disabled,
  options,
  optionGroups,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  options?: { value: string; label: string }[];
  optionGroups?: { label: string; options: { value: string; label: string }[] }[];
}) {
  const display =
    options?.find((o) => o.value === value)?.label ??
    optionGroups?.flatMap((g) => g.options).find((o) => o.value === value)?.label ??
    label;

  return (
    <label
      className={cn(
        "relative inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full border border-app-border bg-app-panel py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-app-fg shadow-sm",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-app-muted" strokeWidth={2} />
      <span className="max-w-[100px] truncate">{display === label ? label : display}</span>
      <ChevronDown className="h-3 w-3 shrink-0 text-app-subtle" strokeWidth={2.5} />
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options
          ? options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          : null}
        {optionGroups
          ? optionGroups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))
          : null}
      </select>
    </label>
  );
}

function PreviewPanel({ preview }: { preview: AIGeneratePreview }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-inset p-4">
      <p className="text-[14px] font-semibold text-app-fg">{preview.fileName}</p>
      <p className="mt-1 text-[12px] text-app-muted">{preview.flowLabel}</p>
      {preview.modelLabel ? (
        <p className="mt-1 text-[11px] text-app-subtle">
          {preview.modelLabel}
          {preview.contextAttachmentCount
            ? ` · ${preview.contextAttachmentCount} attachment${preview.contextAttachmentCount === 1 ? "" : "s"}`
            : ""}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="text-[12px] text-app-muted">
          <span className="font-medium text-app-fg">{preview.frameCount}</span> frames
        </span>
        <div className="flex items-center gap-1">
          {preview.palette.map((c) => (
            <span
              key={c}
              className="h-5 w-5 rounded-md border border-app-border"
              style={{ backgroundColor: c }}
              title={c}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
