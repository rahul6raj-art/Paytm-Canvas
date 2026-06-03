export type FigImportProgress = (message: string) => void;

let importYieldTick = 0;

export function resetImportYieldTick(): void {
  importYieldTick = 0;
}

/** Cooperative yield during long .fig tree walks (keeps overlay animation alive). */
export async function yieldImportTick(every = 16): Promise<void> {
  importYieldTick += 1;
  if (importYieldTick % every === 0) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
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

/** Run heavy Zustand apply on the next task so the import overlay can keep animating. */
export function scheduleFigImportStateApply(apply: () => void): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      apply();
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      } else {
        setTimeout(() => resolve(), 16);
      }
    }, 0);
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
