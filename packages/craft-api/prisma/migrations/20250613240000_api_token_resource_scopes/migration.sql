-- Track 23: per-resource API token scopes
ALTER TABLE "api_tokens" ADD COLUMN "resource_scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
