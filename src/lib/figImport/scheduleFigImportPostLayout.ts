import { startTransition } from "react";
import {
  documentToEditorPatch,
  editorStateToDocument,
  type EditorPersistSlice,
} from "@/lib/documentPersistence";
import { applyFigDocumentPostImportLayout } from "@/lib/figImport/figToPaytmCraft";

type EditorSetter = (
  partial:
    | Record<string, unknown>
    | ((state: Record<string, unknown>) => Record<string, unknown>),
) => void;

/** Apply auto-layout after .fig import when the browser is idle. */
export function scheduleFigImportPostLayout(
  getPersistSlice: () => EditorPersistSlice,
  set: EditorSetter,
): void {
  const run = () => {
    startTransition(() => {
      const doc = editorStateToDocument(getPersistSlice());
      const laid = applyFigDocumentPostImportLayout(doc);
      set(() => documentToEditorPatch(laid));
    });
  };

  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 5000 });
  } else {
    setTimeout(run, 100);
  }
}
