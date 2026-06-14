import type { PrismaClient, WorkspaceRole } from "@prisma/client";

export async function acceptPendingInvitesForUser(
  prisma: PrismaClient,
  userId: string,
  email: string,
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  const pending = await prisma.workspaceInvite.findMany({
    where: { email: normalized, acceptedAt: null },
  });
  if (pending.length === 0) return 0;

  const now = new Date();
  for (const invite of pending) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: invite.workspaceId, userId } },
      create: {
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
      },
      update: { role: invite.role },
    });
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: now },
    });
  }
  return pending.length;
}

export function inviteDto(row: {
  id: string;
  workspaceId: string;
  email: string;
  role: WorkspaceRole;
  invitedByUserId: string;
  createdAt: Date;
}) {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    role: row.role,
    invitedByUserId: row.invitedByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}
