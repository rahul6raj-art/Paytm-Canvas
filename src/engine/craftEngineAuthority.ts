import { isWasmDocumentAuthorityEnabled } from "@/lib/craftPublicConfig";

/** When true, WASM owns document undo/redo (native renderer only). */
export function isWasmDocumentAuthority(): boolean {
  return isWasmDocumentAuthorityEnabled();
}
