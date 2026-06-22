"use client";

import { ChevronRight, type LucideIcon } from "lucide-react";
import { FloatingPillSelect } from "@/components/ai/FloatingPillSelect";
import { useAIModelSelectOptions } from "@/components/ai/useAIModelSelectOptions";
import { useAIKeys } from "@/components/ai/useAIKeys";
import { providerForModelId } from "@/lib/aiKeys/modelProvider";
import type { AIKeyProviderId } from "@/lib/aiKeys/types";
import { isCursorModelId, isOpenAIModelId } from "@/lib/aiModels";

type Props = {
  icon: LucideIcon;
  disabled?: boolean;
  menuZClass?: string;
  className?: string;
  truncateLabel?: boolean;
  value?: string;
  onChange?: (value: string) => void;
};

export function AIModelPillSelect({
  icon,
  disabled,
  menuZClass,
  className,
  truncateLabel,
  value: controlledValue,
  onChange: controlledOnChange,
}: Props) {
  const hook = useAIModelSelectOptions();
  const modelId = controlledValue ?? hook.modelId;
  const setModelId = controlledOnChange ?? hook.setModelId;
  const optionGroups = hook.optionGroups;
  const serverConfigured = hook.serverConfigured;

  const { isProviderConfigured, openAddKey, openManageKeys } = useAIKeys();

  const providerConfigured = (provider: AIKeyProviderId) =>
    isProviderConfigured(provider, serverConfigured[provider]);

  return (
    <FloatingPillSelect
      icon={icon}
      label="Model"
      value={modelId}
      disabled={disabled}
      menuZClass={menuZClass}
      className={className}
      truncateLabel={truncateLabel}
      optionGroups={optionGroups}
      onChange={setModelId}
      renderOptionTrailing={(option) => {
        const provider = providerForModelId(option.value);
        if (!provider) return null;
        if (providerConfigured(provider)) return null;
        return (
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-ui-sm text-app-muted hover:bg-app-hover hover:text-app-fg"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              openAddKey(provider);
            }}
          >
            + Add key
          </button>
        );
      }}
      menuFooter={
        <button
          type="button"
          className="editor-menu-dropdown-item w-full !justify-between text-app-muted hover:text-app-fg"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            openManageKeys();
          }}
        >
          <span>Manage keys</span>
          <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2} />
        </button>
      }
    />
  );
}

/** Whether the selected model has any configured key path (local or server). */
export function isSelectedModelReady(
  modelId: string,
  serverConfigured: { openai: boolean; cursor: boolean },
  isProviderConfigured: (provider: AIKeyProviderId, server?: boolean) => boolean,
): boolean {
  if (isOpenAIModelId(modelId)) {
    return isProviderConfigured("openai", serverConfigured.openai);
  }
  if (isCursorModelId(modelId)) {
    return isProviderConfigured("cursor", serverConfigured.cursor);
  }
  return true;
}
