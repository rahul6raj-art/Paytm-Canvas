import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { buildInviteEmailContent, buildRegisterUrl, craftAppPublicUrl } from "../mail/inviteEmail.js";

const saved: Record<string, string | undefined> = {};

function setEnv(key: string, value: string | undefined) {
  if (!(key in saved)) saved[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

afterEach(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("inviteEmail", () => {
  it("builds register URL from CRAFT_APP_URL", () => {
    setEnv("CRAFT_APP_URL", "https://craft.example.com/");
    assert.equal(craftAppPublicUrl(), "https://craft.example.com");
    assert.equal(buildRegisterUrl(), "https://craft.example.com/");
  });

  it("includes workspace and inviter in invite email", () => {
    const content = buildInviteEmailContent({
      inviteeEmail: "new@paytm.com",
      workspaceName: "Paytm Design",
      inviterName: "Rahul Verma",
      role: "member",
      registerUrl: "http://localhost:3000/",
    });
    assert.match(content.subject, /Paytm Design/);
    assert.match(content.text, /Rahul Verma/);
    assert.match(content.html, /new@paytm\.com/);
    assert.match(content.text, /localhost:3000/);
  });
});
