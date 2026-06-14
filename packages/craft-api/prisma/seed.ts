import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/auth/password.js";

const prisma = new PrismaClient();

const ROOT_KEY = "__root__";

function emptyDocument(name: string) {
  return {
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    nodes: {},
    childOrder: { [ROOT_KEY]: [] },
    selectedIds: [] as string[],
    comments: [] as unknown[],
  };
}

async function main() {
  const now = new Date();

  await prisma.user.upsert({
    where: { id: "user-you" },
    update: { passwordHash: hashPassword("craft-dev") },
    create: {
      id: "user-you",
      email: "rahul.verma@paytm.com",
      displayName: "Rahul Verma",
      passwordHash: hashPassword("craft-dev"),
    },
  });

  const teammates = [
    { id: "u2", email: "aisha.khan@paytm.com", displayName: "Aisha Khan" },
    { id: "u3", email: "dev.sharma@paytm.com", displayName: "Dev Sharma" },
    { id: "u4", email: "meera@paytm.com", displayName: "Meera N." },
  ] as const;
  for (const t of teammates) {
    await prisma.user.upsert({
      where: { id: t.id },
      update: { email: t.email, displayName: t.displayName },
      create: { id: t.id, email: t.email, displayName: t.displayName },
    });
  }

  await prisma.team.upsert({
    where: { id: "team-paytm" },
    update: { name: "Paytm", slug: "paytm" },
    create: { id: "team-paytm", name: "Paytm", slug: "paytm" },
  });

  await prisma.team.upsert({
    where: { id: "team-labs" },
    update: { name: "Craft Labs", slug: "craft-labs" },
    create: { id: "team-labs", name: "Craft Labs", slug: "craft-labs" },
  });

  const teamMemberships: Array<{ teamId: string; userId: string; role: "owner" | "admin" | "member" | "guest" }> = [
    { teamId: "team-paytm", userId: "user-you", role: "owner" },
    { teamId: "team-paytm", userId: "u2", role: "member" },
    { teamId: "team-paytm", userId: "u3", role: "member" },
    { teamId: "team-paytm", userId: "u4", role: "guest" },
    { teamId: "team-labs", userId: "user-you", role: "owner" },
  ];
  for (const m of teamMemberships) {
    await prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: m.teamId, userId: m.userId } },
      update: { role: m.role },
      create: m,
    });
  }

  const workspaces = [
    { id: "ws-personal", teamId: "team-paytm", name: "Personal", slug: "personal" },
    { id: "ws-paytm-design", teamId: "team-paytm", name: "Paytm Design", slug: "paytm-design" },
    { id: "ws-product", teamId: "team-paytm", name: "Product Team", slug: "product-team" },
    { id: "ws-experiments", teamId: "team-paytm", name: "Experiments", slug: "experiments" },
    { id: "ws-labs", teamId: "team-labs", name: "Labs", slug: "labs" },
  ];
  for (const w of workspaces) {
    await prisma.workspace.upsert({
      where: { id: w.id },
      update: { name: w.name, slug: w.slug, teamId: w.teamId },
      create: w,
    });
  }

  const memberships: Array<{ workspaceId: string; userId: string; role: "owner" | "admin" | "member" | "guest" }> = [
    { workspaceId: "ws-personal", userId: "user-you", role: "owner" },
    { workspaceId: "ws-paytm-design", userId: "user-you", role: "owner" },
    { workspaceId: "ws-product", userId: "user-you", role: "owner" },
    { workspaceId: "ws-experiments", userId: "user-you", role: "owner" },
    { workspaceId: "ws-labs", userId: "user-you", role: "owner" },
    { workspaceId: "ws-paytm-design", userId: "u2", role: "member" },
    { workspaceId: "ws-paytm-design", userId: "u3", role: "member" },
    { workspaceId: "ws-paytm-design", userId: "u4", role: "guest" },
    { workspaceId: "ws-product", userId: "u2", role: "member" },
  ];
  for (const m of memberships) {
    await prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId: m.workspaceId, userId: m.userId } },
      update: { role: m.role },
      create: m,
    });
  }

  const seedFiles = [
    {
      id: "api-file-paytm-1",
      workspaceId: "ws-paytm-design",
      name: "Mobile App Flow",
      documentJson: emptyDocument("Mobile App Flow"),
    },
    {
      id: "api-file-paytm-2",
      workspaceId: "ws-paytm-design",
      name: "Marketing landing",
      documentJson: emptyDocument("Marketing landing"),
    },
    {
      id: "api-file-product-1",
      workspaceId: "ws-product",
      name: "Checkout v2",
      documentJson: emptyDocument("Checkout v2"),
    },
    {
      id: "api-file-personal-1",
      workspaceId: "ws-personal",
      name: "Scratch pad",
      documentJson: null,
    },
    {
      id: "api-file-labs-1",
      workspaceId: "ws-labs",
      name: "Prototype sandbox",
      documentJson: emptyDocument("Prototype sandbox"),
    },
  ];

  for (const f of seedFiles) {
    await prisma.file.upsert({
      where: { id: f.id },
      update: {
        name: f.name,
        documentJson: f.documentJson ?? undefined,
        revision: "1",
      },
      create: {
        id: f.id,
        workspaceId: f.workspaceId,
        name: f.name,
        documentJson: f.documentJson ?? undefined,
        revision: "1",
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await prisma.comment.upsert({
    where: { id: "api-comment-1" },
    update: {},
    create: {
      id: "api-comment-1",
      fileId: "api-file-paytm-1",
      body: "Consider tightening header spacing on small screens.",
      resolved: false,
    },
  });
  await prisma.comment.upsert({
    where: { id: "api-comment-2" },
    update: {},
    create: {
      id: "api-comment-2",
      fileId: "api-file-paytm-1",
      body: "LGTM for the grid rhythm.",
      resolved: true,
    },
  });

  console.log("[craft-api] seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
