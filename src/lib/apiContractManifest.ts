/**
 * Canonical mock Next.js Route Handler paths (`/api/v1/*`).
 * Keep aligned with docs/api-contracts.md and src/app/api/v1/.
 */
export const MOCK_V1_ROUTE_FILES = [
  "src/app/api/v1/me/route.ts",
  "src/app/api/v1/workspaces/route.ts",
  "src/app/api/v1/workspaces/[workspaceId]/members/route.ts",
  "src/app/api/v1/workspaces/[workspaceId]/invites/route.ts",
  "src/app/api/v1/workspaces/[workspaceId]/assets/route.ts",
  "src/app/api/v1/teams/route.ts",
  "src/app/api/v1/teams/[teamId]/members/route.ts",
  "src/app/api/v1/files/route.ts",
  "src/app/api/v1/files/[fileId]/route.ts",
  "src/app/api/v1/files/[fileId]/versions/route.ts",
  "src/app/api/v1/files/[fileId]/versions/[versionId]/route.ts",
  "src/app/api/v1/files/[fileId]/versions/[versionId]/restore/route.ts",
  "src/app/api/v1/comments/route.ts",
  "src/app/api/v1/comments/[commentId]/route.ts",
  "src/app/api/v1/auth/tokens/route.ts",
  "src/app/api/v1/auth/tokens/[tokenId]/route.ts",
] as const;

/**
 * Route markers that must exist on craft-api `/v1` (packages/craft-api/src/routes/v1.ts + mounts).
 */
export const CRAFT_API_V1_ROUTE_MARKERS = [
  'v1Router.get("/me"',
  'v1Router.get("/workspaces"',
  'v1Router.get("/files"',
  'v1Router.post("/files"',
  'v1Router.get("/files/:fileId"',
  'v1Router.put("/files/:fileId"',
  'v1Router.get("/comments"',
  'v1Router.post("/comments"',
  'v1Router.patch("/comments/:commentId"',
  'v1Router.delete("/comments/:commentId"',
  'v1Router.get("/files/:fileId/versions"',
] as const;

export const CRAFT_API_AUTH_ROUTE_MARKERS = [
  'authRouter.post("/register"',
  'authRouter.post("/login"',
  'authRouter.post("/logout"',
  'authRouter.get("/me"',
] as const;

export const CRAFT_API_TOKEN_ROUTE_MARKERS = [
  'apiTokensRouter.get("/"',
  'apiTokensRouter.post("/"',
  'apiTokensRouter.delete("/:tokenId"',
] as const;
