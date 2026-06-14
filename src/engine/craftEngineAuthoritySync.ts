import { isWasmDocumentAuthority } from "@/engine/craftEngineAuthority";
import {
  craftEngineAuthorityCanRedo,
  craftEngineAuthorityCanUndo,
} from "@/engine/craftEngineAuthorityBridge";
import { useEditorStore } from "@/stores/useEditorStore";

/** Sync Zustand undo/redo flags from the WASM history stack (native authority mode). */
export function refreshWasmHistoryFlags(): void {
  if (!isWasmDocumentAuthority()) return;
  useEditorStore.setState({
    wasmHistoryCanUndo: craftEngineAuthorityCanUndo(),
    wasmHistoryCanRedo: craftEngineAuthorityCanRedo(),
  });
}
