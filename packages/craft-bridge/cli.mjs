#!/usr/bin/env node
/**
 * @paytm-craft/bridge CLI — use from any repo via npx or npm run craft-bridge in Craft monorepo.
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, copyFileSync, chmodSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_DIR = path.join(__dirname, "templates");
const MANIFEST_NAME = "craft.link.json";

const SCREEN_ROUTE_BY_COMPONENT = {
  PMLSignupPage: "signup",
  PMLHomePage: "home",
  PMLStocksPage: "stocks",
  PMLMorePage: "more",
  OnboardingFlow: "onboarding",
};

const DEFAULT_PREVIEW_BASE_URL =
  process.env.CRAFT_BRIDGE_PREVIEW_URL?.trim() || "http://localhost:5173";

function derivePreviewCaptureUrl(previewUrl, pageLabel) {
  const trimmed = String(previewUrl ?? "").trim();
  if (!trimmed) return trimmed;
  const theme =
    (process.env.CRAFT_BRIDGE_CAPTURE_THEME ?? "light").trim().toLowerCase() === "dark"
      ? "dark"
      : "light";
  let parsed;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `http://${trimmed}`);
  } catch {
    return trimmed;
  }
  if (!parsed.searchParams.has("screen") && parsed.pathname === "/") {
    const label = String(pageLabel ?? "")
      .replace(/\.[^.]+$/, "")
      .split("/")
      .pop();
    const screen = label ? SCREEN_ROUTE_BY_COMPONENT[label] : undefined;
    if (screen && screen !== "home") {
      parsed.searchParams.set("screen", screen);
    }
  }
  parsed.searchParams.set("theme", theme);
  return parsed.toString();
}

function resolvePreviewCaptureUrl(previewUrl, pageLabel) {
  const explicit = String(previewUrl ?? "").trim();
  if (explicit) return derivePreviewCaptureUrl(explicit, pageLabel);
  const label = String(pageLabel ?? "")
    .replace(/\.[^.]+$/, "")
    .split("/")
    .pop();
  if (!label || !SCREEN_ROUTE_BY_COMPONENT[label]) return undefined;
  return derivePreviewCaptureUrl(DEFAULT_PREVIEW_BASE_URL, pageLabel);
}

function usage() {
  console.log(`@paytm-craft/bridge CLI

Commands:
  setup <sourcePath> [--preview URL]   One-shot: init + hooks + link + push
  init [--craft-url URL] [--with-hooks]   Create craft.link.json (+ optional Cursor hooks)
  install-hooks                         Copy Cursor afterFileEdit hook into .cursor/
  link <sourcePath> --repo <path>     Add/update a linked source file
  push <sourcePath> [--repo <path>] [--open]   Import page (keep /editor open; use --open to launch browser)
  pull [sourcePath] [--repo <path>]   Show linked source file sync status
  watch [sourcePath] [--repo <path>]  Push on file change (keep Craft editor open)
  install-preview-menu              Right-click live preview → Push to Craft
  status                              Bridge + pending import status

Environment:
  CRAFT_BRIDGE_URL     Craft server (default http://localhost:3000)
  CRAFT_BRIDGE_TOKEN   Bearer token when server requires auth
`);
}

function parseArgs(argv) {
  const args = [...argv];
  const flags = {};
  const positionals = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--repo") flags.repo = args[++i];
    else if (a === "--craft-url") flags.craftUrl = args[++i];
    else if (a === "--preview") flags.preview = args[++i];
    else if (a === "--sync") flags.sync = args[++i];
    else if (a === "--format") flags.format = args[++i];
    else if (a === "--watch") flags.watch = true;
    else if (a === "--no-watch") flags.watch = false;
    else if (a === "--open") flags.open = true;
    else if (a === "--no-open") flags.open = false;
    else if (a === "--with-hooks") flags.withHooks = true;
    else if (a.startsWith("-")) throw new Error(`Unknown flag: ${a}`);
    else positionals.push(a);
  }
  return { cmd: positionals[0], rest: positionals.slice(1), flags };
}

function craftUrl(flags) {
  return (
    flags.craftUrl?.trim() ||
    process.env.CRAFT_BRIDGE_URL?.trim() ||
    readManifest()?.craftUrl?.trim() ||
    "http://localhost:3000"
  );
}

function bridgeToken() {
  return (
    process.env.CRAFT_BRIDGE_TOKEN?.trim() ||
    readManifest()?.bridgeToken?.trim() ||
    undefined
  );
}

function authHeaders() {
  const token = bridgeToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

function manifestPath(cwd = process.cwd()) {
  return path.join(cwd, MANIFEST_NAME);
}

function readManifest(cwd = process.cwd()) {
  const file = manifestPath(cwd);
  if (!existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8"));
}

function writeManifest(manifest, cwd = process.cwd()) {
  writeFileSync(manifestPath(cwd), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function resolveRepo(flags, cwd = process.cwd()) {
  if (flags.repo?.trim()) return path.resolve(flags.repo.trim());
  const m = readManifest(cwd);
  if (m?.repoRoot?.trim()) return path.resolve(m.repoRoot.trim());
  return cwd;
}

function findLink(manifest, sourcePath) {
  if (!manifest?.links) return null;
  const norm = sourcePath.replace(/\\/g, "/");
  return manifest.links.find((l) => l.sourcePath.replace(/\\/g, "/") === norm) ?? null;
}

async function fetchJson(url, init) {
  let res;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
        ...(init?.headers ?? {}),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const base = String(url).replace(/\/api\/.*$/, "");
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(msg)) {
      throw new Error(
        `Cannot reach Craft at ${base}. Start Craft first: cd Craft-main && npm run dev`,
      );
    }
    throw e;
  }
  const text = await res.text();
  let body = {};
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(
          `Craft error (${res.status}): ${text.slice(0, 160)}. Try: npm run dev:clean`,
        );
      }
      throw new Error(`Craft returned invalid JSON (${res.status}). Try: npm run dev:clean`);
    }
  }
  if (!res.ok) {
    const err = body.error ?? `HTTP ${res.status}`;
    throw new Error(err);
  }
  return body;
}

function installCursorHooks(cwd = process.cwd()) {
  const hooksJsonSrc = path.join(TEMPLATE_DIR, "cursor", "hooks.json");
  const hookScriptSrc = path.join(TEMPLATE_DIR, "cursor", "hooks", "craft-bridge-after-file-edit.mjs");
  const cursorDir = path.join(cwd, ".cursor");
  const hooksDir = path.join(cursorDir, "hooks");
  const hooksJsonDst = path.join(cursorDir, "hooks.json");
  const hookScriptDst = path.join(hooksDir, "craft-bridge-after-file-edit.mjs");

  mkdirSync(hooksDir, { recursive: true });
  copyFileSync(hooksJsonSrc, hooksJsonDst);
  copyFileSync(hookScriptSrc, hookScriptDst);
  chmodSync(hookScriptDst, 0o755);

  console.log("Installed Cursor hooks:");
  console.log(`  ${path.relative(cwd, hooksJsonDst)}`);
  console.log(`  ${path.relative(cwd, hookScriptDst)}`);
  console.log("Restart Cursor to load hooks. Linked file edits will debounce-push to Craft.");
}

const PREVIEW_MENU_MARKER = "craft-bridge/preview-menu.js";

function findPreviewIndexHtml(cwd) {
  for (const rel of ["index.html", "public/index.html", "apps/web/index.html"]) {
    const abs = path.join(cwd, rel);
    if (existsSync(abs)) return abs;
  }
  return null;
}

function installPreviewMenu(cwd = process.cwd()) {
  const manifest = readManifest(cwd);
  if (!manifest) {
    throw new Error(`Missing ${MANIFEST_NAME}. Run craft-bridge init first.`);
  }
  const indexPath = findPreviewIndexHtml(cwd);
  if (!indexPath) {
    throw new Error("Could not find index.html — add preview menu script manually.");
  }

  const craftBase = String(manifest.craftUrl || craftUrl({})).replace(/\/$/, "");
  const repoRoot = manifest.repoRoot || cwd;
  const token = bridgeToken() || manifest.bridgeToken || "";

  let html = readFileSync(indexPath, "utf8");
  html = html.replace(/^\s*<script[^>]*craft-bridge\/preview-menu\.js[^>]*>\s*<\/script>\s*$/gim, "");

  const attrs = [
    `src="${craftBase}/craft-bridge/preview-menu.js"`,
    `data-craft-url="${craftBase}"`,
    `data-repo-root="${repoRoot.replace(/"/g, "&quot;")}"`,
  ];
  if (token) attrs.push(`data-bridge-token="${token.replace(/"/g, "&quot;")}"`);

  const tag = `    <script ${attrs.join(" ")} defer></script>`;
  html = html.replace(/<\/body>/i, `${tag}\n  </body>`);
  writeFileSync(indexPath, html, "utf8");

  console.log(`Preview menu installed → ${path.relative(cwd, indexPath)}`);
  console.log("  Right-click anywhere on the live app preview → Push to Craft canvas");
  console.log(`  Script: ${craftBase}/craft-bridge/preview-menu.js`);
}

async function cmdInstallPreviewMenu() {
  installPreviewMenu(process.cwd());
}

async function cmdInit(flags) {
  const cwd = process.cwd();
  const templateManifest = path.join(TEMPLATE_DIR, "craft.link.json");
  if (flags.withHooks && existsSync(templateManifest)) {
    copyFileSync(templateManifest, manifestPath(cwd));
    const manifest = readManifest(cwd);
    manifest.craftUrl = craftUrl(flags);
    manifest.repoRoot = cwd;
    writeManifest(manifest, cwd);
    installCursorHooks(cwd);
  } else {
    const manifest = {
      craftUrl: craftUrl(flags),
      repoRoot: cwd,
      links: [],
    };
    writeManifest(manifest, cwd);
  }

  const manifest = readManifest(cwd);
  console.log(`Created ${MANIFEST_NAME}`);
  console.log(`  craftUrl: ${manifest.craftUrl}`);
  console.log(`  repoRoot: ${manifest.repoRoot}`);
  if (process.env.CRAFT_BRIDGE_TOKEN) {
    console.log("  bridgeToken: (from CRAFT_BRIDGE_TOKEN env)");
  }
}

async function cmdInstallHooks() {
  installCursorHooks(process.cwd());
}

async function cmdSetup(sourcePath, flags) {
  if (!sourcePath) throw new Error("setup requires <sourcePath> (e.g. src/App.tsx)");

  const base = craftUrl(flags);
  try {
    const status = await fetchJson(`${base}/api/craft-bridge/status`);
    if (!status.enabled) {
      console.warn(`Craft bridge is disabled at ${base} — set CRAFT_BRIDGE_ENABLED=1 in Craft .env.local`);
    }
  } catch {
    console.warn(`Craft not reachable at ${base} — start it: cd Craft-main && npm run dev`);
  }

  await cmdInit({ ...flags, withHooks: true });
  await cmdLink(sourcePath, { ...flags, sync: flags.sync ?? "manual", watch: flags.watch === true });
  try {
    installPreviewMenu(process.cwd());
  } catch (e) {
    console.warn(e instanceof Error ? e.message : String(e));
  }
  await cmdPush(sourcePath, { ...flags, open: flags.open !== false });

  console.log("\n✓ Ready. Right-click the live preview screen → Push to Craft canvas.");
  console.log("  Edit on canvas, then Send to code when done.");
}

async function cmdLink(sourcePath, flags) {
  if (!sourcePath) throw new Error("link requires <sourcePath>");
  const cwd = process.cwd();
  const repoRoot = resolveRepo(flags, cwd);
  const rel = path.relative(repoRoot, path.resolve(repoRoot, sourcePath)).replace(/\\/g, "/");
  if (rel.startsWith("..")) throw new Error("sourcePath must be inside repo root");

  const manifest = readManifest(cwd) ?? {
    craftUrl: craftUrl(flags),
    repoRoot,
    links: [],
  };
  manifest.craftUrl = craftUrl(flags);
  manifest.repoRoot = repoRoot;

  const entry = {
    sourcePath: rel,
    cssPaths: resolvePageCssPaths(repoRoot, sourcePath),
    previewUrl: flags.preview,
    syncMode: flags.sync === "auto" ? "auto" : "manual",
    watchSource: flags.watch === true,
    conflictPolicy: "ask",
  };

  const idx = manifest.links.findIndex((l) => l.sourcePath === rel);
  if (idx >= 0) manifest.links[idx] = { ...manifest.links[idx], ...entry };
  else manifest.links.push(entry);

  writeManifest(manifest, cwd);
  console.log(`Linked ${rel} → Craft (${manifest.craftUrl})`);
}

function discoverDesignTokenCss(startDir) {
  let dir = startDir;
  for (let depth = 0; depth < 8; depth++) {
    const tokensDir = path.join(dir, "src/tokens");
    if (existsSync(tokensDir)) {
      return readdirSync(tokensDir)
        .filter((f) => f.endsWith(".css"))
        .map((f) => path.join(tokensDir, f));
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [];
}

function appendUniqueCss(paths, extra) {
  const out = [...paths];
  for (const p of extra) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

function resolvePageCssPaths(repoRoot, sourcePath) {
  try {
    const abs = path.resolve(repoRoot, sourcePath);
    if (!existsSync(abs)) return [];
    const resolved = resolvePageSource(abs);
    return resolved.cssPaths.map((p) => path.relative(repoRoot, p).replace(/\\/g, "/"));
  } catch {
    return [];
  }
}

function resolvePageSource(abs) {
  const st = statSync(abs);
  if (st.isDirectory()) return resolvePageInDirectory(abs);

  const dir = path.dirname(abs);
  const base = path.basename(abs);

  if (base === "index.ts" || base === "index.tsx") {
    return resolvePageInDirectory(dir);
  }

  if (abs.endsWith(".tsx")) {
    return {
      tsxPath: abs,
      format: "react",
      cssPaths: appendUniqueCss(
        collectCssFromSource(abs, "react"),
        discoverDesignTokenCss(dir),
      ),
      linkPath: abs,
      pageLabel: path.basename(abs, ".tsx"),
    };
  }

  if (abs.endsWith(".html") || abs.endsWith(".htm")) {
    return {
      tsxPath: abs,
      format: "html",
      cssPaths: appendUniqueCss(
        collectCssFromSource(abs, "html"),
        discoverDesignTokenCss(dir),
      ),
      linkPath: abs,
      pageLabel: path.basename(abs, path.extname(abs)),
    };
  }

  throw new Error(
    `Expected a page folder, index.ts, .tsx, or .html file — got: ${abs}`,
  );
}

function resolvePageInDirectory(dir) {
  const files = readdirSync(dir);
  const indexTs = path.join(dir, "index.ts");
  let mainFile = null;
  let format = "react";

  if (existsSync(indexTs)) {
    const idx = readFileSync(indexTs, "utf8");
    const m = idx.match(/from\s+['"]\.\/([^'"]+)['"]/);
    if (m) {
      const stem = m[1].replace(/\.(tsx|html|htm)$/, "");
      for (const ext of [".tsx", ".html", ".htm"]) {
        const candidate = `${stem}${ext}`;
        if (files.includes(candidate)) {
          mainFile = candidate;
          format = ext === ".tsx" ? "react" : "html";
          break;
        }
      }
    }
  }

  if (!mainFile) {
    const tsxCandidates = files.filter(
      (f) =>
        f.endsWith(".tsx") &&
        !f.includes(".stories.") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
    if (tsxCandidates.length === 1) {
      mainFile = tsxCandidates[0];
      format = "react";
    } else if (tsxCandidates.length > 1) {
      const prefer = `${path.basename(dir)}.tsx`;
      mainFile = tsxCandidates.includes(prefer) ? prefer : tsxCandidates[0];
      format = "react";
    }
  }

  if (!mainFile) {
    const htmlCandidates = files.filter(
      (f) =>
        (f.endsWith(".html") || f.endsWith(".htm")) &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
    if (htmlCandidates.length === 1) {
      mainFile = htmlCandidates[0];
      format = "html";
    } else if (htmlCandidates.length > 1) {
      const prefer = `${path.basename(dir)}.html`;
      if (htmlCandidates.includes(prefer)) mainFile = prefer;
      else if (htmlCandidates.includes("index.html")) mainFile = "index.html";
      else mainFile = htmlCandidates[0];
      format = "html";
    }
  }

  if (!mainFile) {
    throw new Error(`No page .tsx or .html found in folder: ${dir}`);
  }

  const mainPath = path.join(dir, mainFile);
  let cssPaths = files
    .filter((f) => f.endsWith(".css"))
    .map((f) => path.join(dir, f));
  for (const imported of collectCssFromSource(mainPath, format)) {
    if (!cssPaths.includes(imported)) cssPaths.push(imported);
  }
  cssPaths = appendUniqueCss(cssPaths, discoverDesignTokenCss(dir));

  const linkPath = existsSync(indexTs) ? indexTs : mainPath;
  return {
    tsxPath: mainPath,
    format,
    cssPaths,
    linkPath,
    pageLabel: path.basename(dir),
  };
}

function collectCssFromSource(sourcePath, format) {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const base = path.basename(sourcePath, ext);
  const cssPaths = [];
  const sibling = path.join(dir, `${base}.css`);
  if (existsSync(sibling)) cssPaths.push(sibling);

  const src = readFileSync(sourcePath, "utf8");
  if (format === "react") {
    for (const m of src.matchAll(/import\s+['"](\.\/[^'"]+\.css)['"]/g)) {
      const rel = m[1].replace(/^\.\//, "");
      const p = path.join(dir, rel);
      if (existsSync(p) && !cssPaths.includes(p)) cssPaths.push(p);
    }
  } else {
    for (const m of src.matchAll(/<link[^>]+href=["'](\.\/[^"']+\.css)["'][^>]*>/gi)) {
      const rel = m[1].replace(/^\.\//, "");
      const p = path.join(dir, rel);
      if (existsSync(p) && !cssPaths.includes(p)) cssPaths.push(p);
    }
  }
  return cssPaths;
}

async function cmdPush(sourcePath, flags) {
  if (!sourcePath) throw new Error("push requires <sourcePath>");
  const cwd = process.cwd();
  const repoRoot = resolveRepo(flags, cwd);
  const abs = path.resolve(repoRoot, sourcePath);
  if (!existsSync(abs)) throw new Error(`Path not found: ${abs}`);

  const st = statSync(abs);
  const fileName = path.basename(abs);
  let resolved;
  if (
    st.isFile() &&
    !abs.endsWith(".tsx") &&
    !abs.endsWith(".html") &&
    !abs.endsWith(".htm") &&
    fileName !== "index.ts" &&
    fileName !== "index.tsx"
  ) {
    resolved = {
      tsxPath: abs,
      format: "react",
      cssPaths: [],
      linkPath: abs,
      pageLabel: fileName,
    };
  } else {
    resolved = resolvePageSource(abs);
  }

  const source = readFileSync(resolved.tsxPath, "utf8");
  const companionCss = resolved.cssPaths.map((p) => readFileSync(p, "utf8"));
  const manifest = readManifest(cwd);
  const linkRel = path.relative(repoRoot, resolved.linkPath).replace(/\\/g, "/");
  const cssRelPaths = resolved.cssPaths.map((p) =>
    path.relative(repoRoot, p).replace(/\\/g, "/"),
  );
  const link = findLink(manifest, sourcePath) ?? findLink(manifest, linkRel) ?? {
    sourcePath: linkRel,
    syncMode: "manual",
  };

  const craftBase = craftUrl(flags);
  const format =
    flags.format ??
    resolved.format ??
    (resolved.tsxPath.endsWith(".html") || resolved.tsxPath.endsWith(".htm") ? "html" : "react");

  const manifestPreview = manifest?.links?.find((l) => l.previewUrl)?.previewUrl;
  const previewForPush = resolvePreviewCaptureUrl(
    link.previewUrl ?? flags.preview ?? manifestPreview,
    resolved.pageLabel,
  );

  const result = await fetchJson(`${craftBase}/api/craft-bridge/import-source`, {
    method: "POST",
    body: JSON.stringify({
      source,
      companionCss,
      format,
      fileName: path.basename(resolved.tsxPath),
      link: {
        sourcePath: link.sourcePath ?? linkRel,
        repoRoot,
        cssPaths: cssRelPaths,
        previewUrl: previewForPush,
        syncMode: link.syncMode ?? "manual",
        watchSource: link.watchSource ?? false,
      },
    }),
  });

  console.log(result.message ?? "Imported.");
  if (companionCss.length > 0) {
    console.log(`  Page CSS: ${resolved.cssPaths.map((p) => path.basename(p)).join(", ")}`);
  }
  console.log(`  Layers: ${result.layerCount}`);
  const openUrl = `${craftBase}${result.openUrl ?? "/editor"}`;
  console.log(`  Open: ${openUrl}`);

  if (flags.open === true) {
    const { exec } = await import("node:child_process");
    const openCmd =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";
    exec(`${openCmd} ${JSON.stringify(openUrl)}`);
  }
}

async function cmdPull(sourcePath, flags) {
  const cwd = process.cwd();
  const repoRoot = resolveRepo(flags, cwd);
  const manifest = readManifest(cwd);
  const rel =
    sourcePath ??
    manifest?.links?.[0]?.sourcePath ??
    (() => {
      throw new Error("pull requires sourcePath or craft.link.json with links");
    })();

  const abs = path.resolve(repoRoot, rel);
  if (!existsSync(abs)) {
    console.log(`Source not written yet: ${abs}`);
    console.log("Enable auto-sync in Craft (Design ↔ Code → Source file bridge) and edit layers.");
    return;
  }

  const st = statSync(abs);
  console.log(`Linked source: ${abs}`);
  console.log(`  Modified: ${st.mtime.toISOString()}`);
  console.log(`  Size: ${st.size} bytes`);

  const base = craftUrl(flags);
  try {
    const status = await fetchJson(`${base}/api/craft-bridge/status`);
    console.log(`  Craft bridge: ${status.enabled ? "enabled" : "disabled"}`);
    console.log(`  Auth required: ${status.authRequired ? "yes" : "no"}`);
    if (status.pending) console.log("  Pending import waiting in Craft");
  } catch (e) {
    console.log(`  Craft unreachable: ${e instanceof Error ? e.message : e}`);
  }
}

async function cmdWatch(sourcePath, flags) {
  const cwd = process.cwd();
  const repoRoot = resolveRepo(flags, cwd);
  const manifest = readManifest(cwd);
  const rel =
    sourcePath ??
    manifest?.links?.[0]?.sourcePath ??
    (() => {
      throw new Error("watch requires sourcePath or craft.link.json with links");
    })();

  const abs = path.resolve(repoRoot, rel);
  if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);

  console.log(`Watching ${abs} → Craft (push on change). Keep Craft editor open with Watch on.`);
  let lastMtime = statSync(abs).mtimeMs;

  const tick = async () => {
    if (!existsSync(abs)) return;
    const mtime = statSync(abs).mtimeMs;
    if (mtime === lastMtime) return;
    lastMtime = mtime;
    console.log(`[craft-bridge] ${new Date().toISOString()} changed — pushing…`);
    await cmdPush(rel, { ...flags, repo: repoRoot, open: false });
  };

  await tick();
  setInterval(() => {
    void tick().catch((e) => console.error(e instanceof Error ? e.message : e));
  }, 1500);
}

async function cmdStatus(flags) {
  const base = craftUrl(flags);
  const manifest = readManifest();
  if (manifest) {
    console.log(`${MANIFEST_NAME}:`);
    console.log(`  craftUrl: ${manifest.craftUrl}`);
    console.log(`  repoRoot: ${manifest.repoRoot}`);
    console.log(`  links: ${manifest.links?.length ?? 0}`);
  } else {
    console.log(`No ${MANIFEST_NAME} in ${process.cwd()}`);
  }

  try {
    const status = await fetchJson(`${base}/api/craft-bridge/status`);
    console.log(`Craft (${base}):`);
    console.log(`  bridge enabled: ${status.enabled}`);
    console.log(`  auth required: ${status.authRequired}`);
    console.log(`  pending import: ${status.pending}`);
  } catch (e) {
    console.log(`Craft unreachable at ${base}: ${e instanceof Error ? e.message : e}`);
  }
}

async function main() {
  const { cmd, rest, flags } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === "help" || cmd === "--help") {
    usage();
    process.exit(cmd ? 0 : 1);
  }

  try {
    if (cmd === "init") await cmdInit(flags);
    else if (cmd === "setup") await cmdSetup(rest[0], flags);
    else if (cmd === "install-hooks") await cmdInstallHooks();
    else if (cmd === "install-preview-menu") await cmdInstallPreviewMenu();
    else if (cmd === "link") await cmdLink(rest[0], flags);
    else if (cmd === "push") await cmdPush(rest[0], flags);
    else if (cmd === "pull") await cmdPull(rest[0], flags);
    else if (cmd === "watch") await cmdWatch(rest[0], flags);
    else if (cmd === "status") await cmdStatus(flags);
    else throw new Error(`Unknown command: ${cmd}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

main();
