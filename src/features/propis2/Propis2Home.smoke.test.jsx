import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach } from "vitest";
import { openDb } from "@/core/db";
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

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const freshDb = () => openDb("p2home-" + Date.now() + Math.random());

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

  it("end to end: create a page, edit rows, warn on bad rows, show to the student, reopen after reload", async () => {
    const db = await freshDb();
    const render = async () => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
      return { host, root };
    };
    const click = async (el) => { await act(async () => { el.click(); await tick(); }); };
    const type = async (input, value) => {
      await act(async () => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        await tick();
      });
    };
    const btn = (host, text) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text));

    let { host, root } = await render();
    expect(host.querySelector('[data-testid="propis2-library"]')).not.toBeNull();
    expect(host.textContent).toContain("Страниц пока нет");

    await click(btn(host, "Новая страница"));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
    await type(host.querySelector('[aria-label="Название страницы"]'), "Мои буквы");
    await type(host.querySelector('[aria-label="Содержимое строки 1"]'), "кот!");
    expect(host.querySelector(".propis2-warn")?.textContent).toContain("«!»");
    await type(host.querySelector('[aria-label="Содержимое строки 1"]'), "кот");
    expect(host.querySelector(".propis2-warn")).toBeNull();

    await click(btn(host, "Показать как ученику"));
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    await click(host.querySelector(".propis-practice-close"));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();

    await act(async () => { root.unmount(); await tick(500); });
    host.remove();

    ({ host, root } = await render());
    const cards = host.querySelectorAll('[data-testid="propis2-page-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain("Мои буквы");
    expect(cards[0].textContent).toContain("1 строк");

    await click(btn(host, "Копия"));
    expect(host.querySelectorAll('[data-testid="propis2-page-card"]')).toHaveLength(2);

    const select = host.querySelector('[aria-label="Готовый набор"]');
    await act(async () => { select.value = "page18"; select.dispatchEvent(new Event("change", { bubbles: true })); await tick(); });
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
    expect(host.querySelectorAll(".propis2-rows li")).toHaveLength(deckRecord().wideSheets.page18.length);

    await act(async () => { root.unmount(); await tick(500); });
    host.remove();
  });

  it("marking rows and creating a repetition page from them; passage and blank rows are accepted", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.click(); await tick(); }); };
    const setValue = async (el, value, proto = HTMLInputElement.prototype) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
        el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
        await tick();
      });
    };
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text));

    await click(btn("Новая страница"));
    await setValue(host.querySelector('[aria-label="Содержимое строки 1"]'), "а");
    await click(btn("+ Строка"));
    await setValue(host.querySelector('[aria-label="Содержимое строки 2"]'), "б");
    expect(btn("Страница из отмеченного").disabled).toBe(true);
    await click(host.querySelector('[aria-label="Повторить строку 1"]'));
    expect(btn("Страница из отмеченного").disabled).toBe(false);

    // a passage row and a blank row are selectable kinds
    await click(btn("+ Строка"));
    await setValue(host.querySelector('[aria-label="Тип строки 3"]'), "passage", HTMLSelectElement.prototype);
    expect(host.querySelector('textarea[aria-label="Содержимое строки 3"]')).not.toBeNull();
    await setValue(host.querySelector('[aria-label="Тип строки 3"]'), "blank", HTMLSelectElement.prototype);
    expect(host.textContent).toContain("Пустая строка — место для письма");

    await click(btn("Страница из отмеченного"));
    expect(host.querySelectorAll(".propis2-rows li")).toHaveLength(1);
    expect(host.querySelector('[aria-label="Содержимое строки 1"]').value).toBe("а");
    expect(host.querySelector('[aria-label="Название страницы"]').value).toContain("повторение");

    await click(host.querySelector(".back-btn"));
    expect(host.querySelectorAll('[data-testid="propis2-page-card"]')).toHaveLength(2);
    await act(async () => { root.unmount(); await tick(500); });
    host.remove();
  });
});
