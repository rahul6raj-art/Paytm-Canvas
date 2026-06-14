import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canAcceptFigFileDrop,
  figFileFromDataTransfer,
  isFigmaFigFile,
} from "@/lib/figImport";

describe("fig file drop helpers", () => {
  it("detects .fig files by extension", () => {
    assert.equal(isFigmaFigFile({ name: "Design.fig" } as File), true);
    assert.equal(isFigmaFigFile({ name: "notes.txt" } as File), false);
  });

  it("extracts a .fig file from a data transfer", () => {
    const file = { name: "Screen.fig", type: "application/octet-stream" } as File;
    const dt = {
      files: [file],
      items: [],
      types: ["Files"],
    } as unknown as DataTransfer;
    assert.equal(figFileFromDataTransfer(dt), file);
    assert.equal(canAcceptFigFileDrop(dt), true);
  });

  it("accepts file drags before the file list is populated", () => {
    const dt = {
      files: [],
      items: [],
      types: ["Files"],
    } as unknown as DataTransfer;
    assert.equal(figFileFromDataTransfer(dt), null);
    assert.equal(canAcceptFigFileDrop(dt), true);
  });
});
