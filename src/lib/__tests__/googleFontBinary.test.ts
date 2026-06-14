import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  googleFontCssUrl,
  parseGoogleFontCssUrls,
} from "@/lib/fonts/googleFontBinary";

describe("googleFontBinary", () => {
  it("builds Google Fonts CSS URL", () => {
    assert.equal(
      googleFontCssUrl("Poppins", 400),
      "https://fonts.googleapis.com/css2?family=Poppins:wght@400&display=swap",
    );
    assert.equal(
      googleFontCssUrl("Roboto Condensed", 700),
      "https://fonts.googleapis.com/css2?family=Roboto+Condensed:wght@700&display=swap",
    );
  });

  it("parses font URLs from CSS", () => {
    const css = `
      @font-face {
        font-family: 'Poppins';
        src: url(https://fonts.gstatic.com/s/poppins/v22/file.ttf) format('truetype');
      }
      @font-face {
        font-family: 'Poppins';
        src: url(https://fonts.gstatic.com/s/poppins/v22/file.woff2) format('woff2');
      }
    `;
    const urls = parseGoogleFontCssUrls(css);
    assert.equal(urls.length, 2);
    assert.match(urls[0] ?? "", /\.ttf$/);
  });
});
