import { OPENAI_MODEL_OPTIONS, DEFAULT_OPENAI_MODEL_ID } from "@/lib/openaiModels";

export async function GET() {
  return Response.json({
    defaultModelId: DEFAULT_OPENAI_MODEL_ID,
    models: OPENAI_MODEL_OPTIONS,
  });
}
