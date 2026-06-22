import type { AIKeyProviderDef, AIKeyProviderId } from "@/lib/aiKeys/types";

export const AI_KEY_PROVIDERS: AIKeyProviderDef[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "GPT-4o Mini, GPT-5.4 Nano, and other fast chat models.",
    placeholder: "sk-…",
    getKeyUrl: "https://platform.openai.com/api-keys",
    envVar: "OPENAI_API_KEY",
  },
  {
    id: "cursor",
    label: "Cursor",
    description: "Composer, Opus, Sonnet, and other Cursor cloud agents.",
    placeholder: "cursor_…",
    getKeyUrl: "https://cursor.com/dashboard/integrations",
    envVar: "CURSOR_API_KEY",
  },
  {
    id: "anthropic",
    label: "Anthropic (Claude)",
    description: "Claude models — coming soon to canvas generation.",
    placeholder: "sk-ant-…",
    getKeyUrl: "https://console.anthropic.com/settings/keys",
    envVar: "ANTHROPIC_API_KEY",
  },
];

export function aiKeyProvider(id: AIKeyProviderId): AIKeyProviderDef {
  return AI_KEY_PROVIDERS.find((p) => p.id === id) ?? AI_KEY_PROVIDERS[0]!;
}
