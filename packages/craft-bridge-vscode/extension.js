const vscode = require("vscode");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

/** @type {vscode.OutputChannel | undefined} */
let output;

/** @type {vscode.StatusBarItem | undefined} */
let statusBar;

const MANUAL_SYNC_HINT =
  "Edit on canvas, then right-click the frame → Send to code (.tsx/.html + .css). Reload here with Shift+Alt+C U.";

/** @param {string} msg */
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  output?.appendLine(line);
}

/** @param {string} cwd */
function readManifest(cwd) {
  const file = path.join(cwd, "craft.link.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("craftBridge");
  const captureTheme = cfg.get("captureTheme", "light");
  return {
    craftUrl: (cfg.get("craftUrl", "http://localhost:3000") || "").replace(/\/$/, ""),
    cliPath: cfg.get("cliPath", "") || "",
    openBrowserOnPush: cfg.get("openBrowserOnPush", true) !== false,
    bridgeToken: cfg.get("bridgeToken", "") || process.env.CRAFT_BRIDGE_TOKEN || "",
    captureTheme: captureTheme === "dark" ? "dark" : "light",
  };
}

/** @param {vscode.ExtensionContext} context */
function resolveCli(context) {
  const { cliPath } = getConfig();
  if (cliPath.trim()) {
    return { bin: cliPath.trim(), prefixArgs: [] };
  }

  const bundled = path.join(context.extensionPath, "vendor", "bridge", "cli.mjs");
  if (fs.existsSync(bundled)) {
    return { bin: process.execPath, prefixArgs: [bundled] };
  }

  const folders = vscode.workspace.workspaceFolders;
  if (folders?.length) {
    const root = folders[0].uri.fsPath;
    const localBin = path.join(root, "node_modules", ".bin", "craft-bridge");
    if (fs.existsSync(localBin)) return { bin: localBin, prefixArgs: [] };
    const pkgCli = path.join(root, "node_modules", "@paytm-craft", "bridge", "cli.mjs");
    if (fs.existsSync(pkgCli)) return { bin: process.execPath, prefixArgs: [pkgCli] };
  }

  return { bin: "craft-bridge", prefixArgs: [] };
}

/** @param {vscode.ExtensionContext} context @param {string[]} args @param {string} cwd */
function runBridge(context, args, cwd) {
  const { bin, prefixArgs } = resolveCli(context);
  const env = { ...process.env };
  const { bridgeToken, craftUrl, captureTheme } = getConfig();
  if (bridgeToken) env.CRAFT_BRIDGE_TOKEN = bridgeToken;
  if (craftUrl) env.CRAFT_BRIDGE_URL = craftUrl;
  env.CRAFT_BRIDGE_CAPTURE_THEME = captureTheme;

  log(`$ ${bin} ${[...prefixArgs, ...args].join(" ")}`);
  return new Promise((resolve, reject) => {
    execFile(bin, [...prefixArgs, ...args], { cwd, env, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (stdout?.trim()) log(stdout.trim());
      if (stderr?.trim()) log(stderr.trim());
      if (err) reject(new Error(stderr?.trim() || err.message));
      else resolve(stdout?.trim() ?? "");
    });
  });
}

/** @param {vscode.Uri | undefined} uri */
function workspaceRoot(uri) {
  if (uri) {
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    if (folder) return { cwd: folder.uri.fsPath, folder };
    return { cwd: path.dirname(uri.fsPath), folder: undefined };
  }
  const folder = vscode.workspace.workspaceFolders?.[0];
  return { cwd: folder?.uri.fsPath, folder };
}

/** @param {vscode.Uri} uri */
function isDirectoryUri(uri) {
  try {
    return fs.statSync(uri.fsPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Page folder push: directory, .tsx/.html entry, or .css → parent folder.
 * @param {vscode.Uri | undefined} uri
 * @returns {vscode.Uri | undefined}
 */
function resolvePushUri(uri) {
  if (!uri) return undefined;
  if (isDirectoryUri(uri)) return uri;
  const ext = path.extname(uri.fsPath).toLowerCase();
  if (ext === ".css") return vscode.Uri.file(path.dirname(uri.fsPath));
  return uri;
}

/** @param {vscode.Uri} fileUri */
function relativeSourcePath(fileUri, cwd) {
  const manifest = readManifest(cwd);
  const repoRoot = path.resolve(cwd, manifest?.repoRoot ?? cwd);
  const rel = path.relative(repoRoot, fileUri.fsPath).replace(/\\/g, "/");
  if (rel.startsWith("..")) {
    throw new Error("Craft Bridge: path must be inside repoRoot from craft.link.json");
  }
  return { rel, repoRoot };
}

/** @param {Response} res */
async function readJsonBody(res) {
  const text = await res.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? `Craft returned invalid JSON (${res.status}). Restart Craft: npm run dev:clean`
        : `Craft error (${res.status}): ${text.slice(0, 160)}`,
    );
  }
}

/** @param {vscode.ExtensionContext} context */
async function refreshStatus(context) {
  if (!statusBar) return;
  const { craftUrl } = getConfig();
  try {
    const headers = {};
    const { bridgeToken } = getConfig();
    if (bridgeToken) headers.Authorization = `Bearer ${bridgeToken}`;
    const res = await fetch(`${craftUrl}/api/craft-bridge/status`, { headers });
    const body = await readJsonBody(res);
    if (body.enabled) {
      statusBar.text = "$(check) Craft";
      statusBar.tooltip = "Craft bridge online — Send to code writes .tsx/.html + .css";
    } else {
      statusBar.text = "$(warning) Craft";
      statusBar.tooltip = "Craft bridge disabled — set CRAFT_BRIDGE_ENABLED=1";
    }
  } catch {
    statusBar.text = "$(debug-disconnect) Craft";
    statusBar.tooltip = `Craft unreachable at ${craftUrl}`;
  }
  statusBar.show();
}

/** @param {vscode.ExtensionContext} context */
async function ensureCraftReachable(context) {
  const { craftUrl } = getConfig();
  try {
    const headers = {};
    const { bridgeToken } = getConfig();
    if (bridgeToken) headers.Authorization = `Bearer ${bridgeToken}`;
    const res = await fetch(`${craftUrl}/api/craft-bridge/status`, { headers });
    const body = await readJsonBody(res);
    if (!body.enabled) {
      throw new Error(
        "Craft bridge is disabled. Set CRAFT_BRIDGE_ENABLED=1 in Craft .env.local and restart npm run dev.",
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/fetch failed|ECONNREFUSED|ENOTFOUND|Cannot reach/i.test(msg)) {
      throw new Error(
        `Cannot reach Craft at ${craftUrl}. Start Craft first:\n  cd ~/Downloads/Craft-main && npm run dev`,
      );
    }
    throw e;
  }
}

/** @param {string} out @param {string} craftUrl */
function parseOpenUrlFromCliOutput(out, craftUrl) {
  const match = out.match(/^\s*Open:\s*(\S+)/m);
  if (!match?.[1]) return `${craftUrl}/editor?bridgeImport=1`;
  const raw = match[1];
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${craftUrl}${raw.startsWith("/") ? raw : `/${raw}`}`;
}

/** @param {vscode.ExtensionContext} context @param {vscode.Uri | undefined} fileUri @param {"push"|"setup"} mode */
async function pushSource(context, fileUri, mode = "push") {
  const uri = resolvePushUri(fileUri);
  if (!uri) {
    vscode.window.showErrorMessage(
      "Craft Bridge: select a page folder or .tsx / .html file (companion .css is included automatically).",
    );
    return;
  }
  const { cwd } = workspaceRoot(uri);
  if (!cwd) {
    vscode.window.showErrorMessage("Craft Bridge: open a workspace folder.");
    return;
  }

  let manifest = readManifest(cwd);
  if (!manifest) {
    const pick = await vscode.window.showWarningMessage(
      "No craft.link.json found. Initialize Craft Bridge for this project?",
      "Init now",
      "Cancel",
    );
    if (pick !== "Init now") return;
    await runBridge(context, ["init", "--with-hooks", "--craft-url", getConfig().craftUrl], cwd);
    manifest = readManifest(cwd);
    if (!manifest) return;
  }

  let rel;
  let repoRoot;
  try {
    ({ rel, repoRoot } = relativeSourcePath(uri, cwd));
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    return;
  }

  const cliCmd = mode === "setup" ? "setup" : "push";
  const kind = isDirectoryUri(uri) ? "page folder" : path.basename(uri.fsPath);
  const title = mode === "setup" ? `Setting up ${rel}…` : `Pushing ${kind} to Craft…`;

  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title },
    async () => {
      try {
        await ensureCraftReachable(context);
        if (mode === "push") {
          await runBridge(
            context,
            ["link", rel, "--repo", repoRoot, "--sync", "manual", "--no-watch"],
            cwd,
          );
        }
        const out = await runBridge(context, [cliCmd, rel, "--repo", repoRoot, "--no-open"], cwd);
        const { craftUrl, openBrowserOnPush } = getConfig();
        const openTarget = parseOpenUrlFromCliOutput(out, craftUrl);
        if (openBrowserOnPush) {
          vscode.env.openExternal(vscode.Uri.parse(openTarget));
        }
        const cssNote = /Page CSS:/i.test(out) ? " (with CSS)" : "";
        vscode.window.showInformationMessage(
          `Craft Bridge: ${rel} is on canvas${cssNote}. ${MANUAL_SYNC_HINT}`,
        );
        await refreshStatus(context);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        vscode.window.showErrorMessage(`Craft Bridge failed: ${msg}`);
        log(`ERROR ${cliCmd}: ${msg}`);
      }
    },
  );
}

/** @param {vscode.Uri | undefined} fileUri */
async function reloadSourceFromCraft(fileUri) {
  const editor = vscode.window.activeTextEditor;
  const uri = fileUri ?? editor?.document.uri;
  if (!uri) {
    vscode.window.showErrorMessage("Craft Bridge: open the linked source file first.");
    return;
  }

  const { cwd } = workspaceRoot(uri);
  if (!cwd) return;

  let rel;
  try {
    ({ rel } = relativeSourcePath(uri, cwd));
  } catch (e) {
    vscode.window.showErrorMessage(e instanceof Error ? e.message : String(e));
    return;
  }

  const pick = await vscode.window.showInformationMessage(
    `Reload ${rel} from disk after Send to code in Craft?`,
    "Reload file",
    "Cancel",
  );
  if (pick !== "Reload file") return;

  if (editor && editor.document.uri.fsPath === uri.fsPath) {
    const edited = editor.document.isDirty;
    if (edited) {
      const savePick = await vscode.window.showWarningMessage(
        "This file has unsaved editor changes. Reload anyway?",
        "Reload",
        "Cancel",
      );
      if (savePick !== "Reload") return;
    }
    await vscode.commands.executeCommand("workbench.action.files.revert");
    vscode.window.showInformationMessage(`Craft Bridge: reloaded ${rel}`);
    return;
  }

  vscode.window.showInformationMessage(
    `Craft Bridge: open ${rel} in the editor, then run Reload Source from Craft again.`,
  );
}

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  output = vscode.window.createOutputChannel("Craft Bridge");
  context.subscriptions.push(output);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
  statusBar.command = "craft-bridge.openCraft";
  context.subscriptions.push(statusBar);
  void refreshStatus(context);

  const refreshTimer = setInterval(() => void refreshStatus(context), 30_000);
  context.subscriptions.push({ dispose: () => clearInterval(refreshTimer) });

  context.subscriptions.push(
    vscode.commands.registerCommand("craft-bridge.push", (uri) => pushSource(context, uri, "push")),
    vscode.commands.registerCommand("craft-bridge.pushActive", () =>
      pushSource(context, vscode.window.activeTextEditor?.document.uri, "push"),
    ),
    vscode.commands.registerCommand("craft-bridge.pushFolder", (uri) => pushSource(context, uri, "push")),
    vscode.commands.registerCommand("craft-bridge.setup", (uri) =>
      pushSource(context, uri ?? vscode.window.activeTextEditor?.document.uri, "setup"),
    ),
    vscode.commands.registerCommand("craft-bridge.pullActive", (uri) =>
      reloadSourceFromCraft(uri ?? vscode.window.activeTextEditor?.document.uri),
    ),

    vscode.commands.registerCommand("craft-bridge.init", async () => {
      const { cwd } = workspaceRoot();
      if (!cwd) {
        vscode.window.showErrorMessage("Craft Bridge: open a workspace folder first.");
        return;
      }
      try {
        await runBridge(
          context,
          ["init", "--with-hooks", "--craft-url", getConfig().craftUrl],
          cwd,
        );
        vscode.window.showInformationMessage(
          `Craft Bridge: craft.link.json ready (manual sync). ${MANUAL_SYNC_HINT}`,
        );
      } catch (e) {
        vscode.window.showErrorMessage(`Craft Bridge init failed: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand("craft-bridge.installHooks", async () => {
      const { cwd } = workspaceRoot();
      if (!cwd) return;
      try {
        await runBridge(context, ["install-hooks"], cwd);
        vscode.window.showInformationMessage("Craft Bridge: hooks installed — restart Cursor");
      } catch (e) {
        vscode.window.showErrorMessage(`Craft Bridge: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand("craft-bridge.installPreviewMenu", async () => {
      const { cwd } = workspaceRoot();
      if (!cwd) return;
      try {
        await runBridge(context, ["install-preview-menu"], cwd);
        vscode.window.showInformationMessage(
          "Craft Bridge: right-click anywhere in the live app preview → Push to Craft canvas (all ?screen= routes)",
        );
      } catch (e) {
        vscode.window.showErrorMessage(`Craft Bridge: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand("craft-bridge.link", async (uri) => {
      const fileUri = resolvePushUri(uri ?? vscode.window.activeTextEditor?.document.uri);
      const { cwd } = workspaceRoot(fileUri);
      if (!cwd || !fileUri) return;
      try {
        const { rel, repoRoot } = relativeSourcePath(fileUri, cwd);
        await runBridge(
          context,
          ["link", rel, "--repo", repoRoot, "--sync", "manual", "--no-watch"],
          cwd,
        );
        vscode.window.showInformationMessage(`Craft Bridge: linked ${rel} (+ companion .css when present)`);
      } catch (e) {
        vscode.window.showErrorMessage(`Craft Bridge link failed: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand("craft-bridge.status", async () => {
      const { cwd } = workspaceRoot();
      if (!cwd) return;
      output.show(true);
      try {
        await runBridge(context, ["status"], cwd);
        await refreshStatus(context);
      } catch (e) {
        log(`status error: ${e.message}`);
      }
    }),

    vscode.commands.registerCommand("craft-bridge.openCraft", () => {
      const { craftUrl } = getConfig();
      vscode.env.openExternal(vscode.Uri.parse(`${craftUrl}/editor`));
    }),

    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("craftBridge")) void refreshStatus(context);
    }),
  );

  log("Craft Bridge v0.1.12 — push any preview screen, stable editable layers on canvas");
}

function deactivate() {
  statusBar?.dispose();
}

module.exports = { activate, deactivate };
