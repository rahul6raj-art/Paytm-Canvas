# Craft Bridge — Cursor / VS Code Extension

Push **React** (`.tsx`) or **HTML** (`.html`) page folders — including companion **`.css`** — to the **Paytm Craft** canvas. Edit on canvas, then **Send to code** writes all linked files back.

## Install in Cursor

From the Craft monorepo:

```bash
npm run extension:pack
```

In Cursor:

1. `Cmd+Shift+P` → **Extensions: Install from VSIX…**
2. Select `packages/craft-bridge-vscode/craft-bridge-0.1.8.vsix`
3. Reload Cursor

Or:

```bash
/Applications/Cursor.app/Contents/Resources/app/bin/cursor --install-extension packages/craft-bridge-vscode/craft-bridge-0.1.8.vsix
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

## Right-click targets

| Target | Action |
|--------|--------|
| **Page folder** | Push entire folder (main `.tsx` or `.html` + all `.css`) |
| **`.tsx` / `.html`** | Push that screen (+ sibling/imported `.css`) |
| **`.css`** | Push parent page folder (same screen) |

## Commands

| Command | Shortcut | Description |
|---------|----------|-------------|
| Setup & Push Screen | `Shift+Alt+C S` | Init + link + push page (+ CSS) |
| Push Active File | `Shift+Alt+C P` | Push current file or its page folder |
| Push Page Folder | — | Explorer: right-click folder |
| Reload Source from Craft | `Shift+Alt+C U` | Reload after Send to code |
| Open Craft Editor | `Shift+Alt+C O` | Open browser editor |
| Link Page | — | Link file/folder with **manual** sync + `cssPaths` |

## Settings

| Setting | Default |
|---------|---------|
| `craftBridge.craftUrl` | `http://localhost:3000` |
| `craftBridge.openBrowserOnPush` | `true` |

## Notes

- **v0.1.8** — Bundled bridge CLI + Cursor hooks refresh. Pair with latest Craft dev server for hug-contents text frame sizing (tighter vertical bounds on auto-width text).
- **v0.1.7** — Light-mode live capture (`?theme=light`), unique `bridgeId` per push so canvas reloads reliably, bundled CLI passes preview theme. Requires Craft dev server + PML preview running.
- **v0.1.6** — Auto live-capture from `http://localhost:5173` for PML screens (`?screen=more`, `signup`, etc.) when `previewUrl` is omitted. Requires Vite preview running for real colors/shapes (not grey placeholders).
- **v0.1.5** — Push auto-appends preview routes (e.g. `?screen=signup` for PML signup pages) when `previewUrl` is bare localhost. Requires Craft server with latest bridge import fixes for full canvas layout.
- **Canvas → source** is **manual** — use **Send to code** in Craft (not auto-sync).
- Companion CSS is discovered from the page folder and `<link rel="stylesheet">` / `import './page.css'`.
- **Source → canvas** watch is **off** by default.
- Craft **AI Generate** (in the web editor) supports **GPT-4o Mini** (fast) and **Cursor** models — set `OPENAI_API_KEY` / `CURSOR_API_KEY` in Craft’s `.env.local`.
