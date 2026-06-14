import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

function read(rel: string): string {
  const path = join(root, rel);
  assert.ok(existsSync(path), `missing ${rel}`);
  return readFileSync(path, "utf8");
}

describe("deployManifests", () => {
  it("includes k8s workloads with health probes", () => {
    const api = read("deploy/k8s/craft-api-deployment.yaml");
    const sync = read("deploy/k8s/craft-realtime-deployment.yaml");
    assert.match(api, /name: craft-api/);
    assert.match(api, /path: \/health/);
    assert.match(sync, /name: craft-realtime/);
    assert.match(sync, /CRAFT_SYNC_PORT/);
  });

  it("configures production auth in k8s configmap", () => {
    const cm = read("deploy/k8s/configmap.yaml");
    assert.match(cm, /CRAFT_API_ALLOW_ANON: "0"/);
    assert.match(cm, /CRAFT_SYNC_ALLOW_ANON: "0"/);
    assert.match(cm, /CRAFT_API_CORS_ORIGIN/);
  });

  it("documents required secrets template", () => {
    const secrets = read("deploy/k8s/secrets.example.env");
    assert.match(secrets, /DATABASE_URL=/);
    assert.match(secrets, /REDIS_URL=/);
    assert.match(secrets, /S3_ACCESS_KEY=/);
  });

  it("includes ingress with websocket timeouts", () => {
    const ingress = read("deploy/k8s/ingress.yaml");
    assert.match(ingress, /craft-api/);
    assert.match(ingress, /craft-realtime/);
    assert.match(ingress, /proxy-read-timeout/);
  });

  it("includes fly.toml apps with health checks", () => {
    const apiFly = read("deploy/fly/craft-api.fly.toml");
    const syncFly = read("deploy/fly/craft-realtime.fly.toml");
    assert.match(apiFly, /app = "craft-api"/);
    assert.match(apiFly, /path = "\/health"/);
    assert.match(apiFly, /CRAFT_API_ALLOW_ANON = "0"/);
    assert.match(syncFly, /app = "craft-realtime"/);
    assert.match(syncFly, /CRAFT_SYNC_ALLOW_ANON = "0"/);
    assert.match(syncFly, /type = "connections"/);
  });

  it("includes next standalone web Dockerfile", () => {
    const dockerfile = read("deploy/web/Dockerfile");
    assert.match(dockerfile, /NEXT_PUBLIC_PAYTM_CRAFT_MODE/);
    assert.match(dockerfile, /\.next\/standalone/);
    assert.match(dockerfile, /server\.js/);
  });

  it("enables next standalone output", () => {
    const nextConfig = read("next.config.ts");
    assert.match(nextConfig, /output:\s*"standalone"/);
  });

  it("includes nginx websocket proxy example", () => {
    const nginx = read("deploy/nginx/craft-proxy.conf");
    assert.match(nginx, /Upgrade \$http_upgrade/);
    assert.match(nginx, /craft_realtime/);
  });
});
