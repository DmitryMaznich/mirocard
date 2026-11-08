import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { api } from "@/core/api";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { useAppStore } from "@/core/store";
import { loadLibrary, saveLibrary, emptyLibrary, upsertPage, upsertSet } from "@/topics/renderers/propis2/storage.js";
import { newPage, newSet } from "@/topics/renderers/propis2/model.js";
import Propis2Home from "./Propis2Home.jsx";

vi.mock("@/core/syncApi", async (orig) => ({ ...(await orig()), pushOp: vi.fn(() => Promise.resolve()) }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
SVGElement.prototype.getTotalLength ??= () => 100;
SVGElement.prototype.getPointAtLength ??= () => ({ x: 0, y: 0 });
window.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {} });

// «Мои тетради» of the deck with several writing languages (docs/propis2-languages.md): the language belongs to the notebook. One list of
// every notebook; marks and a filter only once more than one language is in use; the language of a new notebook chosen next to
// «Новая тетрадь» and remembered on the device; ready notebooks of the languages in use.
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
const entry = catalog.decks.find((d) => d.id === "propis2");
const installDb = await openDb("p2lang-install-" + Date.now());
await importTopic(installDb, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
const record = await getTopicRecord(installDb, "propis2");

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const btn = (host, text) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes(text));
const click = async (el) => { await act(async () => { el.click(); await tick(); }); };

const sheetPick = async (name) => {
  await click([...document.querySelectorAll('[data-testid="propis2-lang-sheet"] [role="radio"]')].find((b) => b.textContent.includes(name)));
  await click(btn(document.querySelector('[data-testid="propis2-lang-sheet"]'), "Готово"));
};
const cards = (host, id) => [...host.querySelectorAll(`[data-testid="${id}"]`)];

describe("propis2: languages per notebook in «Мои тетради»", () => {
  beforeEach(() => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("offline"));
    localStorage.clear();
    useAppStore.setState({ topicRecords: [record], activeTopicId: "propis2", activeStudentId: "s1", students: [{ id: "s1", name: "1А" }], studentTopicLinks: {}, screen: "params" });
  });

  it("one list, a language per notebook; the ready notebooks of every language always, with marks and a filter", async () => {
    const db = await openDb("p2lang-home-" + Date.now());
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });

    // only Russian in use, yet the ready notebooks of every language are offered (owner, 2026-11-02), each with its mark, and a filter
    expect(host.querySelector('[data-testid="propis2-new-lang"]').textContent).toContain("Русский");
    for (let i = 0; i < 100 && !cards(host, "propis2-ready-card").some((c) => c.textContent.includes("РУС")); i++) await act(async () => { await tick(50); }); // the bundled kits load apart
    const readyMarks = () => new Set(cards(host, "propis2-ready-card").map((c) => ["РУС", "БЪЛ", "ҚАЗ"].find((m) => c.textContent.includes(m))));
    expect([...readyMarks()].sort()).toEqual(["БЪЛ", "РУС", "ҚАЗ"].sort());
    const filter0 = host.querySelector('[data-testid="propis2-lang-filter"]');
    expect([...filter0.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Все", "Русский", "Български", "Қазақша"]);
    await click([...filter0.querySelectorAll("button")].find((b) => b.textContent === "Қазақша"));
    // Kazakh: its own two word notebooks (variant.json kits, 2026-11-02)
    expect(cards(host, "propis2-ready-card").map((c) => c.textContent)).toEqual([expect.stringContaining("Слова 1: А – О"), expect.stringContaining("Слова 2: Ө – Я")]);
    await click([...host.querySelector('[data-testid="propis2-lang-filter"]').querySelectorAll("button")].find((b) => b.textContent === "Все"));

    // a Kazakh notebook: the language chosen next to «Новая тетрадь»
    await click(host.querySelector('[data-testid="propis2-new-lang"]'));
    await sheetPick("Қазақша");
    expect(host.querySelector('[data-testid="propis2-new-lang"]').textContent).toContain("Қазақша");
    await click(btn(host, "Новая тетрадь"));
    const field = host.querySelector('[aria-label="Текст страницы"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(field, "қала");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });
    // the editor says the notebook's language
    expect(host.querySelector('[data-testid="propis2-notebook-lang"]').textContent).toBe("ҚАЗ");
    await click(host.querySelector(".back-btn"));
    await click([...host.querySelectorAll('[data-testid="propis2-save-dialog"] button')].find((b) => b.textContent.includes("Сохранить")));
    await act(async () => { await tick(400); });
    expect((await loadLibrary(db)).sets.map((s) => s.lang)).toEqual(["kk"]);

    // then Bulgarian for the next one: the notebook keeps its mark, the filter narrows notebooks and ready ones
    await click(host.querySelector('[data-testid="propis2-new-lang"]'));
    await sheetPick("Български");
    expect(cards(host, "propis2-set-card")).toHaveLength(1);
    expect(cards(host, "propis2-set-card")[0].textContent).toContain("ҚАЗ");
    const filter = host.querySelector('[data-testid="propis2-lang-filter"]');
    expect([...filter.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Все", "Русский", "Български", "Қазақша"]);
    expect(cards(host, "propis2-ready-card").some((c) => c.textContent.includes("БЪЛ"))).toBe(true);
    await click([...filter.querySelectorAll("button")].find((b) => b.textContent === "Български"));
    expect(cards(host, "propis2-set-card")).toHaveLength(0);
    expect(cards(host, "propis2-ready-card").every((c) => c.textContent.includes("БЪЛ"))).toBe(true);

    // the language of a new notebook is remembered on the device
    await act(async () => { root.unmount(); await tick(400); });
    const again = createRoot(host);
    await act(async () => { again.render(<Propis2Home db={db} />); await tick(); });
    expect(host.querySelector('[data-testid="propis2-new-lang"]').textContent).toContain("Български");
    await act(async () => { again.unmount(); await tick(400); });
    host.remove();
  });

  it("old notebooks on the Bulgarian paper open as Bulgarian, the rest stay Russian, whatever topics the account has", async () => {
    for (const [owned, paper, want] of [[["propis2", "propis2_bg"], "bg", "bg"], [["propis2", "propis2_bg"], undefined, undefined], [["propis2"], undefined, undefined]]) {
      useAppStore.setState({ ownedTopics: owned.map((topicId) => ({ topicId, source: "paid" })) });
      localStorage.clear();
      const db = await openDb("p2lang-legacy-" + Date.now() + Math.random());
      const pg = newPage("Стара тетрадка", paper ? { gridKind: paper } : {});
      await saveLibrary(upsertSet(upsertPage(emptyLibrary(), pg), newSet("Стара тетрадка", { id: `st_${pg.id}`, pageIds: [pg.id] })), db);
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => { root.render(<Propis2Home db={db} />); await tick(400); });
      // a new notebook is in the language most of the library is in: Bulgarian for the Bulgarian customer
      expect(host.querySelector('[data-testid="propis2-new-lang"]').textContent).toContain(want === "bg" ? "Български" : "Русский");
      await act(async () => { root.unmount(); await tick(400); }); // leaving saves what is pending
      expect((await loadLibrary(db)).sets.map((st) => st.lang)).toEqual([want]);
      host.remove();
    }
  });

  it("a new Bulgarian notebook is on the Bulgarian paper; a Russian one on the Russian", async () => {
    for (const [lang, title, paper] of [["bg", "Български", "bg"], ["ru", "Русский", undefined]]) {
      localStorage.clear();
      const db = await openDb("p2lang-paper-" + Date.now() + Math.random());
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
      if (lang !== "ru") { await click(host.querySelector('[data-testid="propis2-new-lang"]')); await sheetPick(title); }
      await click(btn(host, "Новая тетрадь"));
      expect(host.querySelector('[data-testid="propis2-notebook-lang"]').textContent).toBe(lang === "bg" ? "БЪЛ" : "РУС");
      const field = host.querySelector('[aria-label="Текст страницы"]');
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(field, "мама");
        field.dispatchEvent(new Event("input", { bubbles: true }));
        await tick();
      });
      await click(host.querySelector(".back-btn"));
      await click([...host.querySelectorAll('[data-testid="propis2-save-dialog"] button')].find((b) => b.textContent.includes("Сохранить")));
      await act(async () => { root.unmount(); await tick(400); });
      expect((await loadLibrary(db)).pages.map((p) => p.gridKind)).toEqual([paper]);
      host.remove();
    }
  });
  it("a new notebook keeps its language's style (docs/latin-letters.md); a language without styles stores none", async () => {
    // the real deck, its Bulgarian given two styles: a new Bulgarian notebook takes the first and keeps it
    const styled = { ...record, languages: record.languages.map((l) => (l.id === "bg" ? { ...l, styles: [{ id: "school", title: "Школьный" }, { id: "other", title: "Другой" }] } : l)) };
    useAppStore.setState({ topicRecords: [styled] });
    for (const [lang, title, style] of [["bg", "Български", "school"], ["ru", "Русский", undefined]]) {
      localStorage.clear();
      const db = await openDb("p2style-new-" + Date.now() + Math.random());
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
      if (lang !== "ru") { await click(host.querySelector('[data-testid="propis2-new-lang"]')); await sheetPick(title); }
      await click(btn(host, "Новая тетрадь"));
      const field = host.querySelector('[aria-label="Текст страницы"]');
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(field, "мама");
        field.dispatchEvent(new Event("input", { bubbles: true }));
        await tick();
      });
      await click(host.querySelector(".back-btn"));
      await click([...host.querySelectorAll('[data-testid="propis2-save-dialog"] button')].find((b) => b.textContent.includes("Сохранить")));
      await act(async () => { root.unmount(); await tick(400); });
      const [set] = (await loadLibrary(db)).sets;
      expect(set.lang).toBe(lang);
      expect(set.style).toBe(style);
      expect("style" in set).toBe(style !== undefined);
      host.remove();
    }
  });
  it("a notebook of a language this deck lacks (made in the test copy, same library) is kept but not listed", async () => {
    const pg = newPage({ lines: ["cat"] });
    const pgRu = newPage({ lines: ["кот"] });
    let lib = upsertPage(upsertPage(emptyLibrary(), pg), pgRu);
    lib = upsertSet(lib, newSet("English one", { id: "st_en", pageIds: [pg.id], lang: "en", style: "print" }));
    lib = upsertSet(lib, newSet("Русская", { id: "st_ru", pageIds: [pgRu.id], lang: "ru" }));
    const withEn = { ...record, languages: [...record.languages, { id: "en", title: "English", short: "ENG", status: "draft", alphabet: { lower: "abcdefghijklmnopqrstuvwxyz" }, methodology: false }] };
    for (const [rec, titles] of [[record, ["Русская"]], [withEn, ["English one", "Русская"]]]) {
      useAppStore.setState({ topicRecords: [rec] });
      const db = await openDb("p2lang-unknown-" + Date.now() + Math.random());
      await saveLibrary(lib, db);
      const host = document.createElement("div");
      document.body.appendChild(host);
      const root = createRoot(host);
      await act(async () => { root.render(<Propis2Home db={db} />); await tick(60); });
      expect(cards(host, "propis2-set-card").map((c) => ["English one", "Русская"].find((t) => c.textContent.includes(t))).sort()).toEqual(titles);
      await act(async () => { root.unmount(); await tick(400); });
      expect((await loadLibrary(db)).sets.map((st) => st.id).sort()).toEqual(["st_en", "st_ru"]); // nothing deleted
      host.remove();
    }
  });
  it("an English notebook (the test copy's draft language) opens in the editor on its own paper", async () => {
    const tc = JSON.parse(await readFile("tools/propis2/test-copy.json", "utf-8"));
    const tdb = await openDb("p2lang-tc-" + Date.now());
    await importTopic(tdb, await readFile(`public/decks/propis2_lang_v${tc.version}.zip`), "999.0.0");
    const testCopy = await getTopicRecord(tdb, "propis2_lang");
    useAppStore.setState({ topicRecords: [testCopy], activeTopicId: "propis2_lang" });
    const db = await openDb("p2lang-en-" + Date.now());
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });
    await click(host.querySelector('[data-testid="propis2-new-lang"]'));
    await sheetPick("English");
    await click(btn(host, "Новая тетрадь"));
    expect(host.querySelector('[data-testid="propis2-notebook-lang"]').textContent).toBe("ENG");
    const field = host.querySelector('[aria-label="Текст страницы"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(field, "cat dog");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });
    // the paper button shows the English four-line paper (its icon must exist: React #130 on 1.0.2868)
    expect(host.textContent).not.toMatch(/Ошибка отображения/);
    expect([...host.querySelectorAll("button")].some((b) => (b.getAttribute("aria-label") ?? "").includes("Тип бумаги"))).toBe(true);
    // shown to the student, and the print dialog with its cover, back and spine — on the English paper, nothing missing
    await click(btn(host, "Показать ученику"));
    expect(host.querySelector('[data-testid="propis2-view"] svg')).not.toBeNull();
    await click(host.querySelector('.propis-practice-stage [aria-label="Печать"]'));
    const dlg = () => document.querySelector('[data-testid="propis2-print-dialog"]');
    expect(dlg()).not.toBeNull();
    const preview = () => dlg().querySelector('[data-testid="propis2-cover-preview"]');
    expect(preview()).not.toBeNull();
    await click([...dlg().querySelectorAll("button")].find((b) => b.textContent.startsWith("Настроить обложку")));
    await click([...dlg().querySelectorAll('[aria-label="Украшение"] .p2-chip')].find((b) => b.textContent === "Корешок"));
    expect(preview().querySelector('[data-testid="propis2-spine-front"] [data-simple-grid="en_us"]')).not.toBeNull(); // the spine on the notebook's own paper
    expect(document.body.textContent).not.toMatch(/Ошибка отображения/);
    await click([...dlg().querySelectorAll("button")].find((b) => /Отмена|Закрыть/.test(b.textContent) || b.getAttribute("aria-label") === "Закрыть"));
    await click(host.querySelector(".propis-practice-close"));
    await click(host.querySelector(".back-btn"));
    await click([...host.querySelectorAll('[data-testid="propis2-save-dialog"] button')].find((b) => b.textContent.includes("Сохранить")));
    await act(async () => { root.unmount(); await tick(400); });
    const lib = await loadLibrary(db);
    expect(lib.sets.map((st) => [st.lang, st.style])).toEqual([["en", "print"]]);
    expect(lib.pages.map((pg) => pg.gridKind)).toEqual(["en_us"]);
    host.remove();
  });
});
