import { AI_MODEL_OPTIONS, DEFAULT_AI_MODEL_ID, aiModelSelectGroups } from "@/lib/aiModels";

export async function GET() {
  return Response.json({
    defaultModelId: DEFAULT_AI_MODEL_ID,
    models: AI_MODEL_OPTIONS,
    groups: aiModelSelectGroups(),
  });
}
