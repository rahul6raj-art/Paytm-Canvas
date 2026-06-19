import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importHtmlPageBundle } from "../importHtmlPageBundle";
import { extractHtmlSourceHeader } from "@/lib/codeImport/htmlImport";

describe("importHtmlPageBundle", () => {
  const pageCss = `
    .signup-page {
      background-color: #101010;
      width: 390px;
      min-height: 844px;
    }
    .signup-page__title {
      color: #ffffff;
      font-size: 32px;
    }
  `;

  const pageHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="stylesheet" href="./signup.css" />
  <title>Signup</title>
</head>
<body>
  <div class="signup-page">
    <h1 class="signup-page__title">Create account</h1>
  </div>
</body>
</html>`;

  it("applies companion CSS onto parsed HTML structure", () => {
    const result = importHtmlPageBundle({
      htmlSource: pageHtml,
      cssSources: [pageCss],
      fileName: "signup.html",
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const nodes = Object.values(result.slice.nodes);
    const root = nodes.find((n) => n.codeClassName === "signup-page");
    const title = nodes.find((n) => n.codeClassName === "signup-page__title");
    assert.equal(root?.fill, "#101010");
    assert.equal(title?.fill ?? title?.textColor, "#ffffff");
    assert.equal(title?.fontSize, 32);
    assert.match(result.message, /Applied styles from 1 page CSS/);
  });

  it("extractHtmlSourceHeader keeps stylesheet link", () => {
    const header = extractHtmlSourceHeader(pageHtml);
    assert.match(header ?? "", /signup\.css/);
  });
});
