import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  familyNameFromFontFile,
  inferFontWeightFromFileName,
  validateFontImportFile,
} from "@/lib/editorFontAssets";

describe("editorFontAssets", () => {
  it("infers bold weight from file name", () => {
    assert.equal(inferFontWeightFromFileName("Poppins-Bold.ttf"), 700);
    assert.equal(inferFontWeightFromFileName("Poppins-Regular.ttf"), 400);
  });

  it("derives family name from file name", () => {
    const file = { name: "Brand Sans Bold.ttf" } as File;
    assert.equal(familyNameFromFontFile(file), "Brand Sans");
  });

  it("rejects unsupported extensions", () => {
    const file = { name: "font.woff2", size: 1000, type: "font/woff2" } as File;
    assert.match(validateFontImportFile(file) ?? "", /Unsupported/);
  });
});
