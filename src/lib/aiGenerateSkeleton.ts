import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import { extractDesignTokens } from "@/lib/aiDesignTokens";
import type { AIGenerateJob } from "@/lib/aiGenerateJob";
import { AI_GENERATE_SKELETON_FRAME_ID } from "@/lib/aiGenerateJob";
import { tryRichGenerate } from "@/lib/aiGenerateFastPath";
import type { AIGenerateResult } from "@/lib/aiMockGenerator";
import { generateDesignFromPrompt } from "@/lib/aiMockGenerator";
import { detectScreenIntent, extractScreenTitle, intentToRoutedFlow } from "@/lib/aiScreenIntent";
import { DEFAULT_CANVAS_BACKGROUND } from "@/lib/canvasVisual";
import type { EditorNode } from "@/stores/useEditorStore";

const ROOT = EDITOR_ROOT_KEY;
const FRAME = AI_GENERATE_SKELETON_FRAME_ID;

export type AIGenerateSkeletonInput = Pick<
  AIGenerateJob,
  "prompt" | "preset" | "style" | "model" | "contextPrompt" | "contextAttachmentCount" | "contextImages"
>;

export type AIGenerateSkeletonFrameBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  title: string;
};

function findRootScreenFrame(slice: EditorPersistSlice): EditorNode | null {
  for (const id of slice.childOrder[ROOT] ?? []) {
    const node = slice.nodes[id];
    if (node?.type === "frame") return node;
  }
  return null;
}

function boundsFromFrameNode(node: EditorNode, title: string): AIGenerateSkeletonFrameBounds {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    cornerRadius: node.cornerRadius ?? 24,
    title,
  };
}

function estimateSkeletonFrameBounds(input: AIGenerateSkeletonInput): AIGenerateSkeletonFrameBounds {
  const intent = detectScreenIntent(input.prompt, input.preset, input.contextPrompt);
  const title = extractScreenTitle(input.prompt, intent);
  const tokens = extractDesignTokens(input.contextPrompt, input.prompt, input.style);
  const flow = intentToRoutedFlow(intent, input.prompt, input.preset);
  const isDesktop = flow === "dashboard" || flow === "landing";

  return {
    x: isDesktop ? 48 : 80,
    y: isDesktop ? 40 : 48,
    width: isDesktop ? 1200 : tokens.shellWidth,
    height: isDesktop ? 800 : tokens.shellHeight,
    cornerRadius: isDesktop ? 12 : tokens.radiusCard,
    title,
  };
}

/** Match the frame size/position of the screen that will be generated. */
export function resolveAIGenerateSkeletonFrame(
  input: AIGenerateSkeletonInput,
): AIGenerateSkeletonFrameBounds {
  const intent = detectScreenIntent(input.prompt, input.preset, input.contextPrompt);
  const title = extractScreenTitle(input.prompt, intent);

  const rich = tryRichGenerate({
    prompt: input.prompt,
    preset: input.preset,
    style: input.style,
    model: input.model,
    contextPrompt: input.contextPrompt,
    contextAttachmentCount: input.contextAttachmentCount,
    contextImages: input.contextImages,
  });
  if (rich?.ok && rich.result?.slice) {
    const frame = findRootScreenFrame(rich.result.slice);
    if (frame) return boundsFromFrameNode(frame, title);
  }

  const flow = intentToRoutedFlow(intent, input.prompt, input.preset);
  const mock = generateDesignFromPrompt(input.prompt, {
    preset: input.preset,
    style: input.style,
    model: input.model,
    contextPrompt: input.contextPrompt,
    contextAttachmentCount: input.contextAttachmentCount,
    forcedFlow: flow,
    detectedIntent: title,
  });
  const mockFrame = findRootScreenFrame(mock.slice);
  if (mockFrame) return boundsFromFrameNode(mockFrame, title);

  return estimateSkeletonFrameBounds(input);
}

/** Placeholder frame on canvas while AI generation runs — matches target screen bounds. */
export function buildAIGenerateSkeletonSlice(input: AIGenerateSkeletonInput): AIGenerateResult {
  const bounds = resolveAIGenerateSkeletonFrame(input);
  const title = bounds.title.trim().slice(0, 40) || "Generating screen";

  const nodes: Record<string, EditorNode> = {
    [FRAME]: {
      id: FRAME,
      parentId: ROOT,
      type: "frame",
      name: title,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fillEnabled: false,
      fill: "#ffffff",
      cornerRadius: bounds.cornerRadius,
      strokeColor: "#d4d4d8",
      strokeWidth: 1,
      clipChildren: false,
    },
  };

  const childOrder: Record<string, string[]> = {
    [ROOT]: [FRAME],
    [FRAME]: [],
  };

  const slice: EditorPersistSlice = wrapPersistSliceWithPages({
    fileName: `${title} · Generating`,
    nodes,
    childOrder,
    assets: {},
    designTokens: {},
    selectedIds: [FRAME],
    zoom: 0.65,
    pan: { x: 56, y: 40 },
    showGrid: false,
    showRulers: false,
    canvasBackgroundColor: DEFAULT_CANVAS_BACKGROUND,
    comments: [],
  });

  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: 1,
      palette: ["#d4d4d8"],
      flowLabel: "Generating…",
      generationSource: "rich",
    },
  };
}
