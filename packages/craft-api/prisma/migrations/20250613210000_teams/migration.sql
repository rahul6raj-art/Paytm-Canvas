-- Teams model: org-level access with optional workspace overrides

CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "teams_slug_key" ON "teams"("slug");

CREATE TABLE "team_members" (
    "team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("team_id","user_id")
);

CREATE INDEX "team_members_user_id_idx" ON "team_members"("user_id");

ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "teams" ("id", "name", "slug", "created_at")
VALUES ('team-paytm', 'Paytm', 'paytm', CURRENT_TIMESTAMP);

ALTER TABLE "workspaces" ADD COLUMN "team_id" TEXT;

UPDATE "workspaces" SET "team_id" = 'team-paytm';

ALTER TABLE "workspaces" ALTER COLUMN "team_id" SET NOT NULL;

DROP INDEX "workspaces_slug_key";

CREATE UNIQUE INDEX "workspaces_team_id_slug_key" ON "workspaces"("team_id", "slug");

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "team_members" ("team_id", "user_id", "role", "created_at")
SELECT 'team-paytm', "user_id", "role", "created_at"
FROM "workspace_members"
WHERE "workspace_id" = 'ws-paytm-design'
ON CONFLICT DO NOTHING;
