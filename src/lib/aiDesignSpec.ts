import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { AIStyleId, AIGeneratePreview, AIGenerateResult } from "@/lib/aiMockGenerator";
import { designTokensPromptBlock, type ExtractedDesignTokens } from "@/lib/aiDesignTokens";
import { getPalette } from "@/lib/aiMockGenerator";
import { getAIModelById } from "@/lib/aiModels";
import type { ScreenIntent } from "@/lib/aiScreenIntent";
import { intentToRoutedFlow, screenIntentLabel } from "@/lib/aiScreenIntent";
import { filterContextPromptForIntent } from "@/lib/aiGenerateContext";
import type { EditorNode } from "@/stores/useEditorStore";

const ROOT = EDITOR_ROOT_KEY;

export type AIDesignElementSpec = {
  type?: "rectangle" | "text" | "ellipse" | "frame";
  name?: string;
  role?: "status" | "nav" | "hero" | "title" | "subtitle" | "input" | "button" | "card" | "list-item" | "badge" | "icon";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  content?: string;
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  lineHeight?: number;
  textAlign?: "left" | "center" | "right";
  cornerRadius?: number;
  stroke?: string;
};

export type AIDesignSpec = {
  title?: string;
  flowLabel?: string;
  frame?: {
    name?: string;
    width?: number;
    height?: number;
    fill?: string;
    cornerRadius?: number;
  };
  elements?: AIDesignElementSpec[];
};

export type BuildDesignFromLLMOptions = {
  prompt: string;
  preset?: string;
  style: AIStyleId;
  modelId: string;
  contextAttachmentCount?: number;
  tokens?: ExtractedDesignTokens;
  intent?: ScreenIntent;
};

function promptFidelityRules(tokens?: ExtractedDesignTokens): string[] {
  const mobileFrame = tokens
    ? `Default mobile frame unless the user says otherwise: width ${tokens.shellWidth}, height ${tokens.shellHeight}.`
    : "Default mobile frame unless the user says otherwise: width 376, height 812.";

  return [
    "- PROMPT IS LAW: the user request (and reference images, if any) is the ONLY source for screen type, sections, labels, amounts, order, and hierarchy.",
    "- NEVER invent screens, sections, navigation, or copy the user did not ask for.",
    "- NEVER substitute a generic template, cached pattern, Paytm home screen, or prior layout.",
    "- design.md attachments: colors, typography, and spacing ONLY — never use them to pick which screen to build.",
    `- ${mobileFrame}`,
    "- Include every block the user names; do not add home/quick-action/bottom-nav patterns unless explicitly requested.",
    "- Place elements at distinct x,y coordinates with realistic spacing.",
    "- Minimum 20 elements for mobile screens, 28+ for auth/checkout, 35+ for home/dashboard.",
    "- Use role-appropriate typography: hero/title 22–32px bold, body 14px, captions 12px, buttons 16px semibold.",
    "- Inputs: 48px tall rounded rectangles with hairline border; primary buttons: 48–52px tall filled rectangles.",
    "- Cards: white/surface fill, 12–24px corner radius, 16px internal padding implied by text placement.",
  ];
}

function llmQualityRules(intent?: ScreenIntent): string[] {
  if (intent === "dashboard" || intent === "landing") {
    return [
      "- Desktop frame: width 1200–1440, height 800–900 unless user specifies otherwise.",
      "- Include nav bar, hero or header band, at least 3 content cards or metric tiles, and a primary CTA.",
      "- Minimum 24 elements with clear vertical rhythm (24–32px gaps).",
    ];
  }
  if (intent === "auth") {
    return [
      "- Auth layout: logo/brand mark, welcome headline, subtitle, 1–3 input fields, primary CTA, secondary footer link.",
      "- Vertically center the form block; leave 24px horizontal gutter.",
    ];
  }
  return [
    "- Mobile product quality: status bar area, section headers, card groups, list rows with chevrons where appropriate.",
  ];
}

export function buildAIDesignSystemPrompt(
  style: AIStyleId,
  preset?: string,
  tokens?: ExtractedDesignTokens,
  intent?: ScreenIntent,
): string {
  const palette = getPalette(style);
  return [
    "You are a senior product designer generating production-ready mobile and web UI layouts as structured JSON.",
    "Output polished fintech/product screens — not wireframes. Every screen needs hierarchy, spacing, and realistic copy from the user prompt.",
    "Respond with ONLY valid JSON. No markdown fences, no commentary.",
    "",
    "JSON schema:",
    "{",
    '  "title": "short screen name",',
    '  "flowLabel": "one-line screen description",',
    '  "frame": { "name": "Screen", "width": number, "height": number, "fill": "#hex", "cornerRadius": number },',
    '  "elements": [',
    '    { "type": "rectangle" | "text" | "ellipse", "role": "status|nav|hero|title|subtitle|input|button|card|list-item|badge|icon",',
    '      "name": string, "x": number, "y": number, "width": number, "height": number,',
    '      "fill": "#hex", "content": "for text only", "fontSize": number, "fontWeight": number,',
    '      "lineHeight": number, "textAlign": "left|center|right", "cornerRadius": number, "fontFamily": "CSS stack" }',
    "  ]",
    "}",
    "",
    "Rules:",
    "- Coordinates are relative to the frame top-left (0,0). Place every element at explicit x,y — avoid overlapping stacks.",
    "- Every visible label, amount, merchant name, and section title should come from the user prompt when provided.",
    "- Do not invent a different screen type than the user requested.",
    ...promptFidelityRules(tokens),
    ...llmQualityRules(intent),
    tokens ? `- Set fontFamily on every text element to: ${tokens.fontFamily}` : "",
    tokens ? `- Title text: ${tokens.titleSize}px, body: ${tokens.bodySize}px, subtext: ${tokens.subtextSize}px, section headers: ${tokens.sectionHeaderSize}px` : "",
    "- Use rounded cards (cornerRadius 12–24), clear typography hierarchy, 12–16px gutters, 24px section gaps.",
    "- Follow attached design.md tokens when provided — brand colors override defaults.",
    tokens ? designTokensPromptBlock(tokens) : "",
    tokens
      ? ""
      : `- Style palette hints: bg ${palette.bg}, surface ${palette.surface}, primary ${palette.primary}, text ${palette.text}, accent ${palette.accent}.`,
    preset ? `- Screen preset (secondary hint only — user request wins): ${preset}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTargetScreenBlock(
  prompt: string,
  intent: ScreenIntent | undefined,
  hasReferenceImages: boolean,
): string {
  const lines = [
    "STRICT MODE: Build EXACTLY what was asked. No templates. No improvisation.",
  ];

  const trimmed = prompt.trim();
  if (trimmed) {
    lines.push(`AUTHORITATIVE USER REQUEST: ${trimmed}`);
  }

  if (hasReferenceImages) {
    lines.push(
      "REFERENCE IMAGE(S) ATTACHED: replicate screen type, layout, hierarchy, and visible copy 1:1 from the image(s).",
    );
  }

  if (intent && intent !== "generic_mobile" && trimmed) {
    lines.push(`Secondary label (do not override the user request): ${screenIntentLabel(intent)}.`);
  }

  lines.push(
    "FORBIDDEN unless explicitly in the user request: generic home screens, 5-tab bottom nav, quick-actions grids, invented merchants/amounts.",
  );

  return lines.join("\n");
}

export function buildAIDesignUserPrompt(
  prompt: string,
  contextPrompt?: string,
  preset?: string,
  intent?: ScreenIntent,
  hasReferenceImages = false,
): string {
  const filteredContext = contextPrompt?.trim()
    ? filterContextPromptForIntent(contextPrompt.trim(), intent)
    : undefined;

  const parts = [
    buildTargetScreenBlock(prompt, intent, hasReferenceImages),
    prompt.trim() ? `User request: ${prompt.trim()}` : "",
    preset ? `Screen preset: ${preset}` : "",
    filteredContext ? `Attached context:\n${filteredContext}` : "",
  ].filter(Boolean);
  return parts.join("\n\n");
}

function extractJsonObject(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

export function parseAIDesignSpec(raw: string): AIDesignSpec | null {
  const json = extractJsonObject(raw);
  if (!json) return null;
  try {
    const parsed = JSON.parse(json) as AIDesignSpec;
    if (!parsed || typeof parsed !== "object") return null;
    if (!Array.isArray(parsed.elements) || parsed.elements.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

function hexOr(v: unknown, fallback: string): string {
  const s = str(v, "");
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback;
}

export function buildDesignFromLLMSpec(
  spec: AIDesignSpec,
  options: BuildDesignFromLLMOptions,
): AIGenerateResult {
  const palette = getPalette(options.style);
  const flow = options.intent
    ? intentToRoutedFlow(options.intent, options.prompt, options.preset)
    : "mobile";
  const frameId = "ai-llm-frame";
  const frameName = str(spec.frame?.name, "Screen");
  const mobileW = options.tokens?.shellWidth ?? 376;
  const mobileH = options.tokens?.shellHeight ?? 812;
  const frameW = num(spec.frame?.width, flow === "dashboard" || flow === "landing" ? 1200 : mobileW);
  const frameH = num(spec.frame?.height, flow === "dashboard" || flow === "landing" ? 800 : mobileH);
  const textFont = options.tokens?.fontFamily;
  const title = str(spec.title, options.prompt.trim().slice(0, 48) || "AI Screen");

  const nodes: Record<string, EditorNode> = {
    [frameId]: {
      id: frameId,
      parentId: null,
      type: "frame",
      name: frameName,
      x: 80,
      y: 64,
      width: frameW,
      height: frameH,
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
      fill: hexOr(spec.frame?.fill, palette.bg),
      strokeColor: palette.border,
      strokeWidth: 1,
      cornerRadius: num(spec.frame?.cornerRadius, flow === "mobile" || flow === "auth" ? 28 : 12),
    },
  };

  const childIds: string[] = [];

  spec.elements!.forEach((el, i) => {
    const id = `ai-llm-el-${i}`;
    const type = el.type === "text" ? "text" : el.type === "ellipse" ? "ellipse" : "rectangle";
    const base = {
      id,
      parentId: frameId,
      name: str(el.name, type === "text" ? "Label" : "Block"),
      x: num(el.x, 24),
      y: num(el.y, 24 + i * 56),
      width: num(el.width, type === "text" ? 280 : 320),
      height: num(el.height, type === "text" ? 28 : 48),
      rotation: 0,
      visible: true,
      locked: false,
      expanded: true,
    };
    if (type === "text") {
      const role = el.role;
      const defaultSize =
        role === "title" || role === "hero"
          ? options.tokens?.titleSize ?? 22
          : role === "subtitle"
            ? options.tokens?.bodySize ?? 14
            : options.tokens?.bodySize ?? 14;
      const defaultWeight =
        role === "title" || role === "hero" || role === "button" ? 700 : role === "subtitle" ? 400 : 500;
      const defaultColor =
        role === "subtitle"
          ? options.tokens?.muted ?? palette.muted
          : role === "button"
            ? options.tokens?.onPrimary ?? palette.primaryText
            : hexOr(el.fill, palette.text);
      const lineHeightPx = num(el.lineHeight, options.tokens?.bodyLine ?? 20);
      const fontSize = num(el.fontSize, defaultSize);
      nodes[id] = {
        ...base,
        type: "text",
        content: str(el.content, "Label"),
        fill: defaultColor,
        fontSize,
        fontWeight: num(el.fontWeight, defaultWeight),
        fontFamily: str(el.fontFamily, textFont ?? "Inter, system-ui, sans-serif"),
        lineHeight: lineHeightPx / fontSize,
        textAlign: el.textAlign ?? (role === "button" ? "center" : "left"),
      };
    } else if (type === "ellipse") {
      nodes[id] = {
        ...base,
        type: "ellipse",
        fill: hexOr(el.fill, palette.primary),
      };
    } else {
      const role = el.role;
      const isInput = role === "input";
      const isButton = role === "button";
      const isCard = role === "card";
      nodes[id] = {
        ...base,
        type: "rectangle",
        fill: hexOr(
          el.fill,
          isButton
            ? options.tokens?.primaryStrong ?? palette.primary
            : isInput
              ? options.tokens?.canvas ?? palette.surface
              : isCard
                ? options.tokens?.canvas ?? palette.surface
                : i % 3 === 0
                  ? palette.primary
                  : palette.surface,
        ),
        cornerRadius: num(
          el.cornerRadius,
          isButton || isInput ? options.tokens?.radiusControl ?? 8 : isCard ? options.tokens?.radiusCard ?? 16 : 10,
        ),
        strokeColor: el.stroke
          ? hexOr(el.stroke, palette.border)
          : isInput
            ? options.tokens?.hairline ?? palette.border
            : palette.border,
        strokeWidth: isInput || el.stroke ? 1 : 0,
        height: num(el.height, isButton ? 52 : isInput ? 48 : 48),
      };
    }
    childIds.push(id);
  });

  const childOrder: Record<string, string[]> = {
    [ROOT]: [frameId],
    [frameId]: childIds,
  };

  const slice: EditorPersistSlice = wrapPersistSliceWithPages({
    fileName: `${title} · AI`,
    nodes,
    childOrder,
    assets: {},
    designTokens: {},
    selectedIds: [frameId],
    zoom: frameW <= 420 ? 0.62 : 0.52,
    pan: { x: 48, y: 36 },
    showGrid: true,
    showRulers: false,
    canvasBackgroundColor: "#e5e5e5",
    comments: [],
  });

  const modelMeta = getAIModelById(options.modelId);
  const preview: AIGeneratePreview = {
    fileName: slice.fileName,
    frameCount: 1,
    palette: [palette.primary, palette.accent, palette.surface, palette.text],
    flowLabel: str(spec.flowLabel, "AI-generated screen"),
    modelId: options.modelId,
    modelLabel: modelMeta?.label ?? options.modelId,
    contextAttachmentCount: options.contextAttachmentCount,
  };

  return { slice, preview };
}

export function tryBuildDesignFromLLMText(
  raw: string | null | undefined,
  options: BuildDesignFromLLMOptions,
): AIGenerateResult | null {
  if (!raw?.trim()) return null;
  const spec = parseAIDesignSpec(raw);
  if (!spec) return null;
  return buildDesignFromLLMSpec(spec, options);
}
