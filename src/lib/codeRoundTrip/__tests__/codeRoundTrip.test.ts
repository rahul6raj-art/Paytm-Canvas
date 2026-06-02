import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  diagnoseImportFailure,
  exportReactSource,
  importReactSource,
  mergeStructureMetadataOntoLiveNodes,
  validateReactPreviewUrl,
} from "@/lib/codeRoundTrip";
import { EDITOR_ROOT_KEY } from "@/lib/editorConstants";
import type { EditorNode } from "@/stores/useEditorStore";

function frame(id: string, name: string, x: number, y: number, w: number, h: number): EditorNode {
  return {
    id,
    parentId: null,
    type: "frame",
    name,
    x,
    y,
    width: w,
    height: h,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    fill: "#ffffff",
    fillEnabled: true,
  };
}

function text(id: string, parentId: string, content: string): EditorNode {
  return {
    id,
    parentId,
    type: "text",
    name: "Label",
    x: 8,
    y: 8,
    width: 80,
    height: 20,
    rotation: 0,
    visible: true,
    locked: false,
    expanded: true,
    content,
    fontSize: 14,
    fill: "#111111",
    textColor: "#111111",
    textResizeMode: "auto-width",
  };
}

describe("code round trip", () => {
  it("exports and re-imports via embedded payload", () => {
    const f = frame("f1", "Card", 0, 0, 200, 100);
    const t = text("t1", "f1", "Hello");
    const nodes = { f1: f, t1: t };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["t1"] };

    const exported = exportReactSource({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
    });

    assert.ok(exported.source.includes("@paytm-craft-payload-start"));
    assert.ok(exported.source.includes("Hello"));
    assert.equal(exported.componentName, "Card");

    const imported = importReactSource(exported.source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    assert.equal(imported.slice.nodes.t1?.content, "Hello");
    assert.deepEqual(imported.slice.childOrder.f1, ["t1"]);
  });

  it("rejects invalid non-JSX source", () => {
    const r = importReactSource(`const x = 1;`);
    assert.equal(r.ok, false);
  });

  it("imports JSX from a React component file", () => {
    const source = `
import React from "react";
import { Header } from "./Header";

export default function HomeScreen() {
  return (
    <div style={{ width: 375, height: 200, display: "flex", flexDirection: "column", gap: 8 }}>
      <Header />
      <p style={{ fontSize: 14, color: "#111" }}>Welcome</p>
    </div>
  );
}
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const ids = Object.keys(imported.slice.nodes);
    assert.ok(ids.length >= 2);
    const header = Object.values(imported.slice.nodes).find((n) => n.codeJsxTag === "Header");
    assert.ok(header);
    const welcome = Object.values(imported.slice.nodes).find((n) => n.content === "Welcome");
    assert.ok(welcome);

    const exported = exportReactSource({
      nodes: imported.slice.nodes,
      childOrder: imported.slice.childOrder,
      selectedIds: imported.slice.selectedIds,
      designTokens: {},
      assets: {},
      sourceHeader: imported.sourceHeader,
    });
    assert.ok(exported.source.includes("@paytm-craft-payload-start"));
    assert.ok(exported.source.includes("data-pc-id"));
    assert.ok(exported.source.includes("<Header"));

    const reimported = importReactSource(exported.source);
    assert.equal(reimported.ok, true);
    if (!reimported.ok) return;
    assert.equal(reimported.slice.nodes[welcome!.id]?.content, "Welcome");
    assert.ok(reimported.slice.nodes[header!.id]);
  });

  it("imports JSX inside conditional expressions (PMLHomePage pattern)", () => {
    const source = `
export const PMLHomePage = () => {
  const activeTab = "portfolio";
  return (
    <div className="pml-home">
      <Header className="pml-home__header" />
      <div className="pml-home__scroll">
        {activeTab === "ipos" ? (
          <IPOHomePage />
        ) : (
          <>
            <div className="pml-home__ticker">
              <Ticker />
            </div>
            <section className="sh-section">
              <PortfolioWidget />
            </section>
            <GoalsWidget />
            <NewsWidget />
          </>
        )}
      </div>
      <div className="pml-home__bottom-nav">
        <BottomNav />
      </div>
    </div>
  );
};
export default PMLHomePage;
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const tags = new Set(Object.values(imported.slice.nodes).map((n) => n.codeJsxTag));
    assert.ok(tags.has("Ticker"), `missing Ticker, got ${[...tags].join(", ")}`);
    assert.ok(tags.has("PortfolioWidget"));
    assert.ok(tags.has("GoalsWidget"));
    assert.ok(tags.has("NewsWidget"));
    const root = imported.slice.nodes[imported.slice.selectedIds[0]!];
    assert.ok(root && root.height > 400, `root height ${root?.height}`);
    assert.ok(root && root.width >= 390, `root width ${root?.width}`);
    const narrowFrames = Object.values(imported.slice.nodes).filter(
      (n) => (n.type === "frame" || n.type === "group") && n.width < 200,
    );
    assert.equal(narrowFrames.length, 0, `narrow frames: ${narrowFrames.map((n) => n.name).join(", ")}`);
  });

  it("imports flex className and applies auto-layout positions", () => {
    const source = `
const SCREEN_W = 390;
function Header() {
  return <header className="h-[56px] w-full">Top</header>;
}
export default function Screen() {
  return (
    <div className="flex flex-col w-full" style={{ width: SCREEN_W, height: 800 }}>
      <Header />
      <p className="px-4">Body</p>
    </div>
  );
}
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const header = Object.values(imported.slice.nodes).find((n) => n.codeJsxTag === "header");
    assert.ok(header);
    assert.equal(header?.y, 0);
    const body = Object.values(imported.slice.nodes).find((n) => n.content === "Body");
    assert.ok(body);
    assert.ok((body?.y ?? 0) > (header?.height ?? 0) - 1);
  });

  it("imports only the first state-guarded tab panel", () => {
    const source = `
export function TrainTicketsHome() {
  const [activeTab] = React.useState('book');
  return (
    <main>
      <section>
        {activeTab === 'book' && <div><span>Book tab</span></div>}
        {activeTab === 'live' && <div><span>Live tab</span></div>}
        {activeTab === 'trips' && <div><span>Trips tab</span></div>}
      </section>
    </main>
  );
}
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const texts = Object.values(imported.slice.nodes)
      .map((n) => n.content)
      .filter(Boolean);
    assert.ok(texts.includes("Book tab"));
    assert.ok(!texts.includes("Live tab"));
    assert.ok(!texts.includes("Trips tab"));
  });

  it("resolves map item fields in inline style attributes", () => {
    const source = `
const offers = [{ id: "a", headline: "10% Off", bg: "#e6f5ed", accent: "#0a5c36" }];
export function Screen() {
  return (
    <div>
      {offers.map((offer) => (
        <article key={offer.id} style={{ backgroundColor: offer.bg }}>
          <span>{offer.headline}</span>
        </article>
      ))}
    </div>
  );
}
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const headline = Object.values(imported.slice.nodes).find((n) => n.content === "10% Off");
    assert.ok(headline);
    const card = imported.slice.nodes[headline!.parentId!];
    assert.equal(card?.fill, "#e6f5ed");
  });

  it("resolves nested statusColors in map block callbacks", () => {
    const source = `
const trips = [{ id: "t1", status: "confirmed", label: "Confirmed" }];
const statusColors = {
  confirmed: { bg: "#dcfce7", text: "#15803d" },
  waitlist: { bg: "#fef9c3", text: "#b45309" },
};
export function Screen() {
  return (
    <ul>
      {trips.map((trip) => {
        const sc = statusColors[trip.status];
        return (
          <li key={trip.id}>
            <span style={{ backgroundColor: sc.bg, color: sc.text }}>{trip.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const label = Object.values(imported.slice.nodes).find((n) => n.content === "Confirmed");
    assert.ok(label);
    assert.equal(label?.fill, "#15803d");
  });

  it("imports Tailwind bracket colors, map loops, and conditional className", () => {
    const source = `
const trainClasses = [{ id: "a", label: "2A", active: true }];
export function TrainScreen() {
  return (
    <main className="flex min-h-screen w-full bg-[#f5f5f5]">
      <section className="flex h-[874px] w-full max-w-[376px] flex-col bg-[#f5f5f5]">
        <button type="button" className="mt-4 flex h-[52px] w-full rounded-lg bg-[#004299] text-white">
          <span>Search Trains</span>
        </button>
        <div className="mt-4 flex gap-2">
          {trainClasses.map((trainClass) => (
            <button
              key={trainClass.id}
              type="button"
              className={
                trainClass.active
                  ? "rounded-[64px] bg-[#004299] px-3 py-2 text-white"
                  : "rounded-[64px] border border-[#ebebeb] bg-[#f5f5f5] px-3 py-2"
              }
            >
              <span>{trainClass.label}</span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const searchBtn = Object.values(imported.slice.nodes).find((n) => n.content === "Search Trains");
    assert.ok(searchBtn);
    const searchFrame = imported.slice.nodes[searchBtn!.parentId!];
    assert.equal(searchFrame?.fill, "#004299");
    const classBtn = Object.values(imported.slice.nodes).find((n) => n.content === "2A");
    assert.ok(classBtn);
    const classFrame = imported.slice.nodes[classBtn!.parentId!];
    assert.equal(classFrame?.fill, "#004299");
    const row = Object.values(imported.slice.nodes).find(
      (n) => n.codeClassName?.includes("gap-2") && (imported.slice.childOrder[n.id]?.length ?? 0) >= 1,
    );
    assert.ok(row, "expected flex row with mapped class buttons");
  });

  it("imports JSX with ternary return", () => {
    const source = `
export default function PMLHomePage() {
  const loading = false;
  return loading ? <div>loading</div> : (
    <div className="pml-home">
      <BottomNav />
    </div>
  );
}
`;
    const imported = importReactSource(source);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    const nav = Object.values(imported.slice.nodes).find((n) => n.codeJsxTag === "BottomNav");
    assert.ok(nav);
  });

  it("rejects incomplete JSX fragment paste", () => {
    const r = importReactSource(`
    <div><BottomNav /></div>
  </div>
);
export default PMLHomePage;
`);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /fragment/i);
  });

  it("validateReactPreviewUrl allows localhost", () => {
    const r = validateReactPreviewUrl("http://localhost:6006");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.match(r.url, /localhost:6006/);
  });

  it("validateReactPreviewUrl blocks arbitrary private IPs", () => {
    const r = validateReactPreviewUrl("http://192.168.1.5/app");
    assert.equal(r.ok, false);
  });

  it("mergeStructureMetadataOntoLiveNodes maps component tags by className", () => {
    const jsx = `export default function Screen() {
  return <div className="pml-home"><Header /></div>;
}`;
    const parsed = importReactSource(jsx);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const homeId = Object.keys(parsed.slice.nodes).find(
      (id) => parsed.slice.nodes[id]?.codeClassName === "pml-home",
    );
    assert.ok(homeId);
    const liveNodes = {
      w1: { ...parsed.slice.nodes[homeId!], id: "w1" },
    };

    const merged = mergeStructureMetadataOntoLiveNodes(liveNodes, jsx);
    assert.equal(merged.w1?.codeClassName, "pml-home");
    assert.equal(merged.w1?.codeJsxTag, "div");
  });

  it("round-trips payload after canvas export", () => {
    const f = frame("f1", "Card", 0, 0, 200, 100);
    const t = text("t1", "f1", "Hello");
    const nodes = { f1: f, t1: t };
    const childOrder = { [EDITOR_ROOT_KEY]: ["f1"], f1: ["t1"] };
    const exported = exportReactSource({
      nodes,
      childOrder,
      selectedIds: ["f1"],
      designTokens: {},
      assets: {},
    });
    const reimported = importReactSource(exported.source);
    assert.equal(reimported.ok, true);
    if (!reimported.ok) return;
    assert.equal(reimported.slice.nodes.t1?.content, "Hello");
  });
});
