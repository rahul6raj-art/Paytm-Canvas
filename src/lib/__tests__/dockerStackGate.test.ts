import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  DOCKER_COMPOSE_FILE,
  DOCKER_COMPOSE_PROD_FILE,
  DOCKER_STACK_DOCKERFILES,
  DOCKER_STACK_DOC_SCRIPTS,
  DOCKER_STACK_NPM_SCRIPTS,
  DOCKER_STACK_SERVICES,
  DOCKER_STACK_SETUP_MARKERS,
  DOCKER_STACK_SETUP_SCRIPT,
} from "@/lib/dockerStackManifest";

const root = process.cwd();

describe("dockerStackGate", () => {
  it("docker-compose defines the full local stack", () => {
    assert.ok(existsSync(join(root, DOCKER_COMPOSE_FILE)));
    assert.ok(existsSync(join(root, DOCKER_COMPOSE_PROD_FILE)));
    const compose = readFileSync(join(root, DOCKER_COMPOSE_FILE), "utf8");
    for (const service of DOCKER_STACK_SERVICES) {
      assert.match(compose, new RegExp(`^  ${service}:`, "m"));
    }
    assert.match(compose, /craft-api:\s*\n\s*build:/);
    assert.match(compose, /craft-realtime:\s*\n\s*build:/);
  });

  it("stack:setup chains database and object storage bootstrap", () => {
    assert.ok(existsSync(join(root, DOCKER_STACK_SETUP_SCRIPT)));
    const setup = readFileSync(join(root, DOCKER_STACK_SETUP_SCRIPT), "utf8");
    for (const marker of DOCKER_STACK_SETUP_MARKERS) {
      assert.match(setup, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    for (const rel of DOCKER_STACK_DOCKERFILES) {
      assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
    }
  });

  it("release-track documents stack scripts", () => {
    const doc = readFileSync(join(root, "docs/release-track.md"), "utf8");
    for (const script of DOCKER_STACK_DOC_SCRIPTS) {
      assert.match(doc, new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
    assert.doesNotMatch(doc, /\(planned\)/);
  });

  it("package.json exposes docker stack scripts", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    for (const script of DOCKER_STACK_NPM_SCRIPTS) {
      assert.ok(pkg.scripts?.[script], `missing npm script ${script}`);
    }
    assert.match(pkg.scripts!["stack:up"]!, /docker compose/);
    assert.match(pkg.scripts!["stack:setup"]!, /stack-setup/);
  });
});
