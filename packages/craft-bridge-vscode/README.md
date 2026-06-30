# Craft Bridge — Cursor / VS Code Extension

Push **React** (`.tsx`) or **HTML** (`.html`) page folders — including companion **`.css`** — to the **Paytm Craft** canvas. Edit on canvas, then **Send to code** writes all linked files back.

## Install in Cursor

From the Craft monorepo:

```bash
npm run extension:pack
```

In Cursor:

1. `Cmd+Shift+P` → **Extensions: Install from VSIX…**
2. Select `packages/craft-bridge-vscode/craft-bridge-0.1.12.vsix`
3. Reload Cursor

Or:

```bash
/Applications/Cursor.app/Contents/Resources/app/bin/cursor --install-extension packages/craft-bridge-vscode/craft-bridge-0.1.12.vsix
```

## Workflow (manual sync)

```
1. Push page folder to Craft     (right-click folder, or Shift+Alt+C S)
   → imports .tsx/.html + .css
2. Edit on canvas freely         (source files unchanged)
3. Right-click frame in Craft  → Send to code
   → updates .tsx/.html AND .css
4. Reload files in Cursor      (Shift+Alt+C U)
```

## Live preview push (any screen)

Run **Craft Bridge: Install Live Preview Right-Click Menu** once per app repo. Then in the browser preview (e.g. Vite on `:5173`):

- **Right-click anywhere** on the visible screen → **Push to Craft canvas**
- Works for all `?screen=` routes (home, more, signup, onboarding, fno, mf, …)
- Unknown routes still capture as editable layers

Keep Craft `/editor` open while pushing.

## Right-click targets

| Target | Action |
|--------|--------|
| **Page folder** | Push entire folder (main `.tsx` or `.html` + all `.css`) |
| **`.tsx` / `.html`** | Push that screen (+ sibling/imported `.css`) |
| **`.css`** | Push parent page folder (same screen) |

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Setup & Push Screen | `Shift+Alt+C S` | Init + link + push page (+ CSS) + preview menu |
| Push Active File | `Shift+Alt+C P` | Push current file or its page folder |
| Push Page Folder | — | Explorer: right-click folder |
| Reload Source from Craft | `Shift+Alt+C U` | Reload after Send to code |
| Open Craft Editor | `Shift+Alt+C O` | Open browser editor |
| Install Live Preview Menu | — | Add right-click push to `index.html` |
| Link Page | — | Link file/folder with **manual** sync + `cssPaths` |

## Settings

| Setting | Default |
|---------|---------|
| `craftBridge.craftUrl` | `http://localhost:3000` |
| `craftBridge.openBrowserOnPush` | `true` |
| `craftBridge.captureTheme` | `light` — set `dark` when pushing dark-mode screens |

## Notes

- **v0.1.12** — Push **any visible preview screen** via right-click (all PML `?screen=` routes + onboarding). Bridge captures use **absolute/manual layout** so editing text, colors, and layers on canvas no longer triggers flex reflow. Screen folders auto-discovered from repo (ignores stale `craft.link.json` entries). Requires latest Craft dev server.
- **v0.1.11** — `craftBridge.captureTheme` sets live capture to light or dark (`?theme=` on preview). Pair with Craft **Styles → Light/Dark** to preview both token modes on canvas.
- **v0.1.10** — Push to Craft works on **any visible preview route** (internal screens, modals, nested paths). Capture-only mode when no linked page folder matches.
- **v0.1.9** — Falls back to source parse when live preview capture fails; opens Craft with `?bridgeImport=1&bridgeId=…` so imports apply immediately after push.
- **Canvas → source** is **manual** — use **Send to code** in Craft (not auto-sync).
- Companion CSS is discovered from the page folder and `<link rel="stylesheet">` / `import './page.css'`.
- **Source → canvas** watch is **off** by default.
- Craft **AI Generate** (in the web editor) supports **GPT-4o Mini** (fast) and **Cursor** models — set `OPENAI_API_KEY` / `CURSOR_API_KEY` in Craft’s `.env.local`.
