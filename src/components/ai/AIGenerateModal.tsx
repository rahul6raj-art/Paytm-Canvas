"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowUp, Code2, Figma, LayoutGrid, Wrench, X, Zap } from "lucide-react";
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
import { canUseRichFastPath } from "@/lib/aiGenerateFastPath";
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
  CURSOR_MODEL_OPTIONS,
  OPENAI_FAST_MODEL_OPTIONS,
  DEFAULT_AI_MODEL_ID,
  getAIModelById,
  getStoredAIModelId,
  isCursorModelId,
  isOpenAIModelId,
  isValidAIModelId,
  setStoredAIModelId,
} from "@/lib/aiModels";
import {
  anchoredMenuStyle,
  useAnchoredDropdownPosition,
  useDismissAnchoredDropdown,
} from "@/components/editor/useAnchoredDropdown";
import { cn } from "@/lib/utils";
import { EditorHintWrap } from "@/components/editor/EditorHoverHint";

const PRESETS = [
  "Mobile app",
  "Landing page",
  "Dashboard",
  "Checkout",
  "Settings",
  "Profile",
  "Design system",
] as const;

const LLM_LOADING_STEPS = ["Calling model…"] as const;
const FAST_LOADING_STEPS = ["Applying design tokens…"] as const;

/** Above modal overlay (220) and import overlays (230). */
const AI_FLOATING_MENU_Z = "z-[500]";

type ModelsApiResponse = {
  defaultModelId?: string;
  openai?: { configured: boolean };
  cursor?: { configured: boolean };
  groups?: { label: string; models: { id: string; label: string; description: string }[] }[];
};

export function AIGenerateModal() {
  const router = useRouter();
  const open = useEditorStore((s) => s.aiModalOpen);
  const source = useEditorStore((s) => s.aiModalSource);
  const closeAIModal = useEditorStore((s) => s.closeAIModal);
  const queueAIGenerate = useEditorStore((s) => s.queueAIGenerate);
  const clearAIGenerateError = useEditorStore((s) => s.clearAIGenerateError);
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
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<AIContextAttachment[]>([]);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsMounted, setToolsMounted] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [modelsMeta, setModelsMeta] = useState<ModelsApiResponse | null>(null);
  const toolsButtonRef = useRef<HTMLButtonElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  const toolsMenuPosition = useAnchoredDropdownPosition(toolsButtonRef, toolsOpen, 6, {
    viewportClamp: true,
    maxHeight: 320,
    width: 224,
  });
  useDismissAnchoredDropdown(toolsOpen, () => setToolsOpen(false), toolsButtonRef, toolsMenuRef);

  useEffect(() => {
    if (!open) {
      setSubmitting(false);
      setToolsOpen(false);
      setAttachments((prev) => {
        revokeAllAttachmentPreviews(prev);
        return [];
      });
      return;
    }

    const st = useEditorStore.getState();
    if (st.aiGenerateFailedJob) {
      const failed = st.aiGenerateFailedJob;
      setPrompt(failed.prompt);
      setPreset(failed.preset);
      setModelId(failed.model);
      setGenerateError(st.aiGenerateError);
      clearAIGenerateError();
    } else {
      setPrompt("");
      setPreset(undefined);
      setGenerateError(null);
      setStyleGuideMode("design-md");
      setStyleGuideTheme("auto");
      setBuiltinDesignMd(null);
      setModelId(getStoredAIModelId());
      setModelsMeta(null);
    }
  }, [open, clearAIGenerateError]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      if (toolsOpen) {
        setToolsOpen(false);
        return;
      }
      closeAIModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, toolsOpen, closeAIModal]);

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

  const modelOptions = useMemo(() => {
    const openaiConfigured = modelsMeta?.openai?.configured ?? false;
    const cursorConfigured = modelsMeta?.cursor?.configured ?? false;
    const fallbackGroups = [
      { label: "Fast (recommended)", models: OPENAI_FAST_MODEL_OPTIONS },
      { label: "Cursor (slower)", models: CURSOR_MODEL_OPTIONS },
    ];
    const models = (modelsMeta?.groups ?? fallbackGroups).flatMap((g) => g.models);

    return models.map((m) => {
      let hint: string | undefined;
      if (isOpenAIModelId(m.id) && !openaiConfigured) {
        hint = "Set OPENAI_API_KEY in .env.local";
      } else if (isCursorModelId(m.id) && !cursorConfigured) {
        hint = "Set CURSOR_API_KEY in .env.local";
      }
      return {
        value: m.id,
        label: m.label,
        hint,
        disabled: false,
      };
    });
  }, [modelsMeta]);

  useEffect(() => {
    if (!open || !modelsMeta) return;
    if (!isValidAIModelId(modelId)) {
      const next = modelsMeta.defaultModelId ?? DEFAULT_AI_MODEL_ID;
      setModelId(next);
      setStoredAIModelId(next);
    }
  }, [open, modelsMeta, modelId]);

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

  const hasImageAttachments = useMemo(
    () => attachments.some((a) => a.kind === "image" && a.status === "ready"),
    [attachments],
  );

  const runGenerate = useCallback(() => {
    if (!canGenerate || submitting) return;
    setGenerateError(null);
    setSubmitting(true);

    void (async () => {
      try {
        const useFastPath = canUseRichFastPath({
          prompt,
          preset,
          style: effectiveStyle,
          model: modelId,
          contextPrompt: contextPrompt || undefined,
          contextAttachmentCount: contextCount || undefined,
        });
        const initialStep = useFastPath ? FAST_LOADING_STEPS[0]! : LLM_LOADING_STEPS[0]!;

        const { extractContextImagesForApi } = await import("@/lib/aiContextImages");
        const contextImages = hasImageAttachments
          ? await extractContextImagesForApi(allContextAttachments)
          : [];

        queueAIGenerate({
          prompt,
          preset,
          style: effectiveStyle,
          model: modelId,
          contextPrompt: contextPrompt || undefined,
          contextAttachmentCount: contextCount || undefined,
          contextImages: contextImages.length ? contextImages : undefined,
          source: source ?? "editor",
          initialStep,
        });

        if (source === "dashboard") {
          router.push("/editor");
        }
      } catch (err) {
        setGenerateError(err instanceof Error ? err.message : "Generation failed.");
        setSubmitting(false);
      }
    })();
  }, [
    canGenerate,
    submitting,
    prompt,
    preset,
    effectiveStyle,
    modelId,
    contextPrompt,
    contextCount,
    hasImageAttachments,
    allContextAttachments,
    queueAIGenerate,
    source,
    router,
  ]);

  const onClose = () => closeAIModal();

  if (!open) return null;
  if (source === "editor") return null;

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
            <p className="px-3 pb-1 pt-2 section-heading">Prompt</p>
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-ui text-app-fg hover:bg-app-hover"
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
              className="block w-full px-3 py-2 text-left text-ui text-app-fg hover:bg-app-hover disabled:opacity-40"
              onClick={() => {
                setPrompt("");
                setToolsOpen(false);
              }}
            >
              Clear prompt
            </button>
            <div className="my-1 border-t border-app-border-subtle" role="separator" />
            <p className="px-3 pb-1 pt-1 section-heading">Import</p>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-ui text-app-fg hover:bg-app-hover"
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
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-ui text-app-fg hover:bg-app-hover"
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
        <div className="relative w-full max-w-xl" onMouseDown={(e) => e.stopPropagation()}>
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
              disabled={submitting}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  runGenerate();
                }
              }}
              className="min-h-[108px] w-full resize-none border-0 bg-transparent px-5 pb-2 pt-5 pr-12 text-base leading-relaxed text-app-fg outline-none ring-0 placeholder:text-app-muted disabled:opacity-50"
            />

            <AIContextAttachments
              variant="minimal"
              minimalPart="chips"
              floatingMenuZClass={AI_FLOATING_MENU_Z}
              attachments={attachments}
              disabled={submitting}
              onChange={setAttachments}
            />

            <div className="relative z-0 flex items-center justify-between gap-3 overflow-visible px-4 pb-3 pt-1">
              <div className="flex items-center gap-2 overflow-visible">
                <AIContextAttachments
                  variant="minimal"
                  minimalPart="button"
                  floatingMenuZClass={AI_FLOATING_MENU_Z}
                  attachments={attachments}
                  disabled={submitting}
                  onChange={setAttachments}
                />

                <button
                  ref={toolsButtonRef}
                  type="button"
                  disabled={submitting}
                  aria-haspopup="menu"
                  aria-expanded={toolsOpen}
                  onClick={() => setToolsOpen((v) => !v)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border border-app-border bg-app-panel px-3 text-ui font-medium text-app-muted transition-colors",
                    "hover:bg-app-hover hover:text-app-fg",
                    toolsOpen && "border-accent/40 bg-app-hover text-app-fg",
                  )}
                >
                  <Wrench className="h-3.5 w-3.5" strokeWidth={2} />
                  Tools
                </button>
              </div>

              <EditorHintWrap title="Generate on canvas">
                <button
                  type="button"
                  disabled={!canGenerate || submitting}
                  onClick={runGenerate}
                  aria-label="Generate"
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition-colors",
                    canGenerate && !submitting
                      ? "bg-accent text-white hover:brightness-110"
                      : "bg-app-hover text-app-muted",
                  )}
                >
                  <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </EditorHintWrap>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 border-t border-app-border-subtle bg-app-toolbar-well px-3 py-2.5">
              <FloatingPillSelect
                icon={Zap}
                label="Screen"
                value={preset ?? ""}
                disabled={submitting}
                menuZClass={AI_FLOATING_MENU_Z}
                onChange={(v) => setPreset(v || undefined)}
                options={[
                  { value: "", label: "Any screen" },
                  ...PRESETS.map((p) => ({ value: p, label: p })),
                ]}
              />
              <AIStyleGuideSelect
                disabled={submitting}
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
                disabled={submitting}
                menuZClass={AI_FLOATING_MENU_Z}
                onChange={(v) => {
                  setModelId(v);
                  setStoredAIModelId(v);
                }}
                options={modelOptions}
              />
            </div>

            {styleGuideMode === "design-md" && contextCount === 0 && !submitting ? (
              <p className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-ui text-amber-100">
                Add or select a Design.md file in Style Guide so generation uses your brand tokens and typography.
              </p>
            ) : null}
            {generateError ? (
              <p className="border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-ui text-rose-200">
                {generateError}
              </p>
            ) : null}
          </AIModalFrame>
        </div>
      </div>
    </>
  );
}
