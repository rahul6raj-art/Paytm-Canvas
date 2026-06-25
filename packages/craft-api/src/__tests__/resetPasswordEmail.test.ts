import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { buildPasswordResetEmailContent, buildPasswordResetUrl } from "../mail/resetPasswordEmail.js";

const saved: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  if (!(key in saved)) saved[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("resetPasswordEmail", () => {
  it("builds reset URL from CRAFT_APP_URL", () => {
    setEnv("CRAFT_APP_URL", "https://craft.example.com/");
    const url = buildPasswordResetUrl("abc123");
    assert.equal(url, "https://craft.example.com/reset-password?token=abc123");
  });

  it("includes reset link in email content", () => {
    const resetUrl = "https://craft.example.com/reset-password?token=abc123";
    const content = buildPasswordResetEmailContent({ resetUrl });
    assert.match(content.subject, /Reset your Paytm Craft password/);
    assert.match(content.text, /abc123/);
    assert.match(content.html, /reset-password\?token=abc123/);
  });
});
