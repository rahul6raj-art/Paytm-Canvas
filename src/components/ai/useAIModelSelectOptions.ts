"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CURSOR_MODEL_OPTIONS,
  DEFAULT_AI_MODEL_ID,
  isCursorModelId,
  isOpenAIModelId,
  isValidAIModelId,
  OPENAI_FAST_MODEL_OPTIONS,
  getStoredAIModelId,
  setStoredAIModelId,
} from "@/lib/aiModels";
import type { PillSelectGroup } from "@/components/ai/FloatingPillSelect";

type ModelsApiResponse = {
  defaultModelId?: string;
  openai?: { configured: boolean };
  cursor?: { configured: boolean };
  groups?: { label: string; models: { id: string; label: string; description: string }[] }[];
};

export function useAIModelSelectOptions() {
  const [modelId, setModelIdState] = useState(() => getStoredAIModelId());
  const [modelsMeta, setModelsMeta] = useState<ModelsApiResponse | null>(null);

  useEffect(() => {
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
  }, []);

  const optionGroups = useMemo((): PillSelectGroup[] => {
    const openaiConfigured = modelsMeta?.openai?.configured ?? false;
    const cursorConfigured = modelsMeta?.cursor?.configured ?? false;
    const groups = modelsMeta?.groups ?? [
      { label: "Fast (recommended)", models: OPENAI_FAST_MODEL_OPTIONS },
      { label: "Cursor (slower)", models: CURSOR_MODEL_OPTIONS },
    ];

    return groups.map((group) => ({
      label: group.label,
      options: group.models.map((model) => {
        let hint: string | undefined;
        if (isOpenAIModelId(model.id) && !openaiConfigured) {
          hint = "Set OPENAI_API_KEY in .env.local";
        } else if (isCursorModelId(model.id) && !cursorConfigured) {
          hint = "Set CURSOR_API_KEY in .env.local";
        }
        return {
          value: model.id,
          label: model.label,
          hint,
        };
      }),
    }));
  }, [modelsMeta]);

  useEffect(() => {
    if (!modelsMeta) return;
    if (!isValidAIModelId(modelId)) {
      const next = modelsMeta.defaultModelId ?? DEFAULT_AI_MODEL_ID;
      setModelIdState(next);
      setStoredAIModelId(next);
    }
  }, [modelsMeta, modelId]);

  const setModelId = useCallback((id: string) => {
    setModelIdState(id);
    setStoredAIModelId(id);
  }, []);

  return { modelId, setModelId, optionGroups };
}
