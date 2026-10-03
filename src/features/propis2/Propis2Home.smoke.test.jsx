import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import Propis2Home from "./Propis2Home.jsx";
import { useAppStore } from "@/core/store";
import { BUILTIN_TOPIC_IDS } from "@/topics/builtinTopics";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { layoutWideLinesIntoRows } from "@/topics/renderers/propis/wordEngine.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// The installed record as the deck builder makes it (topic.json + merged tools/propis data).
function deckRecord() {
  const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
  topic.elements = JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements;
  topic.wide = wide.glyphs;
  topic.wideSheets = wide.sheets;
  topic.wideElementRepeat = wide.elementRepeat ?? {};
  return { ...topic, id: topic.meta.id, installedAt: "test" };
}

describe("Прописи 2 (zip topic)", () => {
  beforeEach(() => {
    useAppStore.setState({ topicRecords: [deckRecord()], activeTopicId: "propis2", screen: "params" });
  });

  it("is a deck topic, not a builtin one, with a bundled renderer and engine", () => {
    expect(BUILTIN_TOPIC_IDS.has("propis2")).toBe(false);
    expect(RENDERER_REGISTRY.propis2).toBeTypeOf("function");
    expect(ENGINE_REGISTRY.propis2().length).toBe(1);
    const rec = deckRecord();
    expect(rec.meta.renderer).toBe("propis2");
    expect(rec.modes).toHaveLength(1);
  });

  it("lays out a ready sheet from the deck's own glyph data", () => {
    const rec = deckRecord();
    const task = buildPageTask({ topicRecord: rec, lines: rec.wideSheets.page18 });
    const map = new Map(task.wideGlyphs.map((g) => [g.label, g]));
    const { placed } = layoutWideLinesIntoRows(task.lines, map, undefined, true, 0.5);
    expect(placed.length).toBe(task.lines.length);
    for (const row of placed) expect(row.segments.length).toBe(1);
  });

  it("home screen shows the row list and opens the page view", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<Propis2Home />));
    expect(host.querySelectorAll(".propis2-rows li").length).toBe(deckRecord().wideSheets.page18.length);
    const show = [...host.querySelectorAll("button")].find((b) => b.textContent.includes("Показать"));
    act(() => show.click());
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
