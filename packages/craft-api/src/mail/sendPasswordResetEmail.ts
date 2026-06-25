import nodemailer from "nodemailer";
import { smtpConfigFromEnv } from "./inviteEmail.js";
import { buildPasswordResetEmailContent, type PasswordResetEmailContent } from "./resetPasswordEmail.js";

export { buildPasswordResetEmailContent, buildPasswordResetUrl } from "./resetPasswordEmail.js";

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
}): Promise<boolean> {
  const smtp = smtpConfigFromEnv();
  if (!smtp) {
    console.log(
      `[craft-api] password reset email skipped (CRAFT_SMTP_HOST unset) → ${params.to}`,
    );
    return false;
  }

  const content = buildPasswordResetEmailContent({ resetUrl: params.resetUrl });
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass ?? "" } } : {}),
  });
  await transport.sendMail({
    from: smtp.from,
    to: params.to,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return true;
}

export type { PasswordResetEmailContent };
