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
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
SVGElement.prototype.getTotalLength ??= () => 100;
SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
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
    await click([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Слово"));
    await type(host.querySelector('[aria-label="Слово или слог"]'), "кот@");
    await click(btn(host, "+ Строка"));
    expect(host.querySelector("[role=alert]")?.textContent).toContain("«@»");
    await type(host.querySelector('[aria-label="Текст строки"]'), "кот");
    expect(host.querySelector("[role=alert]")).toBeNull();

    await click(btn(host, "Показать ученику"));
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
    expect(host.querySelector('[aria-label="Название страницы"]').value).toBe("Заглавные Н Ю К");
    expect(host.querySelector('[data-testid="propis2-preview"] svg path')).not.toBeNull();

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
    const tab = (name) => [...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === name);
    await click(tab("Слово"));
    await setValue(host.querySelector('[aria-label="Слово или слог"]'), "а");
    await click(btn("+ Строка"));
    await setValue(host.querySelector('[aria-label="Слово или слог"]'), "б");
    await click(btn("+ Строка"));
    expect(btn("Из отмеченного").disabled).toBe(true);
    await click(host.querySelector('[aria-label="Повторить строку"]'));
    expect(btn("Из отмеченного").disabled).toBe(false);

    // a passage row and a blank row can be added too
    await click(tab("Текст"));
    await setValue(host.querySelector('[aria-label="Текст для страницы"]'), "мама мыла раму", HTMLTextAreaElement.prototype);
    await click(btn("+ Текст"));
    expect(host.querySelector('textarea[aria-label="Текст строки"]')).not.toBeNull();
    await click(tab("Слово"));
    await click(btn("+ Пустая"));
    expect(host.textContent).toContain("Пустая строка — место для письма");

    await click(btn("Из отмеченного"));
    expect(host.querySelector('[aria-label="Название страницы"]').value).toContain("повторение");
    expect(host.querySelector('[data-testid="propis2-preview"] svg path')).not.toBeNull();

    await click(host.querySelector(".back-btn"));
    expect(host.querySelectorAll('[data-testid="propis2-page-card"]')).toHaveLength(2);
    await act(async () => { root.unmount(); await tick(500); });
    host.remove();
  });

  it("tap on a row opens the show panel (repeat, slow, close) and closing keeps the page you were on", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text));

    // a page long enough for two screens: pick the ready sheet (12 rows) and add more rows
    const select = host.querySelector('[aria-label="Готовый набор"]');
    await act(async () => { select.value = "part1"; select.dispatchEvent(new Event("change", { bubbles: true })); await tick(); });
    await click(btn("Показать ученику"));
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    expect(host.querySelector('[data-testid="propis2-panel"]')).toBeNull();

    const counterBefore = host.querySelector(".propis-text-nav__counter").textContent;
    await click(host.querySelector('[aria-label="Следующая страница"]'));
    const counterAfter = host.querySelector(".propis-text-nav__counter").textContent;
    expect(counterAfter).not.toBe(counterBefore);

    await click(host.querySelector(".propis-text-word-hit"));
    const panel = host.querySelector('[data-testid="propis2-panel"]');
    expect(panel).not.toBeNull();
    expect(panel.querySelector("svg")).not.toBeNull();
    // only one animation at a time: the page behind shows no inline animation
    expect(host.querySelectorAll('[data-testid="propis2-view"] > .propis-practice-stage [data-pr-anim]')).toHaveLength(0);

    const slow = btn("Медленно");
    await click(slow);
    expect(btn("Обычная скорость")).toBeTruthy();
    await click(btn("Повтор"));
    expect(host.querySelector('[data-testid="propis2-panel"]')).not.toBeNull();

    await click(btn("Закрыть"));
    expect(host.querySelector('[data-testid="propis2-panel"]')).toBeNull();
    expect(host.querySelector(".propis-text-nav__counter").textContent).toBe(counterAfter);

    await act(async () => { root.unmount(); await tick(100); });
    host.remove();
  }, 40000);

  it("sets: build a booklet from pages, reorder, duplicate a page inside, show as one booklet with set page numbers", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    const setValue = async (el, value, proto = HTMLInputElement.prototype) => {
      await act(async () => {
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
        el.dispatchEvent(new Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
        await tick();
      });
    };
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text));

    // two pages
    for (const [title, text] of [["Страница А", "а"], ["Страница Б", "б"]]) {
      await click(btn("Новая страница"));
      await setValue(host.querySelector('[aria-label="Название страницы"]'), title);
      await click([...host.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Слово"));
      await setValue(host.querySelector('[aria-label="Слово или слог"]'), text);
      await click(btn("+ Строка"));
      await click(host.querySelector(".back-btn"));
    }
    expect(host.querySelectorAll('[data-testid="propis2-page-card"]')).toHaveLength(2);

    await click(btn("Новый комплект"));
    expect(host.querySelector('[data-testid="propis2-set-editor"]')).not.toBeNull();
    await setValue(host.querySelector('[aria-label="Название комплекта"]'), "Урок 1");
    const add = host.querySelector('[aria-label="Добавить страницу в комплект"]');
    const options = [...add.querySelectorAll("option")].filter((o) => o.value);
    expect(options).toHaveLength(2);
    await setValue(add, options[0].value, HTMLSelectElement.prototype);
    await setValue(host.querySelector('[aria-label="Добавить страницу в комплект"]'), options[1].value, HTMLSelectElement.prototype);
    expect(host.querySelectorAll('[data-testid="propis2-set-page"]')).toHaveLength(2);
    const titlesOf = () => [...host.querySelectorAll('[data-testid="propis2-set-page"] strong')].map((e) => e.textContent);
    const first = titlesOf();
    await click(host.querySelectorAll('[aria-label="Страницу ниже"]')[0]);
    expect(titlesOf()).toEqual([first[1], first[0]]);
    await click(host.querySelectorAll('[aria-label="Дублировать страницу"]')[0]);
    expect(host.querySelectorAll('[data-testid="propis2-set-page"]')).toHaveLength(3);
    expect(titlesOf()[1]).toContain("(копия)");
    expect(host.textContent).toContain("с листа 1");
    expect(host.textContent).toContain("с листа 2");

    await click(btn("Показать комплект как ученику"));
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    // 3 pages -> exactly 3 screen pages (v1 pads to an even count; propis2 sets exactPages)
    expect(host.querySelector(".propis-text-nav__counter").textContent).toBe("Страница 1 из 3");
    await click(host.querySelector(".propis-practice-close"));
    expect(host.querySelector('[data-testid="propis2-set-editor"]')).not.toBeNull();
    await click(host.querySelector(".back-btn"));
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(1);

    await act(async () => { root.unmount(); await tick(500); });
    host.remove();
  }, 40000);

  it("editor: the page preview follows the typing; carousel tiles are tapped or dragged onto a row", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => b.textContent.includes(text));
    await click(btn("Новая страница"));
    const preview = () => host.querySelector('[data-testid="propis2-preview"]');
    const ink = () => preview().querySelectorAll("svg path").length;
    expect(host.querySelector('[data-testid="propis2-carousel"]')).not.toBeNull();
    const before = ink();

    // tap on a tile: the letter lands on the page and its row is selected
    await act(async () => { host.querySelector('[data-tile="к"]').click(); await tick(60); });
    expect(ink()).toBeGreaterThan(before);
    expect(host.querySelector('[aria-label="Текст строки"]').value).toBe("к");
    expect(preview().querySelector('[data-overlay="select"]')).not.toBeNull();

    // the slant grid: «Частая» draws a line every 5 mm instead of every 20, the dashes can be switched off
    const lines = () => preview().querySelectorAll("[data-simple-grid] line").length;
    expect(preview().querySelector('[data-simple-grid="regular"]')).not.toBeNull();
    const sparse = lines();
    await click([...host.querySelectorAll("button")].find((b) => b.textContent === "Частая"));
    await act(async () => { await tick(60); });
    expect(preview().querySelector('[data-simple-grid="dense"]')).not.toBeNull();
    expect(lines()).toBeGreaterThan(sparse * 2);
    await click([...host.querySelectorAll("button")].find((b) => b.textContent === "Клетка"));
    await act(async () => { await tick(60); });
    expect(preview().querySelector('[data-simple-grid="square"]')).not.toBeNull();
    expect(preview().querySelectorAll('[data-simple-grid="square"] line').length).toBeGreaterThan(40);
    await click([...host.querySelectorAll("button")].find((b) => b.textContent === "Частая"));
    await act(async () => { await tick(60); });
    const dashed = () => preview().querySelectorAll("line[stroke-dasharray]").length;
    const withDash = dashed();
    expect(withDash).toBeGreaterThan(0);
    await click(host.querySelector('[aria-label="Пунктир в серединных линиях"]'));
    await act(async () => { await tick(60); });
    expect(dashed()).toBe(0);
    await click(host.querySelector('[aria-label="Пунктир в серединных линиях"]'));
    await click([...host.querySelectorAll("button")].find((b) => b.textContent === "Редкая"));
    await act(async () => { await tick(60); });

    // typing in the row panel changes the page
    const afterTap = ink();
    await act(async () => {
      const input = host.querySelector('[aria-label="Текст строки"]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "кот");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await tick(60);
    });
    expect(ink()).toBeGreaterThan(afterTap);

    // drag a tile from the carousel onto the third row of the page
    const svg = preview().querySelector("svg.propis-print-page-svg");
    const vbH = Number(svg.getAttribute("viewBox").split(/\s+/)[3]);
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: vbH, width: 400, height: vbH });
    let y = 0;
    while (rowAtSvgY(y) !== 2 && y < vbH) y += 1;
    const fire = (target, type, x, yy) => target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: yy, button: 0 }));
    const tile = host.querySelector('[data-tile="м"]');
    await act(async () => { fire(tile, "pointerdown", 20, 20); await tick(); });
    await act(async () => { fire(window, "pointermove", 120, y + 5); await tick(); });
    expect(host.querySelector(".propis2-ghost")).not.toBeNull();
    expect(preview().querySelector('[data-overlay="drop"]')).not.toBeNull();
    await act(async () => { fire(window, "pointerup", 120, y + 5); await tick(60); });
    expect(host.querySelector(".propis2-ghost")).toBeNull();
    expect(host.querySelector('[aria-label="Текст строки"]').value).toBe("м");
    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);
});
