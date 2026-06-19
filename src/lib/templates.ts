import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorPersistSlice } from "@/lib/documentPersistence";
import { wrapPersistSliceWithPages } from "@/lib/documentPersistence";
import type { EditorNode } from "@/stores/useEditorStore";
import { buildPaletteTokens } from "@/lib/designSystemPresets";

const ROOT = EDITOR_ROOT_KEY;

export interface TemplateGalleryItem {
  id: string;
  title: string;
  description: string;
  /** CSS background for card preview */
  accent: string;
}

export const TEMPLATE_GALLERY: TemplateGalleryItem[] = [
  {
    id: "mobile-app-screen",
    title: "Mobile app screen",
    description: "Phone frame with header, body, and tab bar",
    accent: "linear-gradient(135deg,#0ea5e9 0%,#6366f1 100%)",
  },
  {
    id: "landing-page",
    title: "Landing page",
    description: "Hero, features row, and footer band",
    accent: "linear-gradient(135deg,#f97316 0%,#ec4899 100%)",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    description: "Sidebar + top bar + widget cards",
    accent: "linear-gradient(135deg,#22c55e 0%,#14b8a6 100%)",
  },
  {
    id: "checkout-flow",
    title: "Checkout flow",
    description: "Steps indicator and payment summary",
    accent: "linear-gradient(135deg,#a855f7 0%,#0d99ff 100%)",
  },
  {
    id: "design-system-starter",
    title: "Design system starter",
    description: "Typography + color chips artboard",
    accent: "linear-gradient(135deg,#64748b 0%,#0f172a 100%)",
  },
  {
    id: "wireframe-kit",
    title: "Wireframe kit",
    description: "Low-fidelity blocks and placeholders",
    accent: "linear-gradient(135deg,#94a3b8 0%,#cbd5e1 100%)",
  },
];

export type DashboardMockKind = "recent" | "draft" | "team";

export type DashboardFileBadge = "draft" | "team" | "template";

export interface DashboardMockFile {
  id: string;
  name: string;
  lastEditedLabel: string;
  ownerName: string;
  ownerInitials: string;
  templateId: string;
  accent: string;
  kind: DashboardMockKind;
  workspaceId: string;
  workspaceName: string;
  fileBadge: DashboardFileBadge;
  /** Shared collaborators (excluding owner initials on card if desired) */
  sharedInitials: string[];
}

export const DASHBOARD_MOCK_FILES: DashboardMockFile[] = [
  {
    id: "mf-1",
    name: "Mobile App Flow",
    lastEditedLabel: "2 hours ago",
    ownerName: "Aisha Khan",
    ownerInitials: "AK",
    templateId: "mobile-app-screen",
    accent: "linear-gradient(135deg,#0ea5e9,#6366f1)",
    kind: "recent",
    workspaceId: "ws-paytm-design",
    workspaceName: "Paytm Design",
    fileBadge: "team",
    sharedInitials: ["RV", "DS", "MN"],
  },
  {
    id: "mf-2",
    name: "Website Landing Page",
    lastEditedLabel: "Yesterday",
    ownerName: "Dev Sharma",
    ownerInitials: "DS",
    templateId: "landing-page",
    accent: "linear-gradient(135deg,#f97316,#ec4899)",
    kind: "recent",
    workspaceId: "ws-paytm-design",
    workspaceName: "Paytm Design",
    fileBadge: "template",
    sharedInitials: ["RV", "AK"],
  },
  {
    id: "mf-3",
    name: "Dashboard UI Kit",
    lastEditedLabel: "3 days ago",
    ownerName: "Meera N.",
    ownerInitials: "MN",
    templateId: "dashboard",
    accent: "linear-gradient(135deg,#22c55e,#14b8a6)",
    kind: "team",
    workspaceId: "ws-product",
    workspaceName: "Product Team",
    fileBadge: "team",
    sharedInitials: ["PR", "RV", "KM"],
  },
  {
    id: "mf-4",
    name: "Payment Checkout",
    lastEditedLabel: "Last week",
    ownerName: "Priya Rao",
    ownerInitials: "PR",
    templateId: "checkout-flow",
    accent: "linear-gradient(135deg,#a855f7,#0d99ff)",
    kind: "team",
    workspaceId: "ws-product",
    workspaceName: "Product Team",
    fileBadge: "draft",
    sharedInitials: ["RV", "KM"],
  },
  {
    id: "mf-5",
    name: "Design System Starter",
    lastEditedLabel: "Dec 12",
    ownerName: "You",
    ownerInitials: "RV",
    templateId: "design-system-starter",
    accent: "linear-gradient(135deg,#64748b,#0f172a)",
    kind: "draft",
    workspaceId: "ws-personal",
    workspaceName: "Personal",
    fileBadge: "draft",
    sharedInitials: [],
  },
  {
    id: "mf-6",
    name: "Wireframe kit",
    lastEditedLabel: "Draft",
    ownerName: "You",
    ownerInitials: "RV",
    templateId: "wireframe-kit",
    accent: "linear-gradient(135deg,#94a3b8,#cbd5e1)",
    kind: "draft",
    workspaceId: "ws-personal",
    workspaceName: "Personal",
    fileBadge: "draft",
    sharedInitials: [],
  },
  {
    id: "mf-7",
    name: "AI checkout experiment",
    lastEditedLabel: "Today",
    ownerName: "Sana Ali",
    ownerInitials: "SA",
    templateId: "checkout-flow",
    accent: "linear-gradient(135deg,#6366f1,#ec4899)",
    kind: "draft",
    workspaceId: "ws-experiments",
    workspaceName: "Experiments",
    fileBadge: "template",
    sharedInitials: ["RV"],
  },
];

function baseFrame(
  id: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  opts?: Partial<Pick<EditorNode, "fill" | "cornerRadius" | "strokeColor" | "strokeWidth">>,
): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name,
    x,
    y,
    width,
    height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: opts?.fill ?? "#ffffff",
    strokeColor: opts?.strokeColor ?? "#e5e7eb",
    strokeWidth: opts?.strokeWidth ?? 1,
    cornerRadius: opts?.cornerRadius ?? 20,
  };
}

function childRect(
  id: string,
  parentId: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill: string,
  radius = 8,
): EditorNode {
  return {
    id,
    parentId,
    type: "rectangle",
    name,
    x,
    y,
    width,
    height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill,
    cornerRadius: radius,
  };
}

function childText(
  id: string,
  parentId: string,
  name: string,
  x: number,
  y: number,
  width: number,
  height: number,
  content: string,
): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name,
    x,
    y,
    width,
    height,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content,
    fill: "#0f172a",
    fontSize: 18,
    fontWeight: 600,
  };
}

function slice(
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
    pan: { x: 48, y: 32 },
    showGrid: false,
    showRulers: false,
    canvasBackgroundColor: "#e5e5e5",
    comments: [],
  });
}

function mobileAppScreen(): EditorPersistSlice {
  const f = "tpl-m-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: baseFrame(f, "Mobile — Screen", 72, 48, 390, 844, { cornerRadius: 32 }),
    "tpl-m-status": childRect("tpl-m-status", f, "Status", 0, 0, 390, 48, "#0f172a", 0),
    "tpl-m-title": childText("tpl-m-title", f, "Title", 24, 64, 320, 32, "Paytm"),
    "tpl-m-hero": childRect("tpl-m-hero", f, "Hero", 20, 120, 350, 200, "#e0f2fe", 16),
    "tpl-m-card": childRect("tpl-m-card", f, "Card", 20, 340, 350, 120, "#ffffff", 12),
    "tpl-m-tabs": childRect("tpl-m-tabs", f, "Tab bar", 0, 780, 390, 64, "#fafafa", 0),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["tpl-m-status", "tpl-m-title", "tpl-m-hero", "tpl-m-card", "tpl-m-tabs"],
  };
  return slice("Mobile App Flow", nodes, childOrder, [f]);
}

function landingPage(): EditorPersistSlice {
  const f = "tpl-l-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: baseFrame(f, "Landing — Desktop", 48, 40, 1280, 2200, { cornerRadius: 0 }),
    "tpl-l-nav": childRect("tpl-l-nav", f, "Nav", 0, 0, 1280, 72, "#ffffff", 0),
    "tpl-l-hero": childRect("tpl-l-hero", f, "Hero", 80, 120, 1120, 420, "#fef3c7", 24),
    "tpl-l-h1": childText("tpl-l-h1", f, "Headline", 120, 200, 800, 48, "Payments that feel effortless"),
    "tpl-l-row": childRect("tpl-l-row", f, "Feature row", 80, 600, 1120, 200, "#f8fafc", 16),
    "tpl-l-ft": childRect("tpl-l-ft", f, "Footer", 0, 2080, 1280, 120, "#0f172a", 0),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["tpl-l-nav", "tpl-l-hero", "tpl-l-h1", "tpl-l-row", "tpl-l-ft"],
  };
  return slice("Website Landing Page", nodes, childOrder, [f]);
}

function dashboardUi(): EditorPersistSlice {
  const f = "tpl-d-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: baseFrame(f, "Dashboard — Desktop", 40, 36, 1440, 900, { fill: "#f1f5f9", cornerRadius: 12 }),
    "tpl-d-side": childRect("tpl-d-side", f, "Sidebar", 0, 0, 240, 900, "#0f172a", 0),
    "tpl-d-top": childRect("tpl-d-top", f, "Top bar", 240, 0, 1200, 56, "#ffffff", 0),
    "tpl-d-w1": childRect("tpl-d-w1", f, "Widget A", 280, 96, 360, 220, "#ffffff", 12),
    "tpl-d-w2": childRect("tpl-d-w2", f, "Widget B", 680, 96, 360, 220, "#ffffff", 12),
    "tpl-d-w3": childRect("tpl-d-w3", f, "Widget C", 1080, 96, 320, 220, "#ffffff", 12),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["tpl-d-side", "tpl-d-top", "tpl-d-w1", "tpl-d-w2", "tpl-d-w3"],
  };
  return slice("Dashboard UI Kit", nodes, childOrder, [f]);
}

function checkoutFlow(): EditorPersistSlice {
  const f = "tpl-c-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: baseFrame(f, "Checkout", 120, 60, 520, 720, { cornerRadius: 20 }),
    "tpl-c-steps": childRect("tpl-c-steps", f, "Steps", 32, 32, 456, 40, "#f1f5f9", 8),
    "tpl-c-sum": childRect("tpl-c-sum", f, "Summary", 32, 96, 456, 280, "#ffffff", 12),
    "tpl-c-pay": childRect("tpl-c-pay", f, "Pay CTA", 32, 400, 456, 52, "#0d99ff", 10),
    "tpl-c-note": childText("tpl-c-note", f, "Secure", 32, 480, 400, 24, "Secured by Paytm"),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["tpl-c-steps", "tpl-c-sum", "tpl-c-pay", "tpl-c-note"],
  };
  return slice("Payment Checkout", nodes, childOrder, [f]);
}

function designSystemStarter(): EditorPersistSlice {
  const designTokens = buildPaletteTokens([
    { name: "Brand / Paytm Blue", hex: "#00baf2" },
    { name: "Brand / Navy", hex: "#002970" },
    { name: "Semantic / Success", hex: "#22c55e" },
    { name: "Semantic / Warning", hex: "#f59e0b" },
    { name: "Semantic / Error", hex: "#ef4444" },
  ]);
  const tokenIds = Object.keys(designTokens);
  const tPrimary = tokenIds.find((id) => designTokens[id]?.name.includes("Paytm Blue")) ?? tokenIds[0];
  const tSuccess = tokenIds.find((id) => designTokens[id]?.name.includes("Success")) ?? tPrimary;
  const tWarning = tokenIds.find((id) => designTokens[id]?.name.includes("Warning")) ?? tPrimary;
  const tError = tokenIds.find((id) => designTokens[id]?.name.includes("Error")) ?? tPrimary;

  const f = "tpl-ds-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: baseFrame(f, "Design system", 60, 48, 1100, 720, { cornerRadius: 16 }),
    "tpl-ds-h": childText("tpl-ds-h", f, "Heading", 40, 36, 600, 36, "Foundations"),
    "tpl-ds-c1": {
      ...childRect("tpl-ds-c1", f, "Primary", 40, 100, 120, 72, "#0d99ff", 8),
      fillTokenId: tPrimary,
      fillType: "solid",
    },
    "tpl-ds-c2": {
      ...childRect("tpl-ds-c2", f, "Success", 180, 100, 120, 72, "#22c55e", 8),
      fillTokenId: tSuccess,
      fillType: "solid",
    },
    "tpl-ds-c3": {
      ...childRect("tpl-ds-c3", f, "Warning", 320, 100, 120, 72, "#f59e0b", 8),
      fillTokenId: tWarning,
      fillType: "solid",
    },
    "tpl-ds-c4": {
      ...childRect("tpl-ds-c4", f, "Danger", 460, 100, 120, 72, "#ef4444", 8),
      fillTokenId: tError,
      fillType: "solid",
    },
    "tpl-ds-body": childText("tpl-ds-body", f, "Body sample", 40, 220, 800, 80, "The quick brown fox jumps over the lazy dog."),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["tpl-ds-h", "tpl-ds-c1", "tpl-ds-c2", "tpl-ds-c3", "tpl-ds-c4", "tpl-ds-body"],
  };
  return wrapPersistSliceWithPages({
    fileName: "Design System Starter",
    nodes,
    childOrder,
    assets: {},
    designTokens,
    selectedIds: [f],
    zoom: 0.52,
    pan: { x: 48, y: 32 },
    showGrid: true,
    showRulers: false,
    canvasBackgroundColor: "#e5e5e5",
    comments: [],
  });
}

function wireframeKit(): EditorPersistSlice {
  const f = "tpl-w-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: baseFrame(f, "Wireframes", 48, 48, 1200, 800, { fill: "#fafafa", cornerRadius: 8 }),
    "tpl-w-b1": childRect("tpl-w-b1", f, "Block", 40, 40, 360, 200, "#e2e8f0", 4),
    "tpl-w-b2": childRect("tpl-w-b2", f, "Block", 420, 40, 360, 200, "#e2e8f0", 4),
    "tpl-w-b3": childRect("tpl-w-b3", f, "Block", 800, 40, 360, 200, "#e2e8f0", 4),
    "tpl-w-line": childRect("tpl-w-line", f, "Divider", 40, 280, 1120, 2, "#cbd5e1", 0),
    "tpl-w-ph": childRect("tpl-w-ph", f, "Placeholder", 40, 320, 1120, 200, "#f1f5f9", 4),
  };
  const childOrder: Record<string, string[]> = {
    [ROOT]: [f],
    [f]: ["tpl-w-b1", "tpl-w-b2", "tpl-w-b3", "tpl-w-line", "tpl-w-ph"],
  };
  return slice("Wireframe kit", nodes, childOrder, [f]);
}

const TEMPLATES: Record<string, () => EditorPersistSlice> = {
  "mobile-app-screen": mobileAppScreen,
  "landing-page": landingPage,
  dashboard: dashboardUi,
  "checkout-flow": checkoutFlow,
  "design-system-starter": designSystemStarter,
  "wireframe-kit": wireframeKit,
};

export function getTemplatePersistSlice(templateId: string): EditorPersistSlice | null {
  const fn = TEMPLATES[templateId];
  return fn ? fn() : null;
}

export function blankWorkspace(): EditorPersistSlice {
  const f = "blank-frame";
  const nodes: Record<string, EditorNode> = {
    [f]: baseFrame(f, "Page", 160, 120, 960, 640, { cornerRadius: 12 }),
  };
  return slice("Untitled", nodes, { [ROOT]: [f] }, [f]);
}
