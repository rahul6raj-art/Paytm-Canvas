/** Docker full-stack bundle documented in docs/release-track.md */
export const DOCKER_COMPOSE_FILE = "docker-compose.yml";

export const DOCKER_COMPOSE_PROD_FILE = "docker-compose.prod.yml";

export const DOCKER_STACK_SETUP_SCRIPT = "scripts/stack-setup.mjs";

export const DOCKER_STACK_SERVICES = [
  "postgres",
  "redis",
  "minio",
  "mailpit",
  "craft-api",
  "craft-realtime",
] as const;

export const DOCKER_STACK_NPM_SCRIPTS = [
  "stack:up",
  "stack:setup",
  "stack:down",
  "stack:prod",
] as const;

/** Documented in docs/release-track.md */
export const DOCKER_STACK_DOC_SCRIPTS = ["stack:up", "stack:setup"] as const;

export const DOCKER_STACK_SETUP_MARKERS = [
  "db-setup.mjs",
  "storage-setup.mjs",
] as const;

export const DOCKER_STACK_DOCKERFILES = [
  "packages/craft-api/Dockerfile",
  "packages/craft-realtime/Dockerfile",
] as const;
