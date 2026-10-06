import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { api } from "@/core/api";
import { pushOp } from "@/core/syncApi";
import { openDb } from "@/core/db";
import { saveLibrary, emptyLibrary, upsertPage, upsertSet } from "@/topics/renderers/propis2/storage.js";
import { newPage, newSet, newRow } from "@/topics/renderers/propis2/model.js";
import { readFileSync } from "node:fs";
import Propis2Home from "./Propis2Home.jsx";
import { useAppStore } from "@/core/store";
import { BUILTIN_TOPIC_IDS } from "@/topics/builtinTopics";
import { RENDERER_REGISTRY } from "@/topics/registry";
import { ENGINE_REGISTRY } from "@/topics/renderers/engineRegistry";
import { buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { layoutWideLinesIntoRows } from "@/topics/renderers/propis/wordEngine.js";
import { rowAtSvgY } from "@/topics/renderers/propis/PrintPageView";

vi.mock("@/core/syncApi", async (orig) => ({ ...(await orig()), pushOp: vi.fn(() => Promise.resolve()) }));

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
const dlgBtn = (host, text) => [...host.querySelectorAll('[data-testid="propis2-save-dialog"] button')].find((b) => b.textContent.includes(text));
const byLabel = (host, name, exact = false) => [...host.querySelectorAll("button")].find((b) => { const t = b.getAttribute("aria-label") ?? b.textContent; return exact ? t === name : t.includes(name); });
// the one text field of the constructor: the system keyboard types into it
const fieldOf = (host) => host.querySelector('[aria-label="Текст страницы"]');
const typeInField = async (host, value) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(fieldOf(host), value);
    fieldOf(host).dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
  });
};
const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const freshDb = () => openDb("p2home-" + Date.now() + Math.random());

describe("Прописи 2 (zip topic)", () => {
  beforeEach(() => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("offline"));
    pushOp.mockClear();
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
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(0);

    await click(btn(host, "Новая тетрадь"));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
    await type(host.querySelector('[aria-label="Название страницы"]'), "Мои буквы");
    await typeInField(host, "кот@");
    expect(host.querySelector("[role=alert]")?.textContent).toContain("@");
    await typeInField(host, "кот");
    expect(host.querySelector("[role=alert]")).toBeNull();

    await click(btn(host, "Показать ученику"));
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    await click(host.querySelector(".propis-practice-close"));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();

    // nothing is kept until it is confirmed: the save button asks for the name of a new notebook
    await click(byLabel(host, "Сохранить тетрадь"));
    expect(host.querySelector('[data-testid="propis2-save-dialog"]')).not.toBeNull();
    await click(dlgBtn(host, "Сохранить"));
    expect(host.querySelector('[data-testid="propis2-save-dialog"]')).toBeNull();
    expect(byLabel(host, "Сохранить тетрадь").disabled).toBe(true); // nothing unsaved now

    await act(async () => { root.unmount(); await tick(500); });
    host.remove();

    ({ host, root } = await render());
    const cards = host.querySelectorAll('[data-testid="propis2-set-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain("Мои буквы");
    expect(cards[0].textContent).toContain("1 стр.");

    // rename right in the library: a tap on the name makes it a field; Enter saves, no editor needed
    await click(host.querySelector('[aria-label^="Переименовать тетрадь"]'));
    const nameField = host.querySelector('input[aria-label="Название тетради"]');
    await type(nameField, "Урок про букву М");
    await act(async () => { nameField.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })); await tick(); });
    expect(host.querySelector('input[aria-label="Название тетради"]')).toBeNull();
    expect(host.querySelector('[data-testid="propis2-set-card"]').textContent).toContain("Урок про букву М");

    await click(btn(host, "Копия"));
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(2);

    // a ready notebook lies in the list like our own: editing it makes our copy quietly
    expect(host.querySelectorAll('[data-testid="propis2-ready-card"]').length).toBeGreaterThan(5);
    await click(host.querySelector('[aria-label="Изменить тетрадь Листы методики, часть 2 (узкая строка)"]'));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Название страницы"]').value).toBe("Лист с р");
    expect(host.querySelector('[data-testid="propis2-preview"] svg path')).not.toBeNull();

    await act(async () => { root.unmount(); await tick(500); });
    host.remove();
  });

  it("passage and blank rows are accepted", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.click(); await tick(); }); };
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes(text));

    await click(btn("Новая тетрадь"));
    // Enter makes the next row: two sample rows, running text (more than two words), a blank writing row
    await typeInField(host, "а\nб\nмама мыла раму\n\nв");
    expect(fieldOf(host).value).toBe("а\nб\nмама мыла раму\n\nв");
    expect(btn("Из отмеченного")).toBeUndefined();
    expect(host.querySelector('[data-testid="propis2-preview"] svg path')).not.toBeNull();

    await click(host.querySelector(".back-btn"));
    await click(dlgBtn(host, "Сохранить")); // leaving a new notebook with changes asks; saving puts it in the list
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(1);
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
    await click(host.querySelector('[aria-label="Изменить тетрадь Листы методики, часть 1 (широкая строка)"]'));
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

  it("notebook: add / copy / move pages in the editor, show as one notebook with its page numbers", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.click(); await tick(); }); };
    const btn = (text) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes(text));
    const pos = () => host.querySelector(".p2-pager-pos")?.textContent;

    await click(btn("Новая тетрадь"));
    expect(host.querySelector(".p2-pager-pos")).toBeNull(); // one page: no pager counter
    await typeInField(host, "а");
    await click(host.querySelector('[aria-label="Добавить страницу"]'));
    expect(pos()).toBe("Стр. 2 из 2");
    await typeInField(host, "б");
    // the paper is the notebook's: changed on page 2, it is changed on page 1 too
    const kindBtn = () => host.querySelector('button[aria-label="Тип бумаги"]');
    const before = kindBtn().getAttribute("data-value");
    await click(kindBtn());
    await click([...host.querySelectorAll('[role="option"]')].find((o) => !o.classList.contains("is-on")));
    const kind = kindBtn().getAttribute("data-value");
    expect(kind).not.toBe(before);
    await click(host.querySelector('[aria-label="Предыдущая страница"]'));
    expect(kindBtn().getAttribute("data-value")).toBe(kind);
    await click(host.querySelector('[aria-label="Следующая страница"]'));
    await click(host.querySelector('[aria-label="Копия страницы"]'));
    expect(pos()).toBe("Стр. 3 из 3");
    await click(host.querySelector('[aria-label="Переместить страницу раньше"]'));
    expect(pos()).toBe("Стр. 2 из 3");

    await click(btn("Показать ученику"));
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    // 3 pages -> exactly 3 screen pages (v1 pads to an even count; propis2 sets exactPages)
    expect(host.querySelector(".propis-text-nav__counter").textContent).toBe("Страница 1 из 3");
    await click(host.querySelector(".propis-practice-close"));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
    await click(host.querySelector(".back-btn"));
    await click(dlgBtn(host, "Сохранить"));
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(1);
    expect(host.querySelector('[data-testid="propis2-set-card"]').textContent).toContain("3 стр.");

    await act(async () => { root.unmount(); await tick(500); });
    host.remove();
  }, 40000);

  it("editor: type rows in the field and pick elements; row options; grid kinds (прописи / клетка / линейка)", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    await click([...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes("Новая тетрадь")));
    const preview = () => host.querySelector('[data-testid="propis2-preview"]');
    const ink = () => preview().querySelectorAll("svg path").length;
    const before = ink();

    // typing in the field starts rows; the row the caret is in is selected; Enter makes the next row
    await typeInField(host, "к");
    expect(fieldOf(host).value).toBe("к");
    expect(ink()).toBeGreaterThan(before);
    expect(preview().querySelector('[data-overlay="select"]')).not.toBeNull();
    await typeInField(host, "кот\nм");
    expect(host.querySelectorAll('[data-overlay="select"]').length).toBeLessThanOrEqual(1);
    // the list of elements: a tap puts the element's id at the caret as a word of its own (mid-line too)
    await click(host.querySelector('button[aria-label="Элементы"]'));
    const elementTiles = host.querySelectorAll('[role="dialog"][aria-label="Элементы"] .propis2-tile');
    expect(elementTiles.length).toBeGreaterThan(5);
    await click(elementTiles[0]);
    expect(fieldOf(host).value).toContain(elementTiles[0].getAttribute("data-tile"));
    expect(fieldOf(host).value.startsWith("кот\nм")).toBe(true);
    await typeInField(host, "кот\nм"); // back to sample rows for the row options below
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

    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);

  it("a tap on an empty ruled row selects it (it is created); the field starts at the selected row", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el, init = {}) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init })); await tick(60); }); };
    await click([...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes("Новая тетрадь")));
    const preview = () => host.querySelector('[data-testid="propis2-preview"]');
    const svg = preview().querySelector("svg.propis-print-page-svg");
    const vbH = Number(svg.getAttribute("viewBox").split(/\s+/)[3]);
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: vbH, width: 400, height: vbH });
    const yOfRow = (r) => { let y = 0; while (rowAtSvgY(y) !== r && y < vbH) y += 1; return y + 4; };
    expect(preview().querySelector('[data-overlay="select"]')).toBeNull();
    // tap row 3 of an empty page: a row is created there and selected; the field starts at it and is empty
    await click(host.querySelector(".propis2-page-col"), { clientX: 100, clientY: yOfRow(3) });
    expect(preview().querySelector('[data-overlay="select"]')).not.toBeNull();
    expect(fieldOf(host).value).toBe("");
    // typing writes into that row (blank rows fill the gap above it)
    await typeInField(host, "м");
    expect(fieldOf(host).value).toBe("м");
    // another tap on it shows its text again; a tap on a row above starts the field there and shows everything below
    await click(host.querySelector(".propis2-page-col"), { clientX: 100, clientY: yOfRow(3) });
    expect(fieldOf(host).value).toBe("м");
    await click(host.querySelector(".propis2-page-col"), { clientX: 100, clientY: yOfRow(1) });
    expect(fieldOf(host).value).toBe("\n\nм");
    // a tap outside the ruled rows clears the selection and empties the field (the next typing goes below the last row)
    await click(host.querySelector(".propis2-page-col"), { clientX: 100, clientY: vbH + 500 });
    expect(preview().querySelector('[data-overlay="select"]')).toBeNull();
    expect(fieldOf(host).value).toBe("");
    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);

  it("kits: a page from a kit is locked until cleared (undo brings it back); save a page as «Мои» preset", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    const setValue = async (el, value) => { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, value); el.dispatchEvent(new Event("input", { bubbles: true })); await tick(); }); };
    const lbl = (name) => host.querySelector(`[aria-label="${name}"]`);
    await click(lbl("Изменить тетрадь Листы методики, часть 2 (узкая строка)"));

    // locked: layout controls are off, the lock marker and «Очистить страницу» are there
    expect(lbl("Тип бумаги").disabled).toBe(true);
    expect(lbl("Разлиновка").disabled).toBe(true);
    expect(lbl("Строка для письма после каждой строки").disabled).toBe(true);
    expect(lbl("Текст страницы").disabled).toBe(true); // no row selected yet: nothing to edit
    expect(host.querySelector('[role="img"][aria-label^="Страница из тетради"]')).not.toBeNull();
    const rowsBefore = host.querySelectorAll('[data-testid="propis2-preview"] svg path').length;
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    await click(lbl("Очистить страницу"));
    expect(lbl("Тип бумаги").disabled).toBe(true); // declined: nothing erased
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await click(lbl("Очистить страницу"));
    expect(lbl("Тип бумаги").disabled).toBe(false);
    expect(host.querySelector('[role="img"][aria-label^="Страница из тетради"]')).toBeNull();
    expect(host.querySelectorAll('[data-testid="propis2-preview"] svg path').length).toBeLessThan(rowsBefore);
    await click(lbl("Отменить очистку"));
    expect(lbl("Тип бумаги").disabled).toBe(true);
    // the pencil unlocks the layout and keeps the rows
    await click(lbl("Редактировать страницу"));
    expect(lbl("Тип бумаги").disabled).toBe(false);
    expect(host.querySelector('[role="img"][aria-label^="Страница из тетради"]')).toBeNull();
    expect(host.querySelectorAll('[data-testid="propis2-preview"] svg path').length).toBe(rowsBefore);
    expect(host.querySelectorAll('[data-testid="propis2-preview"] svg path').length).toBe(rowsBefore);

    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);

  it("sync: a new page goes to the account (one kv document), an account page shows up here", async () => {
    const db = await freshDb();
    const remotePage = { id: "pg_remote", title: "С планшета", ruling: "narrow", grid: "dense", rows: [{ id: "r1", kind: "text", text: "и", mark: "", marked: false }], updatedAt: Date.now() + 1000, createdAt: 1 };
    api.get.mockResolvedValue({ kv: [{ key: "propis2:page:pg_remote", value: remotePage }] });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(60); });
    expect(api.get.mock.calls[0][0]).toContain("prefix=propis2%3A");
    expect(host.textContent).toContain("С планшета");
    const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
    await click(byLabel(host, "Новая тетрадь"));
    await typeInField(host, "и");
    await click(byLabel(host, "Сохранить тетрадь"));
    await click(dlgBtn(host, "Сохранить"));
    await act(async () => { await tick(500); });
    const keys = pushOp.mock.calls.filter((c) => c[0] === "kv.upsert").map((c) => c[1].key);
    // a new notebook = its page + the notebook; the account's loose page became a notebook of its own (same id on every device)
    const pageKeys = keys.filter((k) => k.startsWith("propis2:page:"));
    expect(pageKeys).toHaveLength(1);
    expect(pageKeys[0]).not.toBe("propis2:page:pg_remote");
    const setKeys = keys.filter((k) => k.startsWith("propis2:set:"));
    expect(setKeys).toContain("propis2:set:st_pg_remote");
    expect(setKeys).toHaveLength(2);
    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);

  it("icon controls carry their name: a title for the mouse, a press-and-hold bubble for touch (which does not click)", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    await act(async () => { byLabel(host, "Новая тетрадь").click(); await tick(); });
    const fmt = host.querySelector('button[aria-label="Формат"]');
    expect(fmt.getAttribute("title")).toBe("Формат");
    expect(host.querySelector(".p2-tip")).toBeNull();
    await act(async () => { fmt.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })); await tick(520); });
    expect(host.querySelector(".p2-tip").textContent).toBe("Формат");
    // the press that showed the bubble does not open the list
    await act(async () => { fmt.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })); fmt.click(); await tick(); });
    expect(host.querySelector('[role="listbox"]')).toBeNull();
    await act(async () => { root.unmount(); await tick(300); });
    host.remove();
  }, 20000);

  it("a locked page: the field edits only the selected row's text, one line; running text can be switched on a row", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el, init = {}) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init })); await tick(60); }); };
    await click(host.querySelector('[aria-label="Изменить тетрадь Листы методики, часть 2 (узкая строка)"]'));
    const preview = () => host.querySelector('[data-testid="propis2-preview"]');
    const svg = preview().querySelector("svg.propis-print-page-svg");
    const vbH = Number(svg.getAttribute("viewBox").split(/\s+/)[3]);
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, right: 400, bottom: vbH, width: 400, height: vbH });
    const yOfRow = (r) => { let y = 0; while (rowAtSvgY(y) !== r && y < vbH) y += 1; return y + 4; };
    expect(fieldOf(host).disabled).toBe(true);
    await click(host.querySelector(".propis2-page-col"), { clientX: 100, clientY: yOfRow(0) });
    expect(fieldOf(host).disabled).toBe(false);
    const first = fieldOf(host).value;
    expect(first.length).toBeGreaterThan(0);
    expect(first).not.toContain("\n");
    await typeInField(host, "Ю\nлишнее");
    expect(fieldOf(host).value).not.toContain("\n");
    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  }, 40000);

  it("a row can be switched between sample and running text", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    const click = async (el) => { await act(async () => { el.click(); await tick(); }); };
    await click(byLabel(host, "Новая тетрадь"));
    await typeInField(host, "мама");
    const asText = () => host.querySelector('[aria-label="Строка как текст (с переносом)"]');
    expect(asText().getAttribute("aria-pressed")).toBe("false");
    await click(asText());
    expect(asText().getAttribute("aria-pressed")).toBe("true");
    // a row that is running text takes no repeat or dots
    expect(host.querySelector('button[aria-label="Повтор"]').disabled).toBe(true);
    await typeInField(host, "мама мыла раму");
    expect(asText().getAttribute("aria-pressed")).toBe("true");
    await act(async () => { root.unmount(); await tick(300); });
    host.remove();
  }, 20000);

  it("a methodology kit (a notebook) is one set in the library; its pages stay out of the page list; deleting it removes them", async () => {
    const db = await freshDb();
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(80); });
    const click = async (el) => { await act(async () => { el.click(); await tick(); }); };
    const openKit = '[data-testid="propis2-ready-card"] [aria-label="Открыть тетрадь Прописи — соединения букв"]';
    for (let i = 0; i < 40 && !host.querySelector(openKit); i += 1) await act(async () => { await tick(100); });
    expect(host.querySelector('[data-testid="propis2-set-card"]')).toBeNull(); // nothing of ours yet
    await click(host.querySelector(openKit));
    // straight into the viewer: no set-editor screen in between
    expect(host.querySelector('[data-testid="propis2-set-editor"]')).toBeNull();
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    // «edit this page» opens the constructor on the page that is shown; back returns to the viewer
    await click(host.querySelector('[aria-label="Изменить эту страницу"]'));
    expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Название страницы"]').value).toBe("Слоги 1");
    // inside a set the editor pages through all its pages, copies and deletes them
    const pos = () => host.querySelector(".p2-pager-pos").textContent;
    expect(pos()).toMatch(/^Стр\. 1 из (\d+)$/);
    const total = Number(pos().match(/из (\d+)/)[1]);
    expect(host.querySelector('[aria-label="Предыдущая страница"]').disabled).toBe(true);
    await click(host.querySelector('[aria-label="Следующая страница"]'));
    expect(pos()).toBe(`Стр. 2 из ${total}`);
    expect(host.querySelector('[aria-label="Название страницы"]').value).toBe("Слоги 2");
    // move this page one place earlier, then back: it stays the open page, the position follows it
    await click(host.querySelector('[aria-label="Переместить страницу раньше"]'));
    expect(pos()).toBe(`Стр. 1 из ${total}`);
    expect(host.querySelector('[aria-label="Название страницы"]').value).toBe("Слоги 2");
    await click(host.querySelector('[aria-label="Переместить страницу позже"]'));
    expect(pos()).toBe(`Стр. 2 из ${total}`);
    // a new blank page right after this one, with the same paper settings
    await click(host.querySelector('[aria-label="Добавить страницу"]'));
    expect(pos()).toBe(`Стр. 3 из ${total + 1}`);
    expect(host.querySelector('[aria-label="Название страницы"]').value).toBe(`Страница ${total + 1}`);
    expect(host.querySelector('[aria-label="Тип бумаги"]').disabled).toBe(false); // an own page, not a locked kit one
    vi.spyOn(window, "confirm").mockReturnValueOnce(true);
    await click(host.querySelector('[aria-label="Удалить страницу из тетради"]'));
    expect(pos()).toBe(`Стр. 3 из ${total}`);
    await click(host.querySelector('[aria-label="Предыдущая страница"]'));
    expect(pos()).toBe("Стр. 2 из "+total);
    await click(host.querySelector('[aria-label="Копия страницы"]'));
    expect(pos()).toBe(`Стр. 3 из ${total + 1}`);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await click(host.querySelector('[aria-label="Удалить страницу из тетради"]'));
    expect(pos()).toBe(`Стр. 3 из ${total}`);
    await click(host.querySelector('[aria-label="Предыдущая страница"]'));
    await click(host.querySelector('[aria-label="Предыдущая страница"]'));
    expect(pos()).toBe(`Стр. 1 из ${total}`);
    await click(host.querySelector(".back-btn"));
    expect(host.querySelector('[data-testid="propis2-view"]')).not.toBeNull();
    await click(host.querySelector(".propis-practice-close"));
    await click(dlgBtn(host, "Сохранить")); // the changes made in the editor are confirmed: the copy is kept
    expect(host.querySelector('[data-testid="propis2-library"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(1);
    // it became ours: its ready card has moved to «Мои тетради» (and is not offered twice)
    expect(host.querySelector(openKit)).toBeNull();
    await click([...host.querySelectorAll('[data-testid="propis2-set-card"] button')].find((b) => b.textContent.includes("Удалить")));
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(0);
    // delete our copy and the ready one is back in the list
    expect(host.querySelector(openKit)).not.toBeNull();
    await act(async () => { root.unmount(); await tick(300); });
    host.remove();
  }, 30000);

  describe("what is kept needs a confirmation", () => {
    const mount = async (db) => {
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => { root.render(<Propis2Home db={db} />); await tick(60); });
      const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent("click", { bubbles: true })); await tick(); }); };
      const unmount = async () => { await act(async () => { root.unmount(); await tick(300); }); host.remove(); };
      const cards = () => host.querySelectorAll('[data-testid="propis2-set-card"]');
      return { host, click, unmount, cards };
    };

    it("opening an editor and leaving it without a change keeps nothing (no «Новая тетрадь» left behind)", async () => {
      const db = await freshDb();
      const { host, click, unmount, cards } = await mount(db);
      await click(byLabel(host, "Новая тетрадь"));
      expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
      expect(byLabel(host, "Сохранить тетрадь").disabled).toBe(true);
      await click(host.querySelector(".back-btn"));
      expect(host.querySelector('[data-testid="propis2-save-dialog"]')).toBeNull();
      expect(host.querySelector('[data-testid="propis2-library"]')).not.toBeNull();
      expect(cards()).toHaveLength(0);
      await unmount();
    });

    it("a change asks on leaving: «Остаться» stays, «Не сохранять» drops it, «Сохранить» names and keeps it", async () => {
      const db = await freshDb();
      const { host, click, unmount, cards } = await mount(db);
      await click(byLabel(host, "Новая тетрадь"));
      await typeInField(host, "а");
      expect(byLabel(host, "Сохранить тетрадь").disabled).toBe(false);
      await click(host.querySelector(".back-btn"));
      expect(host.querySelector('[data-testid="propis2-save-dialog"]')).not.toBeNull();
      await click(dlgBtn(host, "Остаться"));
      expect(host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
      await click(host.querySelector(".back-btn"));
      await click(dlgBtn(host, "Не сохранять"));
      expect(host.querySelector('[data-testid="propis2-library"]')).not.toBeNull();
      expect(cards()).toHaveLength(0);
      // again, and keep it under a name of our own
      await click(byLabel(host, "Новая тетрадь"));
      await typeInField(host, "а");
      await click(host.querySelector(".back-btn"));
      const name = host.querySelector('[data-testid="propis2-save-dialog"] input');
      await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(name, "Моя первая"); name.dispatchEvent(new Event("input", { bubbles: true })); await tick(); });
      await click(dlgBtn(host, "Сохранить"));
      expect(cards()).toHaveLength(1);
      expect(cards()[0].textContent).toContain("Моя первая");
      await unmount();
    });

    it("changes to a notebook that is already in the list are confirmed too: «Не сохранять» leaves it as it was", async () => {
      const db = await freshDb();
      const pg = newPage("Урок", { rows: [newRow({ text: "мама" })] });
      await saveLibrary(upsertSet(upsertPage(emptyLibrary(), pg), newSet("Урок", { id: "st_urok", pageIds: [pg.id] })), db);
      const { host, click, unmount, cards } = await mount(db);
      expect(cards()[0].textContent).toContain("1 стр.");
      await click(byLabel(host, "Изменить тетрадь Урок"));
      await click(byLabel(host, "Добавить страницу"));
      await click(host.querySelector(".back-btn"));
      expect(host.querySelector('[data-testid="propis2-save-dialog"]').textContent).toContain("Сохранить изменения в тетради?");
      await click(dlgBtn(host, "Не сохранять"));
      expect(cards()[0].textContent).toContain("1 стр.");
      await click(byLabel(host, "Изменить тетрадь Урок"));
      await click(byLabel(host, "Добавить страницу"));
      await click(byLabel(host, "Сохранить тетрадь")); // an existing notebook: no question, it is kept
      expect(host.querySelector('[data-testid="propis2-save-dialog"]')).toBeNull();
      await click(host.querySelector(".back-btn"));
      expect(host.querySelector('[data-testid="propis2-save-dialog"]')).toBeNull();
      expect(cards()[0].textContent).toContain("2 стр.");
      await unmount();
    });

    it("a ready notebook only looked at or opened for editing is not copied into the list until a change is confirmed", async () => {
      const db = await freshDb();
      const { host, click, unmount, cards } = await mount(db);
      const ready = '[data-testid="propis2-ready-card"] [aria-label="Открыть тетрадь Листы методики, часть 1 (широкая строка)"]';
      const edit = '[data-testid="propis2-ready-card"] [aria-label="Изменить тетрадь Листы методики, часть 1 (широкая строка)"]';
      await click(host.querySelector(ready));
      expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
      await click(host.querySelector(".propis-practice-close"));
      expect(host.querySelector('[data-testid="propis2-save-dialog"]')).toBeNull();
      expect(cards()).toHaveLength(0);
      expect(host.querySelector(ready)).not.toBeNull();
      await click(host.querySelector(edit));
      await click(host.querySelector(".back-btn"));
      expect(host.querySelector('[data-testid="propis2-save-dialog"]')).toBeNull();
      expect(cards()).toHaveLength(0);
      await unmount();
    });

    it("an unsaved notebook survives a closed app: the library offers to continue it", async () => {
      const db = await freshDb();
      let m = await mount(db);
      await m.click(byLabel(m.host, "Новая тетрадь"));
      await typeInField(m.host, "кот");
      await act(async () => { await tick(900); }); // the draft is mirrored to the device
      await m.unmount(); // the app is closed without saving
      m = await mount(db);
      await act(async () => { await tick(200); });
      expect(m.cards()).toHaveLength(0);
      expect(m.host.querySelector('[data-testid="propis2-draft-banner"]')).not.toBeNull();
      await m.click(byLabel(m.host, "Продолжить несохранённую тетрадь"));
      expect(m.host.querySelector('[data-testid="propis2-editor"]')).not.toBeNull();
      expect(byLabel(m.host, "Сохранить тетрадь").disabled).toBe(false);
      await m.click(byLabel(m.host, "Сохранить тетрадь"));
      await m.click(dlgBtn(m.host, "Сохранить"));
      await m.click(m.host.querySelector(".back-btn"));
      expect(m.cards()).toHaveLength(1);
      expect(m.host.querySelector('[data-testid="propis2-draft-banner"]')).toBeNull();
      await m.unmount();
    });

    it("empty notebooks left by the old autosave can be removed in one tap", async () => {
      const db = await freshDb();
      let lib = emptyLibrary();
      for (const t of ["Новая тетрадь", "Новая страница"]) { const pg = newPage(t); lib = upsertSet(upsertPage(lib, pg), newSet(t, { id: `st_${pg.id}`, pageIds: [pg.id] })); }
      const full = newPage("С буквами", { rows: [newRow({ text: "мама" })] });
      lib = upsertSet(upsertPage(lib, full), newSet("С буквами", { id: `st_${full.id}`, pageIds: [full.id] }));
      await saveLibrary(lib, db);
      const { host, click, unmount, cards } = await mount(db);
      expect(cards()).toHaveLength(3);
      expect(host.querySelector('[data-testid="propis2-blank-banner"]').textContent).toContain("2");
      await click(byLabel(host, "Удалить пустые тетради"));
      expect(cards()).toHaveLength(1);
      expect(cards()[0].textContent).toContain("С буквами");
      expect(host.querySelector('[data-testid="propis2-blank-banner"]')).toBeNull();
      await unmount();
    });
  });
});
