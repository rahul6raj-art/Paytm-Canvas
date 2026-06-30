declare module "opentype.js" {
  export interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }

  export interface Path {
    toPathData(decimalPlaces?: number): string;
    getBoundingBox(): BoundingBox;
  }

  export interface Glyph {
    getPath(x: number, y: number, fontSize: number): Path;
  }

  export interface Font {
    charToGlyph(char: string): Glyph;
    getPath(text: string, x: number, y: number, fontSize: number): Path;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
