"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CURSOR_MODEL_OPTIONS,
  DEFAULT_AI_MODEL_ID,
  isValidAIModelId,
  OPENAI_FAST_MODEL_OPTIONS,
  getStoredAIModelId,
  setStoredAIModelId,
} from "@/lib/aiModels";
import type { PillSelectGroup } from "@/components/ai/FloatingPillSelect";
import { useAIKeys } from "@/components/ai/useAIKeys";
import { providerForModelId } from "@/lib/aiKeys/modelProvider";
import type { AIKeyProviderId } from "@/lib/aiKeys/types";

type ModelsApiResponse = {
  defaultModelId?: string;
  openai?: { configured: boolean };
  cursor?: { configured: boolean };
  groups?: { label: string; models: { id: string; label: string; description: string }[] }[];
};

export function useAIModelSelectOptions() {
  const { version, isProviderConfigured } = useAIKeys();
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

  const serverConfigured = useMemo(
    () => ({
      openai: modelsMeta?.openai?.configured ?? false,
      cursor: modelsMeta?.cursor?.configured ?? false,
      anthropic: false,
    }),
    [modelsMeta],
  );

  const providerReady = useCallback(
    (provider: AIKeyProviderId) =>
      isProviderConfigured(provider, serverConfigured[provider]),
    [isProviderConfigured, serverConfigured, version],
  );

  const optionGroups = useMemo((): PillSelectGroup[] => {
    void version;
    const groups = modelsMeta?.groups ?? [
      { label: "Fast (recommended)", models: OPENAI_FAST_MODEL_OPTIONS },
      { label: "Cursor (slower)", models: CURSOR_MODEL_OPTIONS },
    ];

    return groups.map((group) => ({
      label: group.label,
      options: group.models.map((model) => {
        const provider = providerForModelId(model.id);
        let hint: string | undefined;
        if (provider && !providerReady(provider)) {
          hint = "Add key to use this model";
        }
        return {
          value: model.id,
          label: model.label,
          hint,
        };
      }),
    }));
  }, [modelsMeta, providerReady, version]);

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

  return { modelId, setModelId, optionGroups, serverConfigured, modelsMeta };
}
