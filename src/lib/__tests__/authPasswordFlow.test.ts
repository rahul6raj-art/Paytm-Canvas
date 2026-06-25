import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DEV_LOGIN_EMAIL,
  DEFAULT_DEV_SEED_PASSWORD,
  readPrefillPassword,
} from "@/lib/authFormDefaults";
import { mockApiStore, resetMockApiStoreForTests } from "@/lib/mockApiStore";

describe("authFormDefaults", () => {
  it("uses seed password only for the dev seed email", () => {
    assert.equal(readPrefillPassword(DEFAULT_DEV_LOGIN_EMAIL), DEFAULT_DEV_SEED_PASSWORD);
    assert.equal(readPrefillPassword("other@paytm.com"), "");
  });
});

describe("mockApiStore password reset", () => {
  it("resets password with a valid token", () => {
    resetMockApiStoreForTests();
    const reset = mockApiStore.requestPasswordReset("rahul6.raj@paytm.com");
    assert.ok(reset?.token);
    const user = mockApiStore.resetPasswordWithToken(reset!.token, "new-pass-99");
    assert.equal(user.email, "rahul6.raj@paytm.com");
    mockApiStore.loginUser({ email: user.email, password: "new-pass-99" });
  });
});
