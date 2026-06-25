import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { importReactPageBundle } from "../importReactPageBundle";

describe("flowSiblingLayout", () => {
  it("does not narrow bottom nav labels during page CSS relayout", () => {
    const css = `
      .pml-more { display: flex; flex-direction: column; }
      .bn { display: flex; flex-direction: row; width: 100%; }
      .bn__tab { flex: 1; display: flex; flex-direction: column; align-items: center; }
      .bn__label { font-size: 12px; text-align: center; }
    `;
    const tsx = `
      export const PMLMorePage = () => (
        <div className="pml-more">
          <SectionHeader title="Account" trailing="none" />
          <div className="pml-more__bottom-nav">
            <nav className="bn">
              <div className="bn__tab">
                <span className="bn__label body-medium">Home</span>
              </div>
              <div className="bn__tab">
                <span className="bn__label body-medium">More</span>
              </div>
            </nav>
          </div>
        </div>
      );
    `;
    const result = importReactPageBundle({ tsxSource: tsx, cssSources: [css], fileName: "PMLMorePage.tsx" });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const home = Object.values(result.slice.nodes).find((n) => n.content === "Home");
    assert.ok(home, "Home label should exist");
    assert.ok((home!.width ?? 0) >= 40, `Home label too narrow: ${home!.width}`);
    assert.ok((home!.height ?? 0) <= 24, `Home label too tall (wrapped): ${home!.height}`);
  });
});
