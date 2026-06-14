import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseRealtimeWireMessage,
  realtimeRoomForFile,
  serializeRealtimeWireMessage,
} from "@/lib/realtimeSyncProtocol";

describe("realtimeSyncProtocol", () => {
  it("builds stable room ids per file", () => {
    assert.equal(realtimeRoomForFile("abc"), "file:abc");
  });

  it("parses join and sync messages", () => {
    const join = parseRealtimeWireMessage(
      serializeRealtimeWireMessage({ type: "join", room: "file:1", clientId: "c1" }),
    );
    assert.deepEqual(join, { type: "join", room: "file:1", clientId: "c1" });

    const sync = parseRealtimeWireMessage(
      serializeRealtimeWireMessage({ type: "sync", room: "file:1", update: "abc" }),
    );
    assert.deepEqual(sync, { type: "sync", room: "file:1", update: "abc" });
  });

  it("parses awareness payloads", () => {
    const msg = parseRealtimeWireMessage(
      serializeRealtimeWireMessage({
        type: "awareness",
        room: "file:1",
        clientId: "c2",
        payload: {
          clientId: "c2",
          name: "Aisha",
          color: "#f97316",
          cursor: { x: 10, y: 20 },
          selectedNodeIds: ["n1"],
          status: "editing",
        },
      }),
    );
    assert.equal(msg?.type, "awareness");
    if (!msg || msg.type !== "awareness") return;
    assert.equal(msg.payload?.name, "Aisha");
    assert.deepEqual(msg.payload?.cursor, { x: 10, y: 20 });
  });
});
