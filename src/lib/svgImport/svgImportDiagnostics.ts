export type SvgImportDiagnostics = {
  warnings: string[];
  unsupportedElements: string[];
  unsupportedAttributes: string[];
  unsupportedPathCommands: string[];
  failedTransforms: string[];
  boundsComparison?: {
    viewBox: { minX: number; minY: number; width: number; height: number };
    imported: { x: number; y: number; width: number; height: number };
  };
};

export function createSvgImportDiagnostics(): SvgImportDiagnostics {
  return {
    warnings: [],
    unsupportedElements: [],
    unsupportedAttributes: [],
    unsupportedPathCommands: [],
    failedTransforms: [],
  };
}

export function warnDiag(diag: SvgImportDiagnostics, message: string): void {
  diag.warnings.push(message);
}

export function warnUnsupportedElement(diag: SvgImportDiagnostics, tag: string, detail?: string): void {
  const msg = detail ? `<${tag}>: ${detail}` : `<${tag}>`;
  if (!diag.unsupportedElements.includes(msg)) diag.unsupportedElements.push(msg);
  warnDiag(diag, `Unsupported element: ${msg}`);
}

export function warnUnsupportedAttr(diag: SvgImportDiagnostics, tag: string, attr: string): void {
  const key = `${tag}.${attr}`;
  if (!diag.unsupportedAttributes.includes(key)) diag.unsupportedAttributes.push(key);
  warnDiag(diag, `Unsupported attribute: ${key}`);
}
