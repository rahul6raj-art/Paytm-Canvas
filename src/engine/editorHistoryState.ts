import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";

type HistoryUiState = {
  historyPast: unknown[];
  historyFuture: unknown[];
  wasmHistoryCanUndo: boolean;
  wasmHistoryCanRedo: boolean;
};

export function editorCanUndoHistory(s: HistoryUiState): boolean {
  if (isWasmDocumentAuthority()) return s.wasmHistoryCanUndo;
  return s.historyPast.length > 0;
}

export function editorCanRedoHistory(s: HistoryUiState): boolean {
  if (isWasmDocumentAuthority()) return s.wasmHistoryCanRedo;
  return s.historyFuture.length > 0;
}
