import {
  AI_MODEL_OPTIONS,
  DEFAULT_AI_MODEL_ID,
  OLLAMA_MODEL_OPTIONS,
  aiModelSelectGroups,
  ollamaTagFromModelId,
} from "@/lib/aiModels";
import { fetchOllamaTags, isOllamaReachable, ollamaTagInstalled } from "@/lib/ollamaClient";
import { isOpenAIConfigured } from "@/lib/openaiGenerate";

export async function GET() {
  const [ollamaReachable, installedTags] = await Promise.all([isOllamaReachable(), fetchOllamaTags()]);

  const ollamaAvailability = Object.fromEntries(
    OLLAMA_MODEL_OPTIONS.map((m) => {
      const tag = ollamaTagFromModelId(m.id);
      return [m.id, tag ? ollamaTagInstalled(installedTags, tag) : false];
    }),
  );

  return Response.json({
    defaultModelId: DEFAULT_AI_MODEL_ID,
    models: AI_MODEL_OPTIONS,
    groups: aiModelSelectGroups(),
    ollama: {
      reachable: ollamaReachable,
      installedTags,
      availability: ollamaAvailability,
    },
    openai: {
      configured: isOpenAIConfigured(),
    },
  });
}
