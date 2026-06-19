"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  designMdContextAttachments,
  effectiveStyleFromTheme,
  type StyleGuideMode,
  type StyleGuideTheme,
} from "@/components/ai/AIStyleGuideSelect";
import { useAIModelSelectOptions } from "@/components/ai/useAIModelSelectOptions";

const LLM_LOADING_STEPS = ["Calling model…"] as const;
const FAST_LOADING_STEPS = ["Applying design tokens…"] as const;

export const MITRA_SCREEN_PRESETS = [
  "Mobile app",
  "Landing page",
  "Dashboard",
  "Checkout",
  "Settings",
  "Profile",
  "Design system",
] as const;

export function useMitraAIGenerate() {
  const queueAIGenerate = useEditorStore((s) => s.queueAIGenerate);
  const clearAIGenerateError = useEditorStore((s) => s.clearAIGenerateError);
  const aiGenerateFailedJob = useEditorStore((s) => s.aiGenerateFailedJob);
  const aiGenerateError = useEditorStore((s) => s.aiGenerateError);
  const aiGenerateActive = useEditorStore((s) => s.aiGenerateActive);

  const { modelId, setModelId, optionGroups: modelOptionGroups } = useAIModelSelectOptions();

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
  const [attachments, setAttachments] = useState<AIContextAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [styleGuideOpen, setStyleGuideOpen] = useState(false);

  useEffect(() => {
    if (!aiGenerateFailedJob) return;
    setPrompt(aiGenerateFailedJob.prompt);
    setPreset(aiGenerateFailedJob.preset);
    setModelId(aiGenerateFailedJob.model);
    setGenerateError(aiGenerateError);
    clearAIGenerateError();
  }, [aiGenerateFailedJob, aiGenerateError, clearAIGenerateError, setModelId]);

  useEffect(() => {
    if (!isBuiltinDesignMdId(selectedDesignMdId)) {
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
  }, [selectedDesignMdId]);

  const handleDesignMdRefsChange = useCallback((next: AIContextAttachment[]) => {
    setDesignMdRefs(next);
    saveStoredDesignMdUploads(next);
  }, []);

  const handleSelectedDesignMdIdChange = useCallback((id: string | null) => {
    setSelectedDesignMdId(id);
    saveStoredSelectedDesignMdId(id);
  }, []);

  const designMdContext = designMdContextAttachments(designMdRefs, selectedDesignMdId, builtinDesignMd);
  const allContextAttachments = useMemo(
    () => [...attachments, ...designMdContext],
    [attachments, designMdContext],
  );
  const contextPrompt = buildContextPrompt(allContextAttachments);
  const contextCount = readyAttachmentCount(allContextAttachments);
  const effectiveStyle = effectiveStyleFromTheme(styleGuideTheme);
  const canGenerate = Boolean(prompt.trim() || preset || contextPrompt);
  const busy = submitting || aiGenerateActive;

  const hasImageAttachments = useMemo(
    () => attachments.some((a) => a.kind === "image" && a.status === "ready"),
    [attachments],
  );

  const runGenerate = useCallback(
    (value?: string) => {
      const nextPrompt = (value ?? prompt).trim();
      if (!nextPrompt && !preset && !contextPrompt) return;
      if (busy) return;

      setGenerateError(null);
      setSubmitting(true);

      void (async () => {
        try {
          const useFastPath = canUseRichFastPath({
            prompt: nextPrompt,
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
            prompt: nextPrompt,
            preset,
            style: effectiveStyle,
            model: modelId,
            contextPrompt: contextPrompt || undefined,
            contextAttachmentCount: contextCount || undefined,
            contextImages: contextImages.length ? contextImages : undefined,
            source: "editor",
            initialStep,
          });

          setPrompt("");
          setSubmitting(false);
        } catch (err) {
          setGenerateError(err instanceof Error ? err.message : "Generation failed.");
          setSubmitting(false);
        }
      })();
    },
    [
      prompt,
      preset,
      effectiveStyle,
      modelId,
      contextPrompt,
      contextCount,
      hasImageAttachments,
      allContextAttachments,
      queueAIGenerate,
      busy,
    ],
  );

  const clearAttachments = useCallback(() => {
    setAttachments((prev) => {
      revokeAllAttachmentPreviews(prev);
      return [];
    });
  }, []);

  return {
    prompt,
    setPrompt,
    preset,
    setPreset,
    styleGuideMode,
    setStyleGuideMode,
    styleGuideTheme,
    setStyleGuideTheme,
    designMdRefs,
    handleDesignMdRefsChange,
    selectedDesignMdId,
    handleSelectedDesignMdIdChange,
    attachments,
    setAttachments,
    modelId,
    setModelId,
    modelOptionGroups,
    attachMenuOpen,
    setAttachMenuOpen,
    styleGuideOpen,
    setStyleGuideOpen,
    generateError,
    contextCount,
    canGenerate,
    busy,
    runGenerate,
    clearAttachments,
  };
}
