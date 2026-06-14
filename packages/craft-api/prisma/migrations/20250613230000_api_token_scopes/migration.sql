-- Track 21: scoped API tokens (read vs write)

CREATE TYPE "ApiTokenScope" AS ENUM ('read', 'write');

ALTER TABLE "api_tokens" ADD COLUMN "scope" "ApiTokenScope" NOT NULL DEFAULT 'write';
