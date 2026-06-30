import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { AIContextImagePayload } from "@/lib/aiContextImages";
import type { ResolvedAIApiKeys } from "@/lib/aiKeys/types";
import { resolveClientAIApiKeys } from "@/lib/aiKeys/storage";
import { DEFAULT_AI_MODEL_ID, getAIModelById } from "@/lib/aiModels";
import { tryRichGenerate } from "@/lib/aiGenerateFastPath";
import type { EditorNode } from "@/stores/useEditorStore";

const ROOT = EDITOR_ROOT_KEY;

export type AIStyleId = "minimal" | "bold" | "fintech" | "dark" | "playful";

export interface AIGenerateOptions {
  /** Extra hint merged into routing (e.g. preset chip label). */
  preset?: string;
  style: AIStyleId;
  /** Model id (`ollama:…` local or OpenAI id — see `aiModels.ts`). */
  model?: string;
  /** Merged prompt text from attached context files. */
  contextPrompt?: string;
  /** Number of ready context attachments (for preview). */
  contextAttachmentCount?: number;
  /** Force a template flow (skips routing that reads design.md). */
  forcedFlow?: AIRoutedFlow;
  /** Human-readable detected screen intent for preview. */
  detectedIntent?: string;
  /** Base64 reference images for OpenAI vision. */
  contextImages?: AIContextImagePayload[];
  /** Device-local API keys forwarded to the generate API. */
  apiKeys?: ResolvedAIApiKeys;
}

export interface AIGeneratePreview {
  fileName: string;
  frameCount: number;
  palette: string[];
  flowLabel: string;
  modelId?: string;
  modelLabel?: string;
  contextAttachmentCount?: number;
  /** Whether layout came from an LLM, rich engine, or local template fallback. */
  generationSource?: "llm" | "mock" | "rich";
  /** Screen type detected from prompt + Screen preset. */
  detectedIntent?: string;
  warning?: string;
}

export type AIRoutedFlow = "auth" | "dashboard" | "checkout" | "landing" | "profile" | "mobile";

const FLOW_LABELS: Record<AIRoutedFlow, string> = {
  auth: "Mobile auth / onboarding",
  dashboard: "Dashboard & metrics",
  checkout: "Checkout & payments",
  landing: "Marketing landing",
  profile: "Profile & settings",
  mobile: "Mobile app screen",
};

export interface AIGenerateResult {
  slice: EditorPersistSlice;
  preview: AIGeneratePreview;
}

interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
  accent: string;
  border: string;
}

export function getPalette(style: AIStyleId): Palette {
  switch (style) {
    case "bold":
      return {
        bg: "#0f172a",
        surface: "#1e293b",
        surface2: "#334155",
        text: "#f8fafc",
        muted: "#94a3b8",
        primary: "#f97316",
        primaryText: "#0f172a",
        accent: "#eab308",
        border: "#334155",
      };
    case "fintech":
      return {
        bg: "#f0fdf4",
        surface: "#ffffff",
        surface2: "#dcfce7",
        text: "#052e16",
        muted: "#166534",
        primary: "#0d99ff",
        primaryText: "#ffffff",
        accent: "#22c55e",
        border: "#bbf7d0",
      };
    case "dark":
      return {
        bg: "#09090b",
        surface: "#18181b",
        surface2: "#27272a",
        text: "#fafafa",
        muted: "#a1a1aa",
        primary: "#a855f7",
        primaryText: "#fafafa",
        accent: "#38bdf8",
        border: "#3f3f46",
      };
    case "playful":
      return {
        bg: "#fff7ed",
        surface: "#ffffff",
        surface2: "#ffedd5",
        text: "#431407",
        muted: "#9a3412",
        primary: "#ec4899",
        primaryText: "#ffffff",
        accent: "#8b5cf6",
        border: "#fed7aa",
      };
    case "minimal":
    default:
      return {
        bg: "#fafafa",
        surface: "#ffffff",
        surface2: "#f4f4f5",
        text: "#18181b",
        muted: "#71717a",
        primary: "#18181b",
        primaryText: "#fafafa",
        accent: "#0d99ff",
        border: "#e4e4e7",
      };
  }
}

export function routeFlowFromPrompt(prompt: string, preset?: string): AIRoutedFlow {
  const t = `${prompt} ${preset ?? ""}`.toLowerCase();
  if (/(login|sign\s*up|signup|sign-in|signin|onboarding|otp|verify)/.test(t)) return "auth";
  if (/(dashboard|analytics|metrics|kpi|chart|report)/.test(t)) return "dashboard";
  if (/(payment|checkout|wallet|upi|pay|cart|order summary)/.test(t)) return "checkout";
  if (/(landing|website|hero|marketing|saas)/.test(t)) return "landing";
  if (/(settings|profile|account|preferences|edit profile)/.test(t)) return "profile";
  if (/(mobile|ios|android|app screen)/.test(t)) return "mobile";
  return "mobile";
}

function nf(
  id: string,
  parentId: string | null,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  p: Partial<Pick<EditorNode, "fill" | "cornerRadius" | "strokeColor" | "strokeWidth">>,
): EditorNode {
  return {
    id,
    parentId,
    type: "frame",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: p.fill ?? "#ffffff",
    strokeColor: p.strokeColor ?? "#e4e4e7",
    strokeWidth: p.strokeWidth ?? 1,
    cornerRadius: p.cornerRadius ?? 0,
  };
}

function nr(
  id: string,
  parentId: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  radius = 10,
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill,
    cornerRadius: radius,
  };
}

function nt(
  id: string,
  parentId: string,
  name: string,
  x: number,
  y: number,
  w: number,
  h: number,
  content: string,
  opts?: Partial<Pick<EditorNode, "fontSize" | "fontWeight" | "fill" | "textColor">>,
): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content,
    fill: opts?.fill ?? opts?.textColor ?? "#0f172a",
    fontSize: opts?.fontSize ?? 15,
    fontWeight: opts?.fontWeight ?? 500,
  };
}

function makeSlice(
  fileName: string,
  nodes: Record<string, EditorNode>,
  childOrder: Record<string, string[]>,
  selectedIds: string[],
): EditorPersistSlice {
  return wrapPersistSliceWithPages({
    fileName,
    nodes,
    childOrder,
    assets: {},
    designTokens: {},
    selectedIds,
    zoom: 0.52,
    pan: { x: 48, y: 36 },
    showGrid: true,
    showRulers: false,
    canvasBackgroundColor: "#e5e5e5",
    comments: [],
  });
}

function countFrames(nodes: Record<string, EditorNode>): number {
  return Object.values(nodes).filter((n) => n.type === "frame").length;
}

function buildAuth(p: Palette, name: string): AIGenerateResult {
  const f = "ai-auth-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: nf(f, null, name, 100, 64, 390, 780, { fill: p.bg, cornerRadius: 32, strokeColor: p.border }),
    "ai-auth-bar": nr("ai-auth-bar", f, "Status", 0, 0, 390, 48, p.surface2, 0),
    "ai-auth-logo": nr("ai-auth-logo", f, "Logo", 24, 72, 40, 40, p.primary, 12),
    "ai-auth-title": nt("ai-auth-title", f, "Title", 24, 132, 320, 36, "Welcome back", { fontSize: 22, fontWeight: 700, fill: p.text }),
    "ai-auth-sub": nt("ai-auth-sub", f, "Subtitle", 24, 176, 320, 40, "Sign in to continue to Paytm Craft", { fontSize: 13, fill: p.muted }),
    "ai-auth-field1": nr("ai-auth-field1", f, "Phone field", 24, 240, 342, 48, p.surface, 10),
    "ai-auth-ph1": nt("ai-auth-ph1", f, "Placeholder", 36, 252, 200, 24, "Mobile number", { fontSize: 14, fill: p.muted }),
    "ai-auth-field2": nr("ai-auth-field2", f, "OTP field", 24, 304, 342, 48, p.surface, 10),
    "ai-auth-ph2": nt("ai-auth-ph2", f, "Placeholder", 36, 316, 120, 24, "Enter OTP", { fontSize: 14, fill: p.muted }),
    "ai-auth-btn": nr("ai-auth-btn", f, "Primary button", 24, 392, 342, 52, p.primary, 12),
    "ai-auth-btn-t": nt("ai-auth-btn-t", f, "Button label", 120, 406, 200, 24, "Continue", { fontSize: 16, fontWeight: 600, fill: p.primaryText }),
    "ai-auth-link": nt("ai-auth-link", f, "Link", 24, 464, 320, 24, "New user? Create account", { fontSize: 13, fill: p.accent }),
  };
  const co: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: [
      "ai-auth-bar",
      "ai-auth-logo",
      "ai-auth-title",
      "ai-auth-sub",
      "ai-auth-field1",
      "ai-auth-ph1",
      "ai-auth-field2",
      "ai-auth-ph2",
      "ai-auth-btn",
      "ai-auth-btn-t",
      "ai-auth-link",
    ],
  };
  const slice = makeSlice(`${name} · AI`, nodes, co, [f]);
  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: countFrames(nodes),
      palette: [p.primary, p.accent, p.surface, p.text],
      flowLabel: FLOW_LABELS.auth,
    },
  };
}

function buildDashboard(p: Palette, name: string): AIGenerateResult {
  const f = "ai-dash-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: nf(f, null, name, 48, 40, 1200, 800, { fill: p.bg, cornerRadius: 12, strokeColor: p.border }),
    "ai-d-side": nr("ai-d-side", f, "Sidebar", 0, 0, 220, 800, p.surface, 0),
    "ai-d-nav1": nt("ai-d-nav1", f, "Nav Home", 24, 80, 160, 22, "Overview", { fontSize: 13, fill: p.text }),
    "ai-d-nav2": nt("ai-d-nav2", f, "Nav Analytics", 24, 112, 160, 22, "Analytics", { fontSize: 13, fill: p.muted }),
    "ai-d-top": nr("ai-d-top", f, "Top bar", 220, 0, 980, 56, p.surface, 0),
    "ai-d-title": nt("ai-d-title", f, "Page title", 248, 16, 400, 28, "Performance", { fontSize: 18, fontWeight: 700, fill: p.text }),
    "ai-d-w1": nr("ai-d-w1", f, "Metric card", 248, 88, 300, 140, p.surface2, 12),
    "ai-d-m1": nt("ai-d-m1", f, "Metric", 268, 108, 200, 32, "₹12.4L", { fontSize: 24, fontWeight: 700, fill: p.text }),
    "ai-d-w2": nr("ai-d-w2", f, "Metric card", 572, 88, 300, 140, p.surface2, 12),
    "ai-d-m2": nt("ai-d-m2", f, "Metric", 592, 108, 200, 32, "+18%", { fontSize: 24, fontWeight: 700, fill: p.accent }),
    "ai-d-chart": nr("ai-d-chart", f, "Chart area", 248, 252, 932, 420, p.surface, 12),
    "ai-d-chart-l": nt("ai-d-chart-l", f, "Chart label", 272, 280, 300, 24, "Transactions over time", { fontSize: 13, fill: p.muted }),
  };
  const co: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: [
      "ai-d-side",
      "ai-d-nav1",
      "ai-d-nav2",
      "ai-d-top",
      "ai-d-title",
      "ai-d-w1",
      "ai-d-m1",
      "ai-d-w2",
      "ai-d-m2",
      "ai-d-chart",
      "ai-d-chart-l",
    ],
  };
  const slice = makeSlice(`${name} · AI`, nodes, co, [f]);
  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: countFrames(nodes),
      palette: [p.primary, p.accent, p.surface, p.text],
      flowLabel: FLOW_LABELS.dashboard,
    },
  };
}

function buildCheckout(p: Palette, name: string): AIGenerateResult {
  const f = "ai-pay-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: nf(f, null, name, 120, 80, 420, 720, { fill: p.surface, cornerRadius: 20, strokeColor: p.border }),
    "ai-p-step": nt("ai-p-step", f, "Steps", 32, 28, 360, 24, "Cart  →  Pay  →  Done", { fontSize: 12, fill: p.muted }),
    "ai-p-sum": nr("ai-p-sum", f, "Summary card", 32, 72, 356, 200, p.surface2, 12),
    "ai-p-line1": nt("ai-p-line1", f, "Row", 48, 92, 300, 20, "Subtotal", { fontSize: 13, fill: p.muted }),
    "ai-p-line2": nt("ai-p-line2", f, "Row", 48, 124, 300, 20, "UPI discount", { fontSize: 13, fill: p.muted }),
    "ai-p-total": nt("ai-p-total", f, "Total", 48, 220, 300, 28, "Pay ₹1,249", { fontSize: 20, fontWeight: 700, fill: p.text }),
    "ai-p-upi": nr("ai-p-upi", f, "UPI tile", 32, 300, 356, 64, p.bg, 12),
    "ai-p-upi-t": nt("ai-p-upi-t", f, "UPI label", 48, 320, 300, 24, "Paytm UPI", { fontSize: 14, fontWeight: 600, fill: p.text }),
    "ai-p-btn": nr("ai-p-btn", f, "Pay button", 32, 420, 356, 52, p.primary, 12),
    "ai-p-btn-t": nt("ai-p-btn-t", f, "Pay label", 160, 434, 120, 24, "Pay now", { fontSize: 16, fontWeight: 700, fill: p.primaryText }),
  };
  const co: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["ai-p-step", "ai-p-sum", "ai-p-line1", "ai-p-line2", "ai-p-total", "ai-p-upi", "ai-p-upi-t", "ai-p-btn", "ai-p-btn-t"],
  };
  const slice = makeSlice(`${name} · AI`, nodes, co, [f]);
  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: countFrames(nodes),
      palette: [p.primary, p.accent, p.surface, p.text],
      flowLabel: FLOW_LABELS.checkout,
    },
  };
}

function buildLanding(p: Palette, name: string): AIGenerateResult {
  const f = "ai-land-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: nf(f, null, name, 40, 36, 1280, 900, { fill: p.bg, cornerRadius: 0, strokeColor: p.border }),
    "ai-l-nav": nr("ai-l-nav", f, "Nav", 0, 0, 1280, 72, p.surface, 0),
    "ai-l-brand": nt("ai-l-brand", f, "Brand", 48, 24, 200, 28, "Paytm Craft", { fontSize: 18, fontWeight: 700, fill: p.text }),
    "ai-l-hero": nr("ai-l-hero", f, "Hero", 80, 120, 1120, 380, p.surface2, 20),
    "ai-l-h1": nt("ai-l-h1", f, "Headline", 120, 200, 800, 120, "Payments that feel instant.", { fontSize: 40, fontWeight: 800, fill: p.text }),
    "ai-l-cta": nr("ai-l-cta", f, "CTA", 120, 360, 180, 48, p.primary, 10),
    "ai-l-cta-t": nt("ai-l-cta-t", f, "CTA text", 150, 372, 140, 24, "Get started", { fontSize: 15, fontWeight: 700, fill: p.primaryText }),
    "ai-l-row": nr("ai-l-row", f, "Feature strip", 80, 540, 1120, 160, p.surface, 12),
    "ai-l-ft": nr("ai-l-ft", f, "Footer", 0, 820, 1280, 80, p.surface, 0),
  };
  const co: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["ai-l-nav", "ai-l-brand", "ai-l-hero", "ai-l-h1", "ai-l-cta", "ai-l-cta-t", "ai-l-row", "ai-l-ft"],
  };
  const slice = makeSlice(`${name} · AI`, nodes, co, [f]);
  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: countFrames(nodes),
      palette: [p.primary, p.accent, p.surface2, p.text],
      flowLabel: FLOW_LABELS.landing,
    },
  };
}

function buildProfile(p: Palette, name: string): AIGenerateResult {
  const f = "ai-prof-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: nf(f, null, name, 100, 60, 390, 780, { fill: p.bg, cornerRadius: 28, strokeColor: p.border }),
    "ai-pr-head": nr("ai-pr-head", f, "Header", 0, 0, 390, 56, p.surface, 0),
    "ai-pr-t": nt("ai-pr-t", f, "Title", 20, 16, 200, 28, "Account", { fontSize: 17, fontWeight: 700, fill: p.text }),
    "ai-pr-av": nr("ai-pr-av", f, "Avatar", 155, 88, 80, 80, p.surface2, 40),
    "ai-pr-name": nt("ai-pr-name", f, "Name", 24, 188, 340, 28, "Craft Demo User", { fontSize: 20, fontWeight: 700, fill: p.text }),
    "ai-pr-row1": nr("ai-pr-row1", f, "Settings row", 16, 240, 358, 56, p.surface, 10),
    "ai-pr-r1t": nt("ai-pr-r1t", f, "Row label", 32, 256, 200, 24, "Notifications", { fontSize: 14, fill: p.text }),
    "ai-pr-row2": nr("ai-pr-row2", f, "Settings row", 16, 308, 358, 56, p.surface, 10),
    "ai-pr-r2t": nt("ai-pr-r2t", f, "Row label", 32, 324, 200, 24, "Security", { fontSize: 14, fill: p.text }),
    "ai-pr-row3": nr("ai-pr-row3", f, "Settings row", 16, 376, 358, 56, p.surface, 10),
    "ai-pr-r3t": nt("ai-pr-r3t", f, "Row label", 32, 392, 200, 24, "Payment methods", { fontSize: 14, fill: p.text }),
  };
  const co: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["ai-pr-head", "ai-pr-t", "ai-pr-av", "ai-pr-name", "ai-pr-row1", "ai-pr-r1t", "ai-pr-row2", "ai-pr-r2t", "ai-pr-row3", "ai-pr-r3t"],
  };
  const slice = makeSlice(`${name} · AI`, nodes, co, [f]);
  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: countFrames(nodes),
      palette: [p.primary, p.accent, p.surface, p.text],
      flowLabel: FLOW_LABELS.profile,
    },
  };
}

function buildMobile(p: Palette, name: string): AIGenerateResult {
  const f = "ai-mob-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: nf(f, null, name, 100, 56, 390, 800, { fill: p.surface, cornerRadius: 28, strokeColor: p.border }),
    "ai-m-st": nr("ai-m-st", f, "Status", 0, 0, 390, 44, p.surface2, 0),
    "ai-m-h": nt("ai-m-h", f, "Greeting", 24, 64, 320, 32, "Hello, Rahul", { fontSize: 22, fontWeight: 700, fill: p.text }),
    "ai-m-card": nr("ai-m-card", f, "Primary card", 20, 120, 350, 160, p.surface2, 14),
    "ai-m-c1": nt("ai-m-c1", f, "Card title", 36, 140, 280, 24, "Quick actions", { fontSize: 15, fontWeight: 600, fill: p.text }),
    "ai-m-c2": nt("ai-m-c2", f, "Card body", 36, 172, 300, 40, "Send money, pay bills, recharge.", { fontSize: 13, fill: p.muted }),
    "ai-m-btn": nr("ai-m-btn", f, "Button", 36, 220, 140, 40, p.primary, 10),
    "ai-m-bt": nt("ai-m-bt", f, "Button text", 68, 230, 120, 22, "Explore", { fontSize: 14, fontWeight: 600, fill: p.primaryText }),
    "ai-m-list": nr("ai-m-list", f, "List area", 20, 320, 350, 200, p.bg, 12),
    "ai-m-li1": nt("ai-m-li1", f, "List item", 36, 340, 300, 22, "Recent payees", { fontSize: 14, fontWeight: 600, fill: p.text }),
    "ai-m-tab": nr("ai-m-tab", f, "Tab bar", 0, 736, 390, 64, p.surface2, 0),
  };
  const co: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["ai-m-st", "ai-m-h", "ai-m-card", "ai-m-c1", "ai-m-c2", "ai-m-btn", "ai-m-bt", "ai-m-list", "ai-m-li1", "ai-m-tab"],
  };
  const slice = makeSlice(`${name} · AI`, nodes, co, [f]);
  return {
    slice,
    preview: {
      fileName: slice.fileName,
      frameCount: countFrames(nodes),
      palette: [p.primary, p.accent, p.surface2, p.text],
      flowLabel: FLOW_LABELS.mobile,
    },
  };
}

function titleFromPrompt(prompt: string, flow: AIRoutedFlow): string {
  const t = prompt.trim();
  if (t.length > 0 && t.length <= 48) return t;
  switch (flow) {
    case "auth":
      return "AI — Sign in";
    case "dashboard":
      return "AI — Dashboard";
    case "checkout":
      return "AI — Checkout";
    case "landing":
      return "AI — Landing";
    case "profile":
      return "AI — Profile";
    default:
      return "AI — Mobile screen";
  }
}

function withModelPreview(result: AIGenerateResult, modelId: string): AIGenerateResult {
  const meta = getAIModelById(modelId);
  return {
    ...result,
    preview: {
      ...result.preview,
      modelId,
      modelLabel: meta?.label ?? modelId,
    },
  };
}

function effectivePrompt(prompt: string, options: AIGenerateOptions): string {
  const ctx = options.contextPrompt?.trim();
  if (!ctx) return prompt;
  const trimmed = prompt.trim();
  if (!trimmed) return ctx;
  return `${trimmed}\n\n--- Attached context ---\n${ctx}`;
}

export function generateDesignFromPrompt(prompt: string, options: AIGenerateOptions): AIGenerateResult {
  const flow = options.forcedFlow ?? routeFlowFromPrompt(prompt, options.preset);
  const palette = getPalette(options.style);
  const name = titleFromPrompt(prompt.trim() || options.contextPrompt || "Screen", flow);
  const modelId = options.model ?? DEFAULT_AI_MODEL_ID;
  let result: AIGenerateResult;
  switch (flow) {
    case "auth":
      result = buildAuth(palette, name);
      break;
    case "dashboard":
      result = buildDashboard(palette, name);
      break;
    case "checkout":
      result = buildCheckout(palette, name);
      break;
    case "landing":
      result = buildLanding(palette, name);
      break;
    case "profile":
      result = buildProfile(palette, name);
      break;
    case "mobile":
    default:
      result = buildMobile(palette, name);
      break;
  }
  const withModel = withModelPreview(result, modelId);
  const preview: AIGeneratePreview = {
    ...withModel.preview,
    ...(options.contextAttachmentCount
      ? { contextAttachmentCount: options.contextAttachmentCount }
      : {}),
    ...(options.detectedIntent ? { detectedIntent: options.detectedIntent } : {}),
  };
  return { ...withModel, preview };
}

export type AIGenerateAsyncMeta = {
  source: "llm" | "mock" | "rich";
  warning?: string;
};

export async function generateDesignFromPromptAsync(
  prompt: string,
  options: AIGenerateOptions,
): Promise<AIGenerateResult & { meta?: AIGenerateAsyncMeta }> {
  const model = options.model ?? DEFAULT_AI_MODEL_ID;

  const local = tryRichGenerate({
    prompt,
    preset: options.preset,
    style: options.style,
    model,
    contextPrompt: options.contextPrompt,
    contextAttachmentCount: options.contextAttachmentCount,
    contextImages: options.contextImages,
  });
  if (local?.ok && local.result?.slice && local.result.preview) {
    return {
      ...local.result,
      preview: {
        ...local.result.preview,
        generationSource: "rich",
        detectedIntent: local.detectedIntent ?? local.result.preview.detectedIntent,
      },
      meta: { source: "rich" },
    };
  }

  try {
    const res = await fetch("/api/v1/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        preset: options.preset,
        style: options.style,
        model,
        contextPrompt: options.contextPrompt,
        contextAttachmentCount: options.contextAttachmentCount,
        contextImages: options.contextImages,
        apiKeys: options.apiKeys ?? resolveClientAIApiKeys(),
      }),
      signal: AbortSignal.timeout(120_000),
    });
    const raw = await res.text();
    let data: {
      result?: AIGenerateResult;
      source?: "llm" | "mock" | "rich";
      detectedIntent?: string;
      warning?: string;
      error?: string;
    };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      /* fall through to local mock */
      data = {};
    }
    if (res.ok && data.result?.slice && data.result.preview) {
      return {
        ...data.result,
        preview: {
          ...data.result.preview,
          generationSource: data.source ?? "llm",
          detectedIntent: data.detectedIntent ?? data.result.preview.detectedIntent,
          warning: data.warning,
        },
        meta: { source: data.source ?? "llm", warning: data.warning },
      };
    }
    const message =
      data.error ??
      (res.ok ? "Generation failed — no layout returned." : `AI server error (${res.status}).`);
    throw new Error(message);
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("Could not reach the AI server.");
  }
}
