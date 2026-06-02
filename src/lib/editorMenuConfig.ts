import type { EditorState } from "@/stores/useEditorStore";
import { COMMAND_BY_ID } from "@/lib/commands";
import { applyThemePreference } from "@/lib/theme";

export type MenuItemDef =
  | { type: "command"; commandId: string }
  | { type: "divider" }
  | {
      type: "action";
      label: string;
      shortcut?: string;
      enabled?: (s: EditorState) => boolean;
      run: (s: EditorState) => void;
    };

export type EditorMenuDef = {
  id: string;
  label: string;
  items: MenuItemDef[];
};

function cmd(commandId: string): MenuItemDef {
  return { type: "command", commandId };
}

function div(): MenuItemDef {
  return { type: "divider" };
}

function action(
  label: string,
  run: (s: EditorState) => void,
  opts?: { shortcut?: string; enabled?: (s: EditorState) => boolean },
): MenuItemDef {
  return { type: "action", label, run, shortcut: opts?.shortcut, enabled: opts?.enabled };
}

export const EDITOR_MENUS: EditorMenuDef[] = [
  {
    id: "file",
    label: "File",
    items: [
      action("New file", (s) => s.resetDocument()),
      action("Save", (s) => void s.saveToLocal(), { shortcut: "⌘S" }),
      cmd("export-document"),
      action("Import file…", () => {
        document.querySelector<HTMLInputElement>("[data-editor-import-input]")?.click();
      }),
      action("Design ↔ Code (export)…", (s) => s.openCodeRoundTrip("export")),
      action("Design ↔ Code (import)…", (s) => s.openCodeRoundTrip("import")),
      div(),
      cmd("open-version-history"),
      div(),
      action("Reset to sample document", (s) => s.resetDocument()),
    ],
  },
  {
    id: "edit",
    label: "Edit",
    items: [
      action("Undo", (s) => s.undo(), {
        shortcut: "⌘Z",
        enabled: (s) => s.historyPast.length > 0,
      }),
      action("Redo", (s) => s.redo(), {
        shortcut: "⌘⇧Z",
        enabled: (s) => s.historyFuture.length > 0,
      }),
      div(),
      cmd("cut-selection"),
      cmd("copy-selection"),
      cmd("paste-selection"),
      cmd("paste-in-place"),
      cmd("select-all"),
      div(),
      cmd("duplicate-selection"),
      cmd("delete-selection"),
      div(),
      cmd("toggle-lock-selection"),
      cmd("toggle-visible-selection"),
    ],
  },
  {
    id: "view",
    label: "View",
    items: [
      action(
        "Zoom in",
        () => {
          void import("@/lib/viewportZoom").then(({ zoomCanvasAtViewportCenter }) =>
            zoomCanvasAtViewportCenter(1.25, { recordHistory: true }),
          );
        },
        { shortcut: "⌘+" },
      ),
      action(
        "Zoom out",
        () => {
          void import("@/lib/viewportZoom").then(({ zoomCanvasAtViewportCenter }) =>
            zoomCanvasAtViewportCenter(1 / 1.25, { recordHistory: true }),
          );
        },
        { shortcut: "⌘−" },
      ),
      action("Reset view", () => {
        void import("@/lib/viewportZoom").then(({ resetCanvasView }) => resetCanvasView());
      }),
      div(),
      cmd("toggle-ui-chrome"),
      div(),
      action("Appearance: Light", () => applyThemePreference("light")),
      action("Appearance: Dark", () => applyThemePreference("dark")),
      action("Appearance: System", () => applyThemePreference("system")),
      div(),
      cmd("toggle-grid"),
      cmd("toggle-comments-panel"),
      cmd("toggle-presence"),
      div(),
      cmd("mode-design"),
      cmd("mode-prototype"),
      cmd("mode-inspect"),
      div(),
      cmd("show-shortcuts"),
      cmd("open-help-demo-checklist"),
    ],
  },
  {
    id: "object",
    label: "Object",
    items: [
      cmd("group-selection"),
      cmd("ungroup-selection"),
      div(),
      cmd("create-component"),
      cmd("detach-instance"),
      div(),
      cmd("bring-forward"),
      cmd("send-backward"),
      cmd("bring-to-front"),
      cmd("send-to-back"),
    ],
  },
  {
    id: "text",
    label: "Text",
    items: [
      action(
        "Edit text",
        (s) => {
          const id = s.selectedIds[0];
          if (!id) return;
          const n = s.nodes[id];
          if (n?.type !== "text" || n.locked || !n.visible) return;
          s.pushHistory();
          s.setEditingTextId(id);
        },
        {
          enabled: (s) => {
            if (s.editorMode !== "design" || s.selectedIds.length !== 1) return false;
            const n = s.nodes[s.selectedIds[0]!];
            return n?.type === "text" && n.visible && !n.locked;
          },
        },
      ),
      cmd("create-typography-style"),
      cmd("open-styles-panel"),
      cmd("open-components-panel"),
    ],
  },
  {
    id: "arrange",
    label: "Arrange",
    items: [
      cmd("align-left"),
      cmd("align-center-h"),
      cmd("align-right"),
      cmd("align-top"),
      cmd("align-center-v"),
      cmd("align-bottom"),
      div(),
      cmd("distribute-horizontal"),
      cmd("distribute-vertical"),
    ],
  },
  {
    id: "pages",
    label: "Pages",
    items: [
      cmd("add-page"),
      cmd("duplicate-active-page"),
      cmd("delete-active-page"),
      div(),
      cmd("previous-page"),
      cmd("next-page"),
    ],
  },
  {
    id: "plugins",
    label: "Plugins",
    items: [
      cmd("plugins-open-marketplace"),
      cmd("ai-generate-design"),
      div(),
      cmd("plugins-run-contrast"),
      cmd("plugins-run-lorem"),
      cmd("plugins-run-tokens"),
    ],
  },
];

export type ResolvedMenuItem = {
  label: string;
  shortcut: string;
  disabled: boolean;
  run: () => void;
};

export function resolveMenuItem(
  item: MenuItemDef,
  getState: () => EditorState,
): ResolvedMenuItem | null {
  if (item.type === "divider") return null;
  const state = getState();

  if (item.type === "command") {
    const def = COMMAND_BY_ID[item.commandId];
    if (!def) return null;
    return {
      label: def.title,
      shortcut: def.shortcut,
      disabled: !def.enabled(state),
      run: () => def.run(getState()),
    };
  }

  return {
    label: item.label,
    shortcut: item.shortcut ?? "",
    disabled: item.enabled ? !item.enabled(state) : false,
    run: () => item.run(getState()),
  };
}
