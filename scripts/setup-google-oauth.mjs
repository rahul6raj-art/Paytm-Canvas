#!/usr/bin/env node
/**
 * Configure real Google OAuth for Paytm Craft local dev.
 *
 * Usage:
 *   npm run setup:google-oauth
 *   npm run setup:google-oauth -- --check
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run setup:google-oauth -- --write
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");
const callbackUrl = "http://localhost:3000/api/v1/auth/oauth/google/callback";
const authorizedOrigin = "http://localhost:3000";

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const writeOnly = args.has("--write");
const openConsole = args.has("--open-console") || (!checkOnly && !writeOnly);

function readEnvFile() {
  if (!existsSync(envPath)) return "";
  return readFileSync(envPath, "utf8");
}

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    map.set(trimmed.slice(0, eq), trimmed.slice(eq + 1));
  }
  return map;
}

function upsertEnv(content, entries) {
  let next = content;
  if (!next.endsWith("\n") && next.length > 0) next += "\n";
  for (const [key, value] of entries) {
    const line = `${key}=${value}`;
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(next)) next = next.replace(regex, line);
    else next += `${line}\n`;
  }
  return next;
}

function printSteps() {
  console.log("\nGoogle OAuth setup (one-time)\n");
  console.log("1. Open Google Cloud Console → APIs & Services → Credentials");
  console.log("   https://console.cloud.google.com/apis/credentials");
  console.log("2. Configure OAuth consent screen (External → add your Gmail as Test user if Testing)");
  console.log("   https://console.cloud.google.com/apis/credentials/consent");
  console.log("3. Create OAuth client ID → Web application");
  console.log("   Authorized JavaScript origins:");
  console.log(`     ${authorizedOrigin}`);
  console.log("   Authorized redirect URIs:");
  console.log(`     ${callbackUrl}`);
  console.log("4. Paste Client ID and Client Secret when prompted (or pass --write with env vars)\n");
}

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
  spawnSync(cmd, [url], { stdio: "ignore", shell: platform === "win32" });
}

function currentStatus() {
  const map = parseEnv(readEnvFile());
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || map.get("GOOGLE_CLIENT_ID")?.trim() || "";
  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim() || map.get("GOOGLE_CLIENT_SECRET")?.trim() || "";
  const stateSecret =
    process.env.CRAFT_OAUTH_STATE_SECRET?.trim() || map.get("CRAFT_OAUTH_STATE_SECRET")?.trim() || "";
  return { clientId, clientSecret, stateSecret };
}

async function prompt(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const status = currentStatus();
  const configured = Boolean(status.clientId && status.clientSecret);

  if (checkOnly) {
    console.log(configured ? "[setup:google-oauth] configured" : "[setup:google-oauth] not configured");
    console.log(`  callback: ${callbackUrl}`);
    console.log(`  clientId: ${status.clientId ? `${status.clientId.slice(0, 20)}…` : "(missing)"}`);
    console.log(`  stateSecret: ${status.stateSecret ? "set" : "missing"}`);
    process.exit(configured ? 0 : 1);
  }

  printSteps();
  if (openConsole) {
    openBrowser("https://console.cloud.google.com/apis/credentials/oauthclient");
  }

  let clientId = process.env.GOOGLE_CLIENT_ID?.trim() || status.clientId;
  let clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || status.clientSecret;

  if (!writeOnly || !clientId || !clientSecret) {
    if (process.stdin.isTTY) {
      clientId = await prompt("Google Client ID: ");
      clientSecret = await prompt("Google Client Secret: ");
    } else if (!clientId || !clientSecret) {
      console.error(
        "[setup:google-oauth] No TTY and credentials missing. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, then run with --write",
      );
      process.exit(1);
    }
  }

  if (!clientId || !clientSecret) {
    console.error("[setup:google-oauth] Client ID and Secret are required.");
    process.exit(1);
  }

  const stateSecret = status.stateSecret || randomBytes(32).toString("base64url");
  let content = readEnvFile();
  content = upsertEnv(content, [
    ["CRAFT_APP_URL", authorizedOrigin],
    ["CRAFT_OAUTH_STATE_SECRET", stateSecret],
    ["GOOGLE_CLIENT_ID", clientId],
    ["GOOGLE_CLIENT_SECRET", clientSecret],
  ]);

  if (!content.includes("NEXT_PUBLIC_PAYTM_CRAFT_MODE=api")) {
    content = upsertEnv(content, [["NEXT_PUBLIC_PAYTM_CRAFT_MODE", "api"]]);
  }

  writeFileSync(envPath, content, "utf8");
  console.log("\n[setup:google-oauth] Wrote .env.local");
  console.log("[setup:google-oauth] Restart the dev server: npm run dev");
  console.log(`[setup:google-oauth] Then open ${authorizedOrigin}/login and click Continue with Google\n`);
}

main().catch((err) => {
  console.error("[setup:google-oauth] failed", err);
  process.exit(1);
});
