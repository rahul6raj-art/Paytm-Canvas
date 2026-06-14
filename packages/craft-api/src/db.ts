import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { craftPrisma?: PrismaClient };

export const prisma =
  globalForPrisma.craftPrisma ??
  new PrismaClient({
    log: process.env.CRAFT_API_PRISMA_LOG === "1" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.craftPrisma = prisma;
}
