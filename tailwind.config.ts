import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontSize: {
        nano: ["var(--ui-font-nano)", { lineHeight: "var(--ui-leading-nano)" }],
        micro: ["var(--ui-font-micro)", { lineHeight: "var(--ui-leading-micro)" }],
        caption: ["var(--ui-font-caption)", { lineHeight: "var(--ui-leading-caption)" }],
        inspector: ["var(--ui-font-inspector)", { lineHeight: "var(--ui-leading-inspector)" }],
        "2xs": ["var(--ui-font-2xs)", { lineHeight: "var(--ui-leading-2xs)" }],
        ui: ["var(--ui-font-ui)", { lineHeight: "var(--ui-leading-ui)" }],
        "ui-sm": ["var(--ui-font-ui-sm)", { lineHeight: "var(--ui-leading-ui-sm)" }],
        xs: ["0.75rem", { lineHeight: "1.125rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
      },
      colors: {
        app: {
          bg: "hsl(var(--app-bg))",
          fg: "hsl(var(--app-fg))",
          muted: "hsl(var(--app-muted))",
          subtle: "hsl(var(--app-subtle))",
          panel: "hsl(var(--app-panel))",
          surface: "hsl(var(--app-surface))",
          raised: "hsl(var(--app-raised))",
          card: "hsl(var(--app-card))",
          inset: "hsl(var(--app-inset))",
          border: "hsl(var(--app-border) / var(--app-border-opacity))",
          "border-subtle": "hsl(var(--app-border) / var(--app-border-subtle-opacity))",
          "panel-edge": "hsl(var(--app-border) / var(--app-panel-edge-opacity))",
          hover: "hsl(var(--app-hover) / var(--app-hover-opacity))",
          overlay: "hsl(var(--app-overlay) / var(--app-overlay-opacity))",
          "toolbar-well": "hsl(var(--app-toolbar-well) / var(--app-toolbar-well-opacity))",
          field: "hsl(var(--app-field-bg))",
          "field-fg": "hsl(var(--app-field-fg))",
        },
        chrome: {
          DEFAULT: "hsl(var(--app-bg))",
          raised: "hsl(var(--app-raised))",
          panel: "hsl(var(--app-panel))",
          line: "hsl(var(--app-border) / var(--app-border-opacity))",
        },
        canvas: {
          workspace: "#e5e5e5",
          board: "#ffffff",
        },
        accent: {
          DEFAULT: "#18a0fb",
          muted: "rgba(24,160,251,0.14)",
        },
        guide: {
          DEFAULT: "#f24822",
          line: "rgba(242,72,34,0.95)",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
      },
      boxShadow: {
        panel: "var(--tw-shadow-app-panel, inset 0 1px 0 hsl(var(--app-inset-highlight) / var(--app-inset-highlight-opacity)))",
        float: "0 1px 2px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        artboard: "0 1px 2px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
