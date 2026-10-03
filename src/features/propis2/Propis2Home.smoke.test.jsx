import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import Propis2Home from "./Propis2Home.jsx";
import { BUILTIN_TOPICS } from "@/topics/builtinTopics";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { PROPIS2_SHEETS } from "@/topics/renderers/propis2/data.js";
import { layoutWideLinesIntoRows } from "@/topics/renderers/propis/wordEngine.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

describe("Прописи 2 skeleton", () => {
  it("is a builtin topic wired into both registries", () => {
    const rec = BUILTIN_TOPICS.find((t) => t.meta.id === "propis2");
    expect(rec?.meta.renderer).toBe("propis2");
    expect(rec.modes).toHaveLength(1);
    expect(RENDERER_REGISTRY.propis2).toBeTypeOf("function");
    expect(ENGINE_REGISTRY.propis2().length).toBe(1);
  });

  it("bundled data lays out a ready sheet through the shared engine", () => {
    const task = buildPageTask({ lines: PROPIS2_SHEETS.page18 });
    expect(task.lines.length).toBe(PROPIS2_SHEETS.page18.length);
    const map = new Map(task.wideGlyphs.map((g) => [g.label, g]));
    const { placed } = layoutWideLinesIntoRows(task.lines, map, undefined, true, 0.5);
    expect(placed.length).toBe(task.lines.length);
    for (const row of placed) expect(row.segments.length).toBe(1);
  });

  it("home screen renders the row list and opens the page view", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    act(() => root.render(<Propis2Home />));
    expect(host.querySelector('[data-testid="propis2-home"]')).not.toBeNull();
    expect(host.querySelectorAll(".propis2-rows li").length).toBe(PROPIS2_SHEETS.page18.length);
    const show = [...host.querySelectorAll("button")].find((b) => b.textContent.includes("Показать"));
    act(() => show.click());
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    act(() => root.unmount());
    host.remove();
  });
});
