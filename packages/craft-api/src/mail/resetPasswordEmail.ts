import { craftAppPublicUrl } from "./inviteEmail.js";

export type PasswordResetEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function buildPasswordResetUrl(token: string): string {
  const base = craftAppPublicUrl();
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export function buildPasswordResetEmailContent(params: { resetUrl: string }): PasswordResetEmailContent {
  const subject = "Reset your Paytm Craft password";
  const text = [
    "You requested a password reset for your Paytm Craft account.",
    "",
    "Open this link to choose a new password (expires in 1 hour):",
    params.resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
  ].join("\n");
  const html = [
    "<p>You requested a password reset for your Paytm Craft account.</p>",
    `<p><a href="${escapeHtml(params.resetUrl)}">Reset your password</a></p>`,
    "<p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>",
  ].join("");
  return { subject, text, html };
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
