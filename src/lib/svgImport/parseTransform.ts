import {
  identityMatrix,
  multiplyMatrix,
  rotateMatrix,
  scaleMatrix,
  translateMatrix,
  type Matrix2D,
} from "@/lib/transformMath";

function skewXMatrix(deg: number): Matrix2D {
  const rad = (deg * Math.PI) / 180;
  return { a: 1, b: 0, c: Math.tan(rad), d: 1, e: 0, f: 0 };
}

function skewYMatrix(deg: number): Matrix2D {
  const rad = (deg * Math.PI) / 180;
  return { a: 1, b: Math.tan(rad), c: 0, d: 1, e: 0, f: 0 };
}

/** Parse SVG transform attribute into a 2D affine matrix. */
export function parseTransformList(raw: string | undefined, warnings?: string[]): Matrix2D {
  if (!raw?.trim()) return identityMatrix();

  // SVG transform attributes use space-separated args (e.g. rotate(angle cx cy)),
  // which differ from CSS transform syntax — always use the SVG parser.
  let m = identityMatrix();
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) !== null) {
    const fn = match[1]!.toLowerCase();
    const args = match[2]!
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((v) => parseFloat(v));

    try {
      if (fn === "translate") {
        m = multiplyMatrix(m, translateMatrix(args[0] ?? 0, args[1] ?? 0));
      } else if (fn === "scale") {
        const sx = args[0] ?? 1;
        const sy = args[1] ?? sx;
        m = multiplyMatrix(m, scaleMatrix(sx, sy));
      } else if (fn === "rotate") {
        m = multiplyMatrix(m, rotateMatrix(args[0] ?? 0, args[1] ?? 0, args[2] ?? 0));
      } else if (fn === "skewx") {
        m = multiplyMatrix(m, skewXMatrix(args[0] ?? 0));
      } else if (fn === "skewy") {
        m = multiplyMatrix(m, skewYMatrix(args[0] ?? 0));
      } else if (fn === "matrix" && args.length >= 6) {
        m = multiplyMatrix(m, {
          a: args[0]!,
          b: args[1]!,
          c: args[2]!,
          d: args[3]!,
          e: args[4]!,
          f: args[5]!,
        });
      } else {
        warnings?.push(`Unsupported transform function: ${fn}`);
      }
    } catch {
      warnings?.push(`Failed to apply transform: ${fn}(${match[2]})`);
    }
  }
  return m;
}
