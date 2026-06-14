import type { WorkspaceRole } from "@prisma/client";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

export type InviteEmailContent = {
  subject: string;
  text: string;
  html: string;
};

export function smtpConfigFromEnv(): SmtpConfig | null {
  const host = process.env.CRAFT_SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(process.env.CRAFT_SMTP_PORT ?? 587);
  const from = process.env.CRAFT_SMTP_FROM?.trim() || "Paytm Craft <noreply@craft.local>";
  const user = process.env.CRAFT_SMTP_USER?.trim();
  const pass = process.env.CRAFT_SMTP_PASS?.trim();
  const secure = process.env.CRAFT_SMTP_SECURE === "1" || port === 465;
  return { host, port, secure, from, ...(user ? { user } : {}), ...(pass ? { pass } : {}) };
}

export function craftAppPublicUrl(): string {
  return process.env.CRAFT_APP_URL?.trim().replace(/\/$/, "") || "http://localhost:3000";
}

export function buildRegisterUrl(): string {
  return `${craftAppPublicUrl()}/`;
}

export function workspaceRoleLabel(role: WorkspaceRole): string {
  switch (role) {
    case "owner":
      return "Owner";
    case "admin":
      return "Admin";
    case "member":
      return "Member";
    case "guest":
      return "Guest";
  }
}

export function buildInviteEmailContent(params: {
  inviteeEmail: string;
  workspaceName: string;
  inviterName: string;
  role: WorkspaceRole;
  registerUrl?: string;
}): InviteEmailContent {
  const registerUrl = params.registerUrl ?? buildRegisterUrl();
  const roleLabel = workspaceRoleLabel(params.role);
  const subject = `You're invited to ${params.workspaceName} on Paytm Craft`;
  const text = [
    `${params.inviterName} invited you to join the "${params.workspaceName}" workspace on Paytm Craft.`,
    `Role: ${roleLabel}`,
    "",
    `Sign up with ${params.inviteeEmail} to accept:`,
    registerUrl,
  ].join("\n");
  const html = [
    `<p><strong>${escapeHtml(params.inviterName)}</strong> invited you to join`,
    `<strong>${escapeHtml(params.workspaceName)}</strong> on Paytm Craft.</p>`,
    `<p>Role: ${escapeHtml(roleLabel)}</p>`,
    `<p><a href="${escapeHtml(registerUrl)}">Create your account</a> with`,
    `<code>${escapeHtml(params.inviteeEmail)}</code> to accept.</p>`,
  ].join(" ");
  return { subject, text, html };
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
