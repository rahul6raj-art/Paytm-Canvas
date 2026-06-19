export type DiffLineKind = "same" | "remove" | "add";

export type DiffLine = {
  kind: DiffLineKind;
  text: string;
};

/** Myers-style line diff (good enough for screen-sized source files). */
export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.replace(/\r\n/g, "\n").split("\n");
  const b = newText.replace(/\r\n/g, "\n").split("\n");
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max === 0) return [];

  const offset = max;
  const trace: number[][] = [];
  let x = 0;
  let y = 0;

  outer: for (let d = 0; d <= max; d++) {
    trace[d] = Array(2 * d + 1).fill(0);
    for (let k = -d; k <= d; k += 2) {
      let xx: number;
      if (k === -d || (k !== d && (trace[d - 1]?.[k - 1 + offset + d - 1] ?? 0) < (trace[d - 1]?.[k + 1 + offset + d - 1] ?? 0))) {
        xx = trace[d - 1]?.[k + 1 + offset + d - 1] ?? 0;
      } else {
        xx = (trace[d - 1]?.[k - 1 + offset + d - 1] ?? 0) + 1;
      }
      let yy = xx - k;
      while (xx < n && yy < m && a[xx] === b[yy]) {
        xx += 1;
        yy += 1;
      }
      trace[d][k + offset + d] = xx;
      if (xx >= n && yy >= m) {
        x = xx;
        y = yy;
        break outer;
      }
    }
  }

  const out: DiffLine[] = [];
  let ai = n;
  let bi = m;
  for (let d = trace.length - 1; d >= 0; d--) {
    const k = ai - bi;
    const offsetD = offset + d;
    const prevK =
      k === -d || (k !== d && (trace[d - 1]?.[k - 1 + offsetD - 1] ?? 0) < (trace[d - 1]?.[k + 1 + offsetD - 1] ?? 0))
        ? k + 1
        : k - 1;
    const prevX = d === 0 ? 0 : trace[d - 1]?.[prevK + offsetD - 1] ?? 0;
    const prevY = prevX - prevK;

    while (ai > prevX && bi > prevY) {
      ai -= 1;
      bi -= 1;
      out.push({ kind: "same", text: a[ai]! });
    }

    if (d === 0) break;

    if (ai > prevX) {
      ai -= 1;
      out.push({ kind: "remove", text: a[ai]! });
    } else if (bi > prevY) {
      bi -= 1;
      out.push({ kind: "add", text: b[bi]! });
    }
  }

  return out.reverse();
}

export type AlignedDiffRow = {
  left: string | null;
  right: string | null;
  kind: "same" | "change" | "left-only" | "right-only";
};

/** Two-column aligned rows for side-by-side conflict UI. */
export function alignDiffSides(oldText: string, newText: string): AlignedDiffRow[] {
  const lines = diffLines(oldText, newText);
  const rows: AlignedDiffRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (line.kind === "same") {
      rows.push({ left: line.text, right: line.text, kind: "same" });
      i += 1;
      continue;
    }

    const removes: string[] = [];
    const adds: string[] = [];
    while (i < lines.length && lines[i]!.kind === "remove") {
      removes.push(lines[i]!.text);
      i += 1;
    }
    while (i < lines.length && lines[i]!.kind === "add") {
      adds.push(lines[i]!.text);
      i += 1;
    }

    const n = Math.max(removes.length, adds.length);
    for (let j = 0; j < n; j++) {
      const left = removes[j] ?? null;
      const right = adds[j] ?? null;
      const kind =
        left !== null && right !== null ? "change" : left !== null ? "left-only" : "right-only";
      rows.push({ left, right, kind });
    }
  }
  return rows;
}

export function countDiffStats(rows: AlignedDiffRow[]): {
  same: number;
  changed: number;
  leftOnly: number;
  rightOnly: number;
} {
  let same = 0;
  let changed = 0;
  let leftOnly = 0;
  let rightOnly = 0;
  for (const r of rows) {
    if (r.kind === "same") same += 1;
    else if (r.kind === "change") changed += 1;
    else if (r.kind === "left-only") leftOnly += 1;
    else rightOnly += 1;
  }
  return { same, changed, leftOnly, rightOnly };
}
