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

// controls of the constructor are icons: they are found by aria-label
const byLabel = (host, name, exact = false) => [...host.querySelectorAll("button")].find((b) => { const t = b.getAttribute("aria-label") ?? b.textContent; return exact ? t === name : t.includes(name); });
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
    const btn = (host, text) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes(text));

    let { host, root } = await render();
    expect(host.querySelector('[data-testid="propis2-library"]')).not.toBeNull();
    expect(host.textContent).toContain("Страниц пока нет");

    await click(btn(host, "Новая страница"));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
    await type(host.querySelector('[aria-label="Название страницы"]'), "Мои буквы");
    await click([...host.querySelectorAll('[role="tab"]')].find((t) => (t.getAttribute("aria-label") ?? t.textContent) === "Слово"));
    await type(host.querySelector('[aria-label="Слово или слог"]'), "кот@");
    await click(btn(host, "+ Строка"));
    expect(host.querySelector("[role=alert]")?.textContent).toContain("@");
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
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes(text));

    await click(btn("Новая страница"));
    const tab = (name) => [...host.querySelectorAll('[role="tab"]')].find((t) => (t.getAttribute("aria-label") ?? t.textContent) === name);
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
    expect(host.querySelector('[aria-label="Пустая строка — место для письма"]')).not.toBeNull();

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
    await click(byLabel(host, "Показать ученику"));
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
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes(text));

    // two pages
    for (const [title, text] of [["Страница А", "а"], ["Страница Б", "б"]]) {
      await click(btn("Новая страница"));
      await setValue(host.querySelector('[aria-label="Название страницы"]'), title);
      await click([...host.querySelectorAll('[role="tab"]')].find((t) => (t.getAttribute("aria-label") ?? t.textContent) === "Слово"));
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

  it("editor: select a row and tap symbols; grid kinds (прописи / клетка / линейка); the wide ruling hides tiles", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    await click([...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes("Новая страница")));
    const preview = () => host.querySelector('[data-testid="propis2-preview"]');
    const ink = () => preview().querySelectorAll("svg path").length;
    const tile = (c) => host.querySelector(`[data-tile="${c}"]`);
    const input = () => host.querySelector('[aria-label="Текст строки"]');
    expect(host.querySelector('[data-testid="propis2-carousel"]')).not.toBeNull();
    expect(host.querySelectorAll(".propis2-tile").length).toBeGreaterThan(20); // a grid, not a strip
    const before = ink();

    // no row selected: a tapped symbol starts a row; the next taps add to the selected row
    await click(tile("к"));
    expect(input().value).toBe("к");
    expect(ink()).toBeGreaterThan(before);
    expect(preview().querySelector('[data-overlay="select"]')).not.toBeNull();
    await click(tile("о"));
    await click(tile("т"));
    expect(input().value).toBe("кот");
    await click(host.querySelector('[aria-label="Стереть последний символ"]'));
    expect(input().value).toBe("ко");
    // an element takes the row over
    await click([...host.querySelectorAll('[role="tab"]')].find((t) => (t.getAttribute("aria-label") ?? t.textContent) === "Элементы"));
    await click(host.querySelectorAll(".propis2-tile")[0]);
    // the row options (above the canvas) apply to the selected row; a picker shows the current value, its variants drop down
    const pickBtn = (group) => host.querySelector(`button[aria-label="${group}"][aria-haspopup]`);
    const pick = async (group, option) => { await click(pickBtn(group)); await click([...host.querySelectorAll(`[role="listbox"][aria-label="${group}"] button`)].find((b) => b.getAttribute("aria-label") === option)); };
    expect(pickBtn("Повтор").disabled).toBe(false);
    await pick("Повтор", "Повтор с затуханием");
    expect(pickBtn("Повтор").dataset.value).toBe("fade");
    await pick("Красные точки", "Без красных точек");
    expect(pickBtn("Красные точки").dataset.value).toBe("none");

    // grid kinds: «Прописи» keeps the slant-grid options, «Клетка» / «Линейка» switch them off
    const slant = () => [pickBtn("Косая линейка")];
    const dash = () => host.querySelector('[aria-label="Пунктир в серединных линиях"]');
    // the default: прописи / узкая / частая
    expect(preview().querySelector('[data-simple-grid="dense"]')).not.toBeNull();
    expect(pickBtn("Разлиновка").dataset.value).toBe("narrow");
    expect(slant().every((b) => !b.disabled)).toBe(true);
    const dense = preview().querySelectorAll("[data-simple-grid] line").length;
    await pick("Косая линейка", "Редкая");
    await act(async () => { await tick(60); });
    expect(preview().querySelector('[data-simple-grid="regular"]')).not.toBeNull();
    expect(dense).toBeGreaterThan(preview().querySelectorAll("[data-simple-grid] line").length * 2);
    await pick("Косая линейка", "Частая");
    await act(async () => { await tick(60); });
    expect(preview().querySelectorAll("line[stroke-dasharray]").length).toBeGreaterThan(0);
    await click(dash());
    await act(async () => { await tick(60); });
    expect(preview().querySelectorAll("line[stroke-dasharray]").length).toBe(0);
    await click(dash());

    await pick("Тип бумаги", "Клетка");
    await act(async () => { await tick(60); });
    expect(preview().querySelector('[data-simple-grid="square"]')).not.toBeNull();
    expect(slant().every((b) => b.disabled)).toBe(true);
    expect(dash().disabled).toBe(true);
    expect(preview().querySelectorAll("line[stroke-dasharray]").length).toBe(0);
    await pick("Тип бумаги", "Линейка");
    await act(async () => { await tick(60); });
    expect(preview().querySelector("[data-simple-grid]")).toBeNull();
    expect(slant().every((b) => b.disabled)).toBe(true);
    await pick("Тип бумаги", "Прописи");
    await act(async () => { await tick(60); });
    expect(preview().querySelector('[data-simple-grid="dense"]')).not.toBeNull();
    expect(slant().every((b) => !b.disabled)).toBe(true);

    // wide ruling: the slants are clipped to the wide bands (none in the narrow strips between them); the dashes are slightly red
    await pick("Разлиновка", "Широкая");
    await act(async () => { await tick(60); });
    const grid = preview().querySelector("[data-simple-grid]");
    expect(grid.getAttribute("clip-path")).toMatch(/^url\(#p2c/);
    expect([...preview().querySelectorAll("rect")].filter((r) => r.parentElement.tagName.toLowerCase() === "clippath").length).toBe(16);
    expect(preview().querySelector("line[stroke-dasharray]").getAttribute("stroke")).toBe("#e57d7a");
    await pick("Разлиновка", "Узкая");
    await act(async () => { await tick(60); });
    expect(preview().querySelector("[data-simple-grid]").getAttribute("clip-path")).toBeNull();

    // wide ruling: no capitals tab
    const tabs = () => [...host.querySelectorAll('[data-testid="propis2-carousel"] [role="tab"]')].map((t) => t.getAttribute("aria-label"));
    expect(tabs()).toContain("Заглавные");
    await pick("Разлиновка", "Широкая");
    expect(tabs()).not.toContain("Заглавные");
    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);

  it("a tap on an empty ruled row selects it (it is created), then a symbol goes into it; the panel sizes stay fixed", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el, init = {}) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init })); await tick(60); }); };
    await click([...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes("Новая страница")));
    const preview = () => host.querySelector('[data-testid="propis2-preview"]');
    const svg = preview().querySelector("svg.propis-print-page-svg");
    const vbH = Number(svg.getAttribute("viewBox").split(/\s+/)[3]);
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: vbH, width: 400, height: vbH });
    const yOfRow = (r) => { let y = 0; while (rowAtSvgY(y) !== r && y < vbH) y += 1; return y + 4; };
    expect(host.querySelector('[data-testid="propis2-row-panel"]')).toBeNull();
    const bar = () => host.querySelector(".propis2-dock-bar");
    const dock = () => host.querySelector(".propis2-dock");
    expect(bar()).not.toBeNull();
    // tap row 3 of an empty page: a row is created there and selected
    await click(host.querySelector(".propis2-page-col"), { clientX: 100, clientY: yOfRow(3) });
    expect(host.querySelector('[data-testid="propis2-row-panel"]')).not.toBeNull();
    expect(preview().querySelector('[data-overlay="select"]')).not.toBeNull();
    await click(host.querySelector('[data-tile="м"]'));
    expect(host.querySelector('[aria-label="Текст строки"]').value).toBe("м");
    // the bottom panel is the same box with and without a selected row (its bar and body are separate fixed zones)
    expect(bar().className).toBe("propis2-dock-bar");
    expect(dock().querySelector(".propis2-dock-body")).not.toBeNull();
    // a tap outside the ruled rows clears the selection
    await click(host.querySelector(".propis2-page-col"), { clientX: 100, clientY: vbH + 500 });
    expect(host.querySelector('[data-testid="propis2-row-panel"]')).toBeNull();
    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);

  it("presets: a page from a preset is locked until cleared (undo brings it back); save a page as «Мои» preset", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    const setValue = async (el, value) => { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); await tick(); }); };
    const lbl = (name) => host.querySelector(`[aria-label="${name}"]`);
    const select = lbl("Готовый набор");
    expect([...select.querySelectorAll("optgroup")].map((g) => g.label)).toEqual(["Методика"]);
    await act(async () => { select.value = "page18"; select.dispatchEvent(new Event("change", { bubbles: true })); await tick(); });

    // locked: layout controls are off, the lock marker and «Очистить страницу» are there
    expect(lbl("Тип бумаги").disabled).toBe(true);
    expect(lbl("Разлиновка").disabled).toBe(true);
    expect(lbl("Строка для письма после каждой строки").disabled).toBe(true);
    await click(lbl("Слово"));
    expect(lbl("+ Пустая строка").disabled).toBe(true);
    expect(host.querySelector('[role="img"][aria-label^="Страница из пресета"]')).not.toBeNull();
    const rowsBefore = host.querySelectorAll('[data-testid="propis2-preview"] svg path').length;
    await click(lbl("Очистить страницу"));
    expect(lbl("Тип бумаги").disabled).toBe(false);
    expect(host.querySelector('[role="img"][aria-label^="Страница из пресета"]')).toBeNull();
    expect(host.querySelectorAll('[data-testid="propis2-preview"] svg path').length).toBeLessThan(rowsBefore);
    await click(lbl("Отменить очистку"));
    expect(lbl("Тип бумаги").disabled).toBe(true);
    expect(host.querySelectorAll('[data-testid="propis2-preview"] svg path').length).toBe(rowsBefore);

    // save it as «Мои»
    await click(lbl("Пресеты"));
    await setValue(lbl("Название пресета"), "Мой пресет");
    await click(lbl("Сохранить как пресет"));
    await click(lbl("Назад"));
    const groups = [...lbl("Готовый набор").querySelectorAll("optgroup")];
    expect(groups.map((g) => g.label)).toEqual(["Методика", "Мои"]);
    expect(groups[1].textContent).toContain("Мой пресет");

    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);
});
