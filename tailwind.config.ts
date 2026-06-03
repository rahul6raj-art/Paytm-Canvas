import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontSize: {
        "2xs": ["11px", { lineHeight: "14px" }],
        ui: ["12px", { lineHeight: "16px" }],
        "ui-sm": ["13px", { lineHeight: "18px" }],
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
