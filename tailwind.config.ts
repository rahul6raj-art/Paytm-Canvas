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
        chrome: {
          DEFAULT: "#2c2c2c",
          raised: "#383838",
          panel: "#333333",
          line: "rgba(0,0,0,0.35)",
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
        panel: "inset 0 1px 0 rgba(255,255,255,0.04)",
        float: "0 1px 2px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)",
        artboard: "0 1px 2px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
