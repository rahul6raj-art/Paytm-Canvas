import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  REMOTE_AUTH_REFRESH_EVENT,
  notifyRemoteAuthRefresh,
  subscribeRemoteAuthRefresh,
} from "@/lib/remoteAuthSession";

describe("remoteAuthSession", () => {
  it("notifyRemoteAuthRefresh dispatches a window event", () => {
    if (typeof window === "undefined") return;
    let count = 0;
    const unsub = subscribeRemoteAuthRefresh(() => {
      count += 1;
    });
    notifyRemoteAuthRefresh();
    assert.equal(count, 1);
    unsub();
  });

  it("exports a stable refresh event name", () => {
    assert.equal(REMOTE_AUTH_REFRESH_EVENT, "paytm-craft:remote-auth-refresh");
  });
});
