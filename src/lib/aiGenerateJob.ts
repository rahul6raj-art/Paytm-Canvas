import type { AIContextImagePayload } from "@/lib/aiContextImages";
import type { AIStyleId } from "@/lib/aiMockGenerator";

export type AIGenerateJob = {
  id: number;
  prompt: string;
  preset?: string;
  style: AIStyleId;
  model: string;
  contextPrompt?: string;
  contextAttachmentCount?: number;
  contextImages?: AIContextImagePayload[];
  source: "dashboard" | "editor";
  initialStep: string;
  queuedAt: number;
};

export type AIGenerateFailedJob = Omit<AIGenerateJob, "id" | "initialStep" | "queuedAt">;

/** Minimum time the skeleton placeholder stays visible before the final screen replaces it. */
export const AI_GENERATE_MIN_SKELETON_MS = 4_500;

/** Root frame id for the in-canvas loading placeholder. */
export const AI_GENERATE_SKELETON_FRAME_ID = "ai-gen-skeleton-frame";
