import { svgArcToCubics } from "@/lib/svgImport/arcToBezier";

export type AbsolutePathSegment =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "C"; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: "Z" };

const COMMAND_ARGS: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
};

/** Tokenize SVG path `d` into commands and numbers. */
export function tokenizeSvgPath(d: string): Array<string | number> {
  const tokens: Array<string | number> = [];
  const re = /([a-zA-Z])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(d)) !== null) {
    if (match[1]) tokens.push(match[1]);
    else if (match[2]) tokens.push(parseFloat(match[2]));
  }
  return tokens;
}

function readArgs(tokens: Array<string | number>, start: number, count: number): number[] {
  const args: number[] = [];
  for (let i = 0; i < count; i++) {
    const v = tokens[start + i];
    if (typeof v !== "number" || !Number.isFinite(v)) return [];
    args.push(v);
  }
  return args;
}

/** Parse path `d` into absolute M/L/C/Z segments (arcs converted to cubics). */
export function parseSvgPathToAbsolute(d: string, warnings?: string[]): AbsolutePathSegment[] {
  const tokens = tokenizeSvgPath(d);
  if (tokens.length === 0) return [];

  const segments: AbsolutePathSegment[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let startX = 0;
  let startY = 0;
  let lastCmd = "";
  let lastRel = false;
  let lastControlX = cx;
  let lastControlY = cy;
  let subpathStart = false;

  const pushMove = (x: number, y: number) => {
    segments.push({ type: "M", x, y });
    cx = x;
    cy = y;
    startX = x;
    startY = y;
    lastControlX = x;
    lastControlY = y;
    subpathStart = true;
  };

  const pushLine = (x: number, y: number) => {
    segments.push({ type: "L", x, y });
    cx = x;
    cy = y;
    subpathStart = false;
  };

  const pushCubic = (x1: number, y1: number, x2: number, y2: number, x: number, y: number) => {
    segments.push({ type: "C", x1, y1, x2, y2, x, y });
    cx = x;
    cy = y;
    lastControlX = x2;
    lastControlY = y2;
    subpathStart = false;
  };

  while (i < tokens.length) {
    let cmd = tokens[i];
    let rel = false;

    if (typeof cmd === "string") {
      i++;
      rel = cmd === cmd.toLowerCase();
      lastCmd = cmd.toUpperCase();
      lastRel = rel;
    } else if (lastCmd) {
      cmd = subpathStart && lastCmd === "M" ? "L" : lastCmd;
      rel = lastRel;
    } else {
      warnings?.push(`Unexpected number at token ${i} in path`);
      i++;
      continue;
    }

    const c = (typeof cmd === "string" ? cmd : "L").toUpperCase();

    if (c === "Z") {
      segments.push({ type: "Z" });
      cx = startX;
      cy = startY;
      subpathStart = false;
      continue;
    }

    const argCount = COMMAND_ARGS[c] ?? 0;
    const args = readArgs(tokens, i, argCount);
    if (args.length < argCount) {
      warnings?.push(`Insufficient arguments for ${c} at token ${i}`);
      break;
    }
    i += argCount;

    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;

    if (c === "M") {
      const x = args[0]! + ox;
      const y = args[1]! + oy;
      pushMove(x, y);
      lastCmd = "M";
      while (i < tokens.length && typeof tokens[i] === "number") {
        const lx = (tokens[i] as number) + (rel ? cx : 0);
        const ly = (tokens[i + 1] as number) + (rel ? cy : 0);
        i += 2;
        pushLine(lx, ly);
      }
    } else if (c === "L") {
      pushLine(args[0]! + ox, args[1]! + oy);
    } else if (c === "H") {
      pushLine(args[0]! + ox, cy);
    } else if (c === "V") {
      pushLine(cx, args[0]! + oy);
    } else if (c === "C") {
      pushCubic(
        args[0]! + ox,
        args[1]! + oy,
        args[2]! + ox,
        args[3]! + oy,
        args[4]! + ox,
        args[5]! + oy,
      );
    } else if (c === "S") {
      let c1x = cx;
      let c1y = cy;
      if (lastCmd === "C" || lastCmd === "S") {
        c1x = 2 * cx - lastControlX;
        c1y = 2 * cy - lastControlY;
      }
      pushCubic(c1x, c1y, args[0]! + ox, args[1]! + oy, args[2]! + ox, args[3]! + oy);
      lastCmd = "C";
    } else if (c === "Q") {
      const qx = args[0]! + ox;
      const qy = args[1]! + oy;
      const x = args[2]! + ox;
      const y = args[3]! + oy;
      const c1x = cx + ((qx - cx) * 2) / 3;
      const c1y = cy + ((qy - cy) * 2) / 3;
      const c2x = x + ((qx - x) * 2) / 3;
      const c2y = y + ((qy - y) * 2) / 3;
      pushCubic(c1x, c1y, c2x, c2y, x, y);
      lastControlX = qx;
      lastControlY = qy;
      lastCmd = "Q";
    } else if (c === "T") {
      let qx = cx;
      let qy = cy;
      if (lastCmd === "Q" || lastCmd === "T") {
        qx = 2 * cx - lastControlX;
        qy = 2 * cy - lastControlY;
      }
      const x = args[0]! + ox;
      const y = args[1]! + oy;
      const c1x = cx + ((qx - cx) * 2) / 3;
      const c1y = cy + ((qy - cy) * 2) / 3;
      const c2x = x + ((qx - x) * 2) / 3;
      const c2y = y + ((qy - y) * 2) / 3;
      pushCubic(c1x, c1y, c2x, c2y, x, y);
      lastControlX = qx;
      lastControlY = qy;
      lastCmd = "T";
    } else if (c === "A") {
      const rx = Math.abs(args[0]!);
      const ry = Math.abs(args[1]!);
      const rot = args[2]!;
      const large = args[3]! !== 0;
      const sweep = args[4]! !== 0;
      const x2 = args[5]! + ox;
      const y2 = args[6]! + oy;
      const cubics = svgArcToCubics(cx, cy, rx, ry, rot, large, sweep, x2, y2);
      for (const bz of cubics) {
        pushCubic(bz.x1, bz.y1, bz.x2, bz.y2, bz.x, bz.y);
      }
      lastCmd = "C";
    } else {
      warnings?.push(`Unsupported path command: ${c}`);
    }
  }

  return segments;
}

/** Rebuild SVG path `d` from absolute segments (for flattened fallback). */
export function absoluteSegmentsToPathD(segments: AbsolutePathSegment[]): string {
  const parts: string[] = [];
  for (const seg of segments) {
    if (seg.type === "M") parts.push(`M ${seg.x} ${seg.y}`);
    else if (seg.type === "L") parts.push(`L ${seg.x} ${seg.y}`);
    else if (seg.type === "C") {
      parts.push(`C ${seg.x1} ${seg.y1} ${seg.x2} ${seg.y2} ${seg.x} ${seg.y}`);
    } else if (seg.type === "Z") parts.push("Z");
  }
  return parts.join(" ");
}

/** Fast numeric scale for SVG path `d` without tessellation (import performance). */
export function scaleSvgPathD(d: string, scale: number): string {
  if (scale === 1) return d;
  return d.replace(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi, (token) => {
    const v = parseFloat(token);
    if (!Number.isFinite(v)) return token;
    const scaled = v * scale;
    const rounded = Math.abs(scaled) < 1e-6 ? 0 : Math.round(scaled * 1000) / 1000;
    return String(rounded);
  });
}
