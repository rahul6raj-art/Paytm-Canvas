import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRafPointerScheduler } from "@/lib/smoothPointer";

describe("smoothPointer", () => {
  it("schedule keeps latest payload until flush", () => {
    const calls: number[] = [];
    const sched = createRafPointerScheduler<number>((n) => calls.push(n));
    sched.schedule(1);
    sched.schedule(2);
    sched.schedule(3);
    assert.equal(calls.length, 0);
    sched.flush();
    assert.deepEqual(calls, [3]);
    sched.cancel();
  });

  it("flush applies pending payload immediately", () => {
    const calls: number[] = [];
    const sched = createRafPointerScheduler<number>((n) => calls.push(n));
    sched.schedule(7);
    sched.flush();
    assert.deepEqual(calls, [7]);
  });

  it("flush runs when payload is null (side-effect schedulers)", () => {
    let runs = 0;
    const sched = createRafPointerScheduler<null>(() => {
      runs += 1;
    });
    sched.schedule(null);
    assert.equal(runs, 0);
    sched.flush();
    assert.equal(runs, 1);
  });
});
