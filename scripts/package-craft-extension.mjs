#!/usr/bin/env node
/**
 * Bundle craft-bridge CLI into the VS Code/Cursor extension and optionally pack .vsix
 * Usage: node scripts/package-craft-extension.mjs [--vsix]
 */
import { cpSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const extDir = path.join(root, "packages/craft-bridge-vscode");
const vendorDir = path.join(extDir, "vendor", "bridge");
const bridgePkg = path.join(root, "packages/craft-bridge");
const packVsix = process.argv.includes("--vsix");

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("==> Bundling craft-bridge into extension…");
if (existsSync(path.join(extDir, "vendor"))) {
  rmSync(path.join(extDir, "vendor"), { recursive: true, force: true });
}
mkdirSync(vendorDir, { recursive: true });
cpSync(path.join(bridgePkg, "cli.mjs"), path.join(vendorDir, "cli.mjs"));
cpSync(path.join(bridgePkg, "templates"), path.join(vendorDir, "templates"), { recursive: true });
console.log("    vendor/bridge ready");

if (packVsix) {
  const version = JSON.parse(readFileSync(path.join(extDir, "package.json"), "utf8")).version;
  const vsixName = `craft-bridge-${version}.vsix`;
  console.log("==> Packaging .vsix…");
  run("npx", ["@vscode/vsce", "package", "--no-dependencies", "--allow-missing-repository", "--allow-unused-files-pattern"], extDir);
  const vsixPath = path.join(extDir, vsixName);
  console.log(existsSync(vsixPath) ? `\n✓ ${vsixName}` : `\n✓ VSIX created in packages/craft-bridge-vscode/`);
  console.log(`
Install in Cursor (pick one):
  1. Cmd+Shift+P → "Extensions: Install from VSIX…"
     → select packages/craft-bridge-vscode/${vsixName}
  2. Cmd+Shift+P → "Shell Command: Install 'cursor' command in PATH"
     → then: cursor --install-extension packages/craft-bridge-vscode/${vsixName}
  3. /Applications/Cursor.app/Contents/Resources/app/bin/cursor --install-extension packages/craft-bridge-vscode/${vsixName}
`);
} else {
  console.log(`
Extension folder ready: packages/craft-bridge-vscode

Install in Cursor (development):
  Cmd+Shift+P → "Developer: Install Extension from Location…"
  → select packages/craft-bridge-vscode

Or pack VSIX:
  node scripts/package-craft-extension.mjs --vsix
`);
}
