import type { User } from "@prisma/client";
import { sessionCookieSecure } from "../config.js";
import { prisma } from "../db.js";
import { hashSessionToken, newSessionToken } from "./password.js";

const SESSION_COOKIE = "craft_sid";
const SESSION_DAYS = 30;

export { SESSION_COOKIE };

export function sessionMaxAgeSeconds(): number {
  return SESSION_DAYS * 24 * 60 * 60;
}

export function sessionExpiresAt(): Date {
  return new Date(Date.now() + sessionMaxAgeSeconds() * 1000);
}

export function buildSessionCookie(token: string): string {
  const maxAge = sessionMaxAgeSeconds();
  const secure = sessionCookieSecure() ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearSessionCookie(): string {
  const secure = sessionCookieSecure() ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    out[key] = decodeURIComponent(value);
  }
  return out;
}

export async function createSession(userId: string): Promise<string> {
  const token = newSessionToken();
  await prisma.session.create({
    data: {
      id: `sess-${token.slice(0, 12)}`,
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt: sessionExpiresAt(),
    },
  });
  return token;
}

export async function findUserBySessionToken(token: string): Promise<User | null> {
  const row = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!row) return null;
  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: row.id } }).catch(() => undefined);
    return null;
  }
  return row.user;
}

export async function revokeSessionToken(token: string): Promise<void> {
  await prisma.session
    .delete({ where: { tokenHash: hashSessionToken(token) } })
    .catch(() => undefined);
}
