import type { User } from "@prisma/client";
import { prisma } from "../db.js";
import { buildPasswordResetUrl, sendPasswordResetEmail } from "../mail/sendPasswordResetEmail.js";
import { hashPassword, hashSessionToken, newSessionToken } from "./password.js";

export const PASSWORD_RESET_MESSAGE =
  "If an account exists for that email, we sent password reset instructions.";

const RESET_TTL_MS = 60 * 60 * 1000;

export async function requestPasswordReset(
  email: string,
): Promise<{ message: string; emailSent: boolean }> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    throw new Error("email required");
  }

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user?.passwordHash) {
    return { message: PASSWORD_RESET_MESSAGE, emailSent: false };
  }

  const token = newSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);

  await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
  await prisma.passwordResetToken.create({
    data: {
      id: `pwreset-${token.slice(0, 12)}`,
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const emailSent = await sendPasswordResetEmail({
    to: user.email,
    resetUrl: buildPasswordResetUrl(token),
  });

  return { message: PASSWORD_RESET_MESSAGE, emailSent };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<User> {
  if (newPassword.length < 8) {
    throw new Error("newPassword must be at least 8 characters");
  }

  const trimmed = token.trim();
  if (!trimmed) {
    throw new Error("Reset link is invalid or has expired");
  }

  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashSessionToken(trimmed) },
    include: { user: true },
  });
  if (!row || row.expiresAt.getTime() <= Date.now()) {
    if (row) {
      await prisma.passwordResetToken.delete({ where: { id: row.id } }).catch(() => undefined);
    }
    throw new Error("Reset link is invalid or has expired");
  }

  const updated = await prisma.user.update({
    where: { id: row.userId },
    data: { passwordHash: hashPassword(newPassword) },
  });
  await prisma.passwordResetToken.deleteMany({ where: { userId: row.userId } });
  return updated;
}
