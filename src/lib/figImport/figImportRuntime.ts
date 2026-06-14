import { startTransition } from "react";

export type FigImportProgress = (message: string) => void;

import { FIG_IMPORT_YIELD_EVERY_NODES } from "@/lib/figImport/figImportConstants";

export function resetImportYieldTick(): void {
  importYieldTick = 0;
}

let importYieldTick = 0;

/** Cooperative yield during long .fig tree walks (keeps overlay animation alive). */
export async function yieldImportTick(every = FIG_IMPORT_YIELD_EVERY_NODES): Promise<void> {
  importYieldTick += 1;
  if (importYieldTick % every !== 0) return;
  if (typeof scheduler !== "undefined" && typeof scheduler.yield === "function") {
    await scheduler.yield();
    return;
  }
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

/** Yield so the import overlay can paint before heavy work. */
export async function waitForNextPaint(maxWaitMs = 250): Promise<void> {
  if (typeof requestAnimationFrame !== "function") {
    await new Promise<void>((resolve) => setTimeout(resolve, 16));
    return;
  }
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const fallback = window.setTimeout(finish, maxWaitMs);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.clearTimeout(fallback);
        finish();
      });
    });
  });
}

/** Run heavy Zustand apply without extra frame delays. */
export function scheduleFigImportStateApply(apply: () => void): Promise<void> {
  return new Promise((resolve) => {
    const run = () => {
      apply();
      resolve();
    };
    if (typeof startTransition === "function") {
      startTransition(run);
    } else {
      run();
    }
  });
}

/** Persist large imports when the browser is idle (avoids blocking the main thread). */
export function deferFigImportSave(save: () => Promise<void>): void {
  const run = () => {
    void save().catch((e) => {
      console.warn("[Paytm Craft] fig import persist failed", e);
    });
  };
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 4000 });
  } else {
    setTimeout(run, 100);
  }
}

/** Yield between document apply and mounting the heavy canvas/layers UI. */
export async function settleImportedDocumentUi(layerCount: number): Promise<void> {
  await waitForNextPaint();
  if (typeof scheduler !== "undefined" && typeof scheduler.yield === "function") {
    await scheduler.yield();
  }
  if (layerCount > 200) {
    await new Promise<void>((resolve) => {
      if (typeof requestIdleCallback === "function") {
        requestIdleCallback(() => resolve(), { timeout: 1500 });
      } else {
        setTimeout(resolve, 32);
      }
    });
  }
  await waitForNextPaint();
}
