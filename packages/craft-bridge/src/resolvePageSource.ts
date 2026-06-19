import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type PageSourceFormat = "react" | "html";

function discoverDesignTokenCss(startDir: string): string[] {
  let dir = startDir;
  for (let depth = 0; depth < 8; depth++) {
    const tokensDir = path.join(dir, "src/tokens");
    if (existsSync(tokensDir)) {
      return readdirSync(tokensDir)
        .filter((f) => f.endsWith(".css"))
        .map((f) => path.join(tokensDir, f));
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [];
}

function appendUniqueCss(paths: string[], extra: string[]): string[] {
  const out = [...paths];
  for (const p of extra) {
    if (!out.includes(p)) out.push(p);
  }
  return out;
}

export type ResolvedPageSource = {
  /** Main entry file (.tsx, .html, etc.) */
  tsxPath: string;
  format: PageSourceFormat;
  cssPaths: string[];
  linkPath: string;
  pageLabel: string;
};

function collectCssFromSourceImports(sourcePath: string, format: PageSourceFormat): string[] {
  const dir = path.dirname(sourcePath);
  const ext = path.extname(sourcePath);
  const base = path.basename(sourcePath, ext);
  const cssPaths: string[] = [];
  const sibling = path.join(dir, `${base}.css`);
  if (existsSync(sibling)) cssPaths.push(sibling);

  const src = readFileSync(sourcePath, "utf8");
  if (format === "react") {
    for (const m of src.matchAll(/import\s+['"](\.\/[^'"]+\.css)['"]/g)) {
      const rel = m[1]!.replace(/^\.\//, "");
      const p = path.join(dir, rel);
      if (existsSync(p) && !cssPaths.includes(p)) cssPaths.push(p);
    }
  } else {
    for (const m of src.matchAll(
      /<link[^>]+href=["'](\.\/[^"']+\.css)["'][^>]*>/gi,
    )) {
      const rel = m[1]!.replace(/^\.\//, "");
      const p = path.join(dir, rel);
      if (existsSync(p) && !cssPaths.includes(p)) cssPaths.push(p);
    }
  }
  return cssPaths;
}

function resolvePageInDirectory(dir: string): ResolvedPageSource {
  const files = readdirSync(dir);
  const indexTs = path.join(dir, "index.ts");
  let mainFile: string | null = null;
  let format: PageSourceFormat = "react";

  if (existsSync(indexTs)) {
    const idx = readFileSync(indexTs, "utf8");
    const m = idx.match(/from\s+['"]\.\/([^'"]+)['"]/);
    if (m) {
      const stem = m[1]!.replace(/\.(tsx|html|htm)$/, "");
      for (const ext of [".tsx", ".html", ".htm"]) {
        const candidate = `${stem}${ext}`;
        if (files.includes(candidate)) {
          mainFile = candidate;
          format = ext === ".tsx" ? "react" : "html";
          break;
        }
      }
    }
  }

  if (!mainFile) {
    const tsxCandidates = files.filter(
      (f) =>
        f.endsWith(".tsx") &&
        !f.includes(".stories.") &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
    if (tsxCandidates.length === 1) {
      mainFile = tsxCandidates[0]!;
      format = "react";
    } else if (tsxCandidates.length > 1) {
      const prefer = `${path.basename(dir)}.tsx`;
      mainFile = tsxCandidates.includes(prefer) ? prefer : tsxCandidates[0]!;
      format = "react";
    }
  }

  if (!mainFile) {
    const htmlCandidates = files.filter(
      (f) =>
        (f.endsWith(".html") || f.endsWith(".htm")) &&
        !f.includes(".test.") &&
        !f.includes(".spec."),
    );
    if (htmlCandidates.length === 1) {
      mainFile = htmlCandidates[0]!;
      format = "html";
    } else if (htmlCandidates.length > 1) {
      const prefer = `${path.basename(dir)}.html`;
      if (htmlCandidates.includes(prefer)) mainFile = prefer;
      else if (htmlCandidates.includes("index.html")) mainFile = "index.html";
      else mainFile = htmlCandidates[0]!;
      format = "html";
    }
  }

  if (!mainFile) {
    throw new Error(`No page .tsx or .html found in folder: ${dir}`);
  }

  const mainPath = path.join(dir, mainFile);
  let cssPaths = files
    .filter((f) => f.endsWith(".css"))
    .map((f) => path.join(dir, f));

  for (const imported of collectCssFromSourceImports(mainPath, format)) {
    if (!cssPaths.includes(imported)) cssPaths.push(imported);
  }
  cssPaths = appendUniqueCss(cssPaths, discoverDesignTokenCss(dir));

  const linkPath = existsSync(indexTs) ? indexTs : mainPath;
  return {
    tsxPath: mainPath,
    format,
    cssPaths,
    linkPath,
    pageLabel: path.basename(dir),
  };
}

/** Resolve a page folder, index.ts, .tsx, or .html file to main entry + companion CSS. */
export function resolvePageSource(absPath: string): ResolvedPageSource {
  const st = statSync(absPath);
  if (st.isDirectory()) return resolvePageInDirectory(absPath);

  const dir = path.dirname(absPath);
  const base = path.basename(absPath);

  if (base === "index.ts" || base === "index.tsx") {
    return resolvePageInDirectory(dir);
  }

  if (absPath.endsWith(".tsx")) {
    return {
      tsxPath: absPath,
      format: "react",
      cssPaths: appendUniqueCss(
        collectCssFromSourceImports(absPath, "react"),
        discoverDesignTokenCss(dir),
      ),
      linkPath: absPath,
      pageLabel: path.basename(absPath, ".tsx"),
    };
  }

  if (absPath.endsWith(".html") || absPath.endsWith(".htm")) {
    return {
      tsxPath: absPath,
      format: "html",
      cssPaths: appendUniqueCss(
        collectCssFromSourceImports(absPath, "html"),
        discoverDesignTokenCss(dir),
      ),
      linkPath: absPath,
      pageLabel: path.basename(absPath, path.extname(absPath)),
    };
  }

  throw new Error(
    `Expected a page folder, index.ts, .tsx, or .html file — got: ${absPath}`,
  );
}

export function toRepoRelativePaths(repoRoot: string, absolutePaths: string[]): string[] {
  return absolutePaths.map((p) => path.relative(repoRoot, p).replace(/\\/g, "/"));
}

/** Map a craft.link folder/index path to the main page entry (.tsx / .html) for read/write. */
export function resolveLinkedPageEntryPath(repoRoot: string, sourcePath: string): string {
  const trimmed = sourcePath.trim().replace(/\\/g, "/");
  if (!trimmed) return trimmed;

  const abs = path.resolve(repoRoot, trimmed);
  if (!existsSync(abs)) return trimmed;

  try {
    const st = statSync(abs);
    const base = path.basename(abs);
    if (
      st.isDirectory() ||
      base === "index.ts" ||
      base === "index.tsx"
    ) {
      const page = resolvePageSource(abs);
      return path.relative(repoRoot, page.tsxPath).replace(/\\/g, "/");
    }
  } catch {
    /* not a page folder — use path as given */
  }

  return trimmed;
}
