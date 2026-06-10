"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUp, Code2, Figma, LayoutGrid, Loader2, Wrench, X, Zap } from "lucide-react";
import { AIContextAttachments } from "@/components/ai/AIContextAttachments";
import {
  AIStyleGuideSelect,
  designMdContextAttachments,
  effectiveStyleFromTheme,
  type StyleGuideMode,
  type StyleGuideTheme,
} from "@/components/ai/AIStyleGuideSelect";
import { AIModalFrame } from "@/components/ai/AIModalFrame";
import { FloatingPillSelect } from "@/components/ai/FloatingPillSelect";
import { extractContextImagesForApi } from "@/lib/aiContextImages";
import {
  buildContextPrompt,
  readyAttachmentCount,
  revokeAllAttachmentPreviews,
  type AIContextAttachment,
} from "@/lib/aiGenerateContext";
import {
  loadStoredDesignMdUploads,
  loadStoredSelectedDesignMdId,
  normalizeStoredSelection,
  saveStoredDesignMdUploads,
  saveStoredSelectedDesignMdId,
} from "@/lib/aiDesignMdStorage";
import {
  builtinSlugFromId,
  isBuiltinDesignMdId,
  loadBuiltinDesignMdAttachment,
} from "@/lib/builtinDesignMd";
import { useEditorStore } from "@/stores/useEditorStore";
import {
  generateDesignFromPromptAsync,
  type AIGeneratePreview,
  type AIGenerateResult,
} from "@/lib/aiMockGenerator";
import {
  type AIModelSelectGroup,
  aiModelSelectGroups,
  getAIModelById,
  getStoredAIModelId,
  isOllamaModelId,
  setStoredAIModelId,
} from "@/lib/aiModels";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "@/components/editor/useAnchoredDropdown";
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

const LOADING_STEPS = [
  "Calling model…",
  "Parsing layout JSON…",
  "Building canvas…",
] as const;
/** Above modal overlay (220) and import overlays (230). */
const AI_FLOATING_MENU_Z = "z-[500]";

type ModelsApiResponse = {
  groups?: AIModelSelectGroup[];
  ollama?: { reachable: boolean; availability?: Record<string, boolean> };
  openai?: { configured: boolean };
};

export function AIGenerateModal() {
  const router = useRouter();
  const open = useEditorStore((s) => s.aiModalOpen);
  const source = useEditorStore((s) => s.aiModalSource);
  const closeAIModal = useEditorStore((s) => s.closeAIModal);
  const applyGeneratedDesign = useEditorStore((s) => s.applyGeneratedDesign);
  const openImportFigmaModal = useEditorStore((s) => s.openImportFigmaModal);
  const openCodeRoundTrip = useEditorStore((s) => s.openCodeRoundTrip);

  const [prompt, setPrompt] = useState("");
  const [preset, setPreset] = useState<string | undefined>(undefined);
  const [styleGuideMode, setStyleGuideMode] = useState<StyleGuideMode>("design-md");
  const [styleGuideTheme, setStyleGuideTheme] = useState<StyleGuideTheme>("auto");
  const [designMdRefs, setDesignMdRefs] = useState<AIContextAttachment[]>(() => loadStoredDesignMdUploads());
  const [selectedDesignMdId, setSelectedDesignMdId] = useState<string | null>(() => {
    const uploads = loadStoredDesignMdUploads();
    return normalizeStoredSelection(loadStoredSelectedDesignMdId(), uploads);
  });
  const [builtinDesignMd, setBuiltinDesignMd] = useState<AIContextAttachment | null>(null);
  const [modelId, setModelId] = useState(() => getStoredAIModelId());
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<AIGenerateResult | null>(null);
  const [attachments, setAttachments] = useState<AIContextAttachment[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsMounted, setToolsMounted] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [modelsMeta, setModelsMeta] = useState<ModelsApiResponse | null>(null);
  const timersRef = useRef<number[]>([]);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const toolsMenuPosition = useAnchoredDropdownPosition(toolsButtonRef, toolsOpen, 6, {
    viewportClamp: true,
    maxHeight: 320,
    width: 224,
  });
  useDismissAnchoredDropdown(toolsOpen, () => setToolsOpen(false), toolsButtonRef, toolsMenuRef);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    if (!open) {
      setPrompt("");
      setPreset(undefined);
      setStyleGuideMode("design-md");
      setStyleGuideTheme("auto");
      setBuiltinDesignMd(null);
      setModelId(getStoredAIModelId());
      setLoading(false);
      setLoadStep(0);
      setResult(null);
      setGenerateError(null);
      setModelsMeta(null);
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
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (toolsOpen) {
        setToolsOpen(false);
        return;
      }
      clearTimers();
      closeAIModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toolsOpen, clearTimers, closeAIModal]);

  useEffect(() => setToolsMounted(true), []);

  const handleDesignMdRefsChange = useCallback((next: AIContextAttachment[]) => {
    setDesignMdRefs(next);
    saveStoredDesignMdUploads(next);
  }, []);

  const handleSelectedDesignMdIdChange = useCallback((id: string | null) => {
    setSelectedDesignMdId(id);
    saveStoredSelectedDesignMdId(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/v1/ai/models");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ModelsApiResponse;
        if (!cancelled) setModelsMeta(data);
      } catch {
        /* keep static registry */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const selectedModel = getAIModelById(modelId);

  const modelOptionGroups = useMemo(() => {
    const groups = modelsMeta?.groups?.length ? modelsMeta.groups : aiModelSelectGroups();
    const ollamaReachable = modelsMeta?.ollama?.reachable ?? false;
    const availability = modelsMeta?.ollama?.availability ?? {};
    const openaiConfigured = modelsMeta?.openai?.configured ?? false;

    return groups.map((g) => ({
      label: g.label,
      options: g.models.map((m) => {
        let hint: string | undefined = m.description;
        let disabled = false;
        if (isOllamaModelId(m.id)) {
          if (!ollamaReachable) {
            hint = "Start Ollama (localhost:11434)";
            disabled = false;
          } else if (availability[m.id] === false) {
            hint = `Run: ollama pull ${m.ollamaTag ?? m.label}`;
          }
        } else if (!openaiConfigured) {
          hint = "Set OPENAI_API_KEY in .env.local";
        }
        return {
          value: m.id,
          label: m.label,
          hint,
          disabled,
        };
      }),
    }));
  }, [modelsMeta]);

  useEffect(() => {
    if (!open || !isBuiltinDesignMdId(selectedDesignMdId)) {
      setBuiltinDesignMd(null);
      return;
    }

    const slug = builtinSlugFromId(selectedDesignMdId);
    let cancelled = false;
    setBuiltinDesignMd({
      id: selectedDesignMdId,
      kind: "design-md",
      name: `${slug} DESIGN.md`,
      size: 0,
      status: "loading",
    });

    void loadBuiltinDesignMdAttachment(slug).then((attachment) => {
      if (!cancelled) setBuiltinDesignMd(attachment);
    });

    return () => {
      cancelled = true;
    };
  }, [open, selectedDesignMdId]);

  const designMdContext = designMdContextAttachments(designMdRefs, selectedDesignMdId, builtinDesignMd);
  const allContextAttachments = useMemo(
    () => [...attachments, ...designMdContext],
    [attachments, designMdContext],
  );
  const contextPrompt = buildContextPrompt(allContextAttachments);
  const contextCount = readyAttachmentCount(allContextAttachments);
  const effectiveStyle = effectiveStyleFromTheme(styleGuideTheme);
  const canGenerate = Boolean(prompt.trim() || preset || contextPrompt);

  const runGenerate = useCallback(() => {
    if (!canGenerate || loading) return;
    setResult(null);
    setGenerateError(null);
    setLoading(true);
    setLoadStep(0);
    clearTimers();

    const stepTimers = LOADING_STEPS.map((_, i) =>
      window.setTimeout(() => setLoadStep(i), i * 1200),
    );
    timersRef.current.push(...stepTimers);

    void (async () => {
      try {
        const contextImages = await extractContextImagesForApi(allContextAttachments);
        const gen = await generateDesignFromPromptAsync(prompt, {
          preset,
          style: effectiveStyle,
          model: modelId,
          contextPrompt: contextPrompt || undefined,
          contextAttachmentCount: contextCount || undefined,
          contextImages: contextImages.length ? contextImages : undefined,
        });
        setResult(gen);
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : "Generation failed.");
      } finally {
        clearTimers();
        setLoading(false);
        setLoadStep(0);
      }
    })();
  }, [
    canGenerate,
    loading,
    prompt,
    preset,
    effectiveStyle,
    modelId,
    contextPrompt,
    contextCount,
    allContextAttachments,
    clearTimers,
  ]);

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

  const toolsMenu =
    toolsOpen && toolsMounted
      ? createPortal(
          <div
            ref={toolsMenuRef}
            role="menu"
            aria-label="Tools"
            className={cn(
              "fixed w-56 overflow-y-auto overscroll-contain rounded-xl border border-app-border bg-app-panel py-1 shadow-2xl",
              AI_FLOATING_MENU_Z,
            )}
            style={{ ...anchoredMenuStyle(toolsMenuPosition), zIndex: 500 }}
          >
            <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-app-subtle">
              Prompt
            </p>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[12px] text-app-fg hover:bg-app-hover"
              onClick={() => {
                setPrompt(
                  "A fintech dashboard with balance card, spending chart, and recent transactions",
                );
                setToolsOpen(false);
              }}
            >
              Example prompt
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!prompt.trim()}
              className="block w-full px-3 py-2 text-left text-[12px] text-app-fg hover:bg-app-hover disabled:opacity-40"
              onClick={() => {
                setPrompt("");
                setToolsOpen(false);
              }}
            >
              Clear prompt
            </button>
            <div className="my-1 border-t border-app-border-subtle" role="separator" />
            <p className="px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-app-subtle">
              Import
            </p>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-app-fg hover:bg-app-hover"
              onClick={() => {
                setToolsOpen(false);
                openImportFigmaModal();
              }}
            >
              <Figma className="h-3.5 w-3.5 shrink-0 text-app-muted" strokeWidth={1.75} />
              Import from Figma
            </button>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-app-fg hover:bg-app-hover"
              onClick={() => {
                setToolsOpen(false);
                openCodeRoundTrip("import");
              }}
            >
              <Code2 className="h-3.5 w-3.5 shrink-0 text-app-muted" strokeWidth={1.75} />
              Code to Canvas
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      {toolsMenu}
      <div
      className="fixed inset-0 z-[220] flex items-start justify-center overflow-y-auto bg-black/55 px-4 pb-10 pt-[10vh] backdrop-blur-[2px] sm:pt-[12vh]"
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
          <AIModalFrame>
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
              floatingMenuZClass={AI_FLOATING_MENU_Z}
              attachments={attachments}
              disabled={loading}
              onChange={setAttachments}
            />

            <div className="relative z-0 flex items-center justify-between gap-3 overflow-visible px-4 pb-3 pt-1">
              <div className="flex items-center gap-2 overflow-visible">
                <AIContextAttachments
                  variant="minimal"
                  minimalPart="button"
                  floatingMenuZClass={AI_FLOATING_MENU_Z}
                  attachments={attachments}
                  disabled={loading}
                  onChange={setAttachments}
                />

                <button
                  ref={toolsButtonRef}
                  type="button"
                  disabled={loading}
                  aria-haspopup="menu"
                  aria-expanded={toolsOpen}
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

            <div className="flex w-full flex-wrap items-center gap-2 border-t border-app-border-subtle bg-app-toolbar-well px-3 py-2.5">
              <FloatingPillSelect
                icon={Zap}
                label="Screen"
                value={preset ?? ""}
                disabled={loading}
                menuZClass={AI_FLOATING_MENU_Z}
                onChange={(v) => setPreset(v || undefined)}
                options={[
                  { value: "", label: "Any screen" },
                  ...PRESETS.map((p) => ({ value: p, label: p })),
                ]}
              />
              <AIStyleGuideSelect
                disabled={loading}
                menuZClass={AI_FLOATING_MENU_Z}
                mode={styleGuideMode}
                onModeChange={setStyleGuideMode}
                designMdRefs={designMdRefs}
                onDesignMdRefsChange={handleDesignMdRefsChange}
                selectedDesignMdId={selectedDesignMdId}
                onSelectedDesignMdIdChange={handleSelectedDesignMdIdChange}
                theme={styleGuideTheme}
                onThemeChange={setStyleGuideTheme}
              />
              <FloatingPillSelect
                icon={LayoutGrid}
                label="Model"
                value={modelId}
                disabled={loading}
                menuZClass={AI_FLOATING_MENU_Z}
                className="ml-auto"
                onChange={(v) => {
                  setModelId(v);
                  setStoredAIModelId(v);
                }}
                optionGroups={modelOptionGroups}
              />
            </div>

            {loading ? (
              <p className="border-t border-app-border-subtle px-4 py-2 text-center text-[11px] text-app-muted">
                {LOADING_STEPS[loadStep] ?? LOADING_STEPS[0]} · {selectedModel?.label ?? modelId}
              </p>
            ) : null}
            {styleGuideMode === "design-md" && contextCount === 0 && !loading ? (
              <p className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-[11px] text-amber-100">
                Add or select a Design.md file in Style Guide so generation uses your brand tokens and typography.
              </p>
            ) : null}
            {generateError ? (
              <p className="border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-[11px] text-rose-200">
                {generateError}
              </p>
            ) : null}
          </AIModalFrame>
        ) : (
          <AIModalFrame>
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
          </AIModalFrame>
        )}
      </div>
    </div>
    </>
  );
}

function PreviewPanel({ preview }: { preview: AIGeneratePreview }) {
  return (
    <div className="rounded-xl border border-app-border bg-app-inset p-4">
      <p className="text-[14px] font-semibold text-app-fg">{preview.fileName}</p>
      <p className="mt-1 text-[12px] text-app-muted">{preview.flowLabel}</p>
      {preview.detectedIntent ? (
        <p className="mt-1 text-[11px] text-violet-300">Detected: {preview.detectedIntent}</p>
      ) : null}
      {preview.modelLabel ? (
        <p className="mt-1 text-[11px] text-app-subtle">
          {preview.modelLabel}
          {preview.generationSource === "llm" ? " · from your prompt" : ""}
          {preview.contextAttachmentCount
            ? ` · ${preview.contextAttachmentCount} attachment${preview.contextAttachmentCount === 1 ? "" : "s"}`
            : ""}
        </p>
      ) : null}
      {preview.warning ? (
        <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100/90">
          {preview.warning}
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
