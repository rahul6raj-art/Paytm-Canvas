import { aiModelSelectGroups } from "@/lib/aiModels";
import { resolveDefaultAIModelId } from "@/lib/aiDefaults";
import { fetchCursorModelOptions, isCursorConfigured } from "@/lib/cursorModels";
import { isOpenAIConfigured } from "@/lib/openaiGenerate";

export async function GET() {
  const cursorModels = await fetchCursorModelOptions();

  return Response.json({
    defaultModelId: resolveDefaultAIModelId(),
    groups: aiModelSelectGroups(cursorModels),
    openai: {
      configured: isOpenAIConfigured(),
    },
    cursor: {
      configured: isCursorConfigured(),
    },
  });
}
