/** Tracks in-flight Figma import so Cancel / watchdog can abort fetch and skip apply. */

let generation = 0;
let abortController: AbortController | null = null;

export function beginFigImport(): number {
  abortFigImport();
  generation += 1;
  abortController = new AbortController();
  return generation;
}

export function abortFigImport(): void {
  abortController?.abort();
  abortController = null;
  generation += 1;
}

export function getFigImportAbortSignal(): AbortSignal | undefined {
  return abortController?.signal;
}

export function isFigImportCancelled(importGen: number): boolean {
  return importGen !== generation;
}
