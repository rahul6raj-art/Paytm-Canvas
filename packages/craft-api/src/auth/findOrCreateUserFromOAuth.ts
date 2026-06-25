import type { OAuthProfile } from "@paytm-craft/oauth";
import type { PrismaClient, User } from "@prisma/client";
import { acceptPendingInvitesForUser } from "../access/acceptWorkspaceInvites.js";

export async function findOrCreateUserFromOAuth(
  prisma: PrismaClient,
  profile: OAuthProfile,
): Promise<User> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });
  if (linked) {
    const patch: { displayName?: string; avatarUrl?: string | null } = {};
    if (profile.displayName && linked.user.displayName !== profile.displayName) {
      patch.displayName = profile.displayName;
    }
    if (profile.avatarUrl && linked.user.avatarUrl !== profile.avatarUrl) {
      patch.avatarUrl = profile.avatarUrl;
    }
    if (Object.keys(patch).length > 0) {
      return prisma.user.update({ where: { id: linked.user.id }, data: patch });
    }
    return linked.user;
  }

  const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (existingByEmail) {
    await prisma.oAuthAccount.create({
      data: {
        id: `oauth-${profile.provider}-${profile.providerAccountId}`,
        userId: existingByEmail.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
      },
    });
    const patch: { avatarUrl?: string | null } = {};
    if (profile.avatarUrl && !existingByEmail.avatarUrl) patch.avatarUrl = profile.avatarUrl;
    if (Object.keys(patch).length > 0) {
      return prisma.user.update({ where: { id: existingByEmail.id }, data: patch });
    }
    return existingByEmail;
  }

  const id = `user-${profile.email.split("@")[0]}-${Date.now().toString(36)}`;
  const user = await prisma.user.create({
    data: {
      id,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl ?? null,
      oauthAccounts: {
        create: {
          id: `oauth-${profile.provider}-${profile.providerAccountId}`,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        },
      },
    },
  });

  await acceptPendingInvitesForUser(prisma, user.id, profile.email);
  return user;
}
