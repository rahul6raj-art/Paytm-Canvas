import nodemailer from "nodemailer";
import type { WorkspaceRole } from "@prisma/client";
import {
  buildInviteEmailContent,
  smtpConfigFromEnv,
  type SmtpConfig,
} from "./inviteEmail.js";

export { buildInviteEmailContent, buildRegisterUrl, craftAppPublicUrl, smtpConfigFromEnv };

export async function sendWorkspaceInviteEmail(params: {
  inviteeEmail: string;
  workspaceName: string;
  inviterName: string;
  role: WorkspaceRole;
}): Promise<boolean> {
  const smtp = smtpConfigFromEnv();
  if (!smtp) {
    console.log(
      `[craft-api] invite email skipped (CRAFT_SMTP_HOST unset) → ${params.inviteeEmail} @ ${params.workspaceName}`,
    );
    return false;
  }

  const content = buildInviteEmailContent(params);
  const transport = createTransport(smtp);
  await transport.sendMail({
    from: smtp.from,
    to: params.inviteeEmail,
    subject: content.subject,
    text: content.text,
    html: content.html,
  });
  return true;
}

function createTransport(smtp: SmtpConfig) {
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    ...(smtp.user ? { auth: { user: smtp.user, pass: smtp.pass ?? "" } } : {}),
  });
}
