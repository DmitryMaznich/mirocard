import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { api } from "@/core/api";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { useAppStore } from "@/core/store";
import { loadLibrary } from "@/topics/renderers/propis2/storage.js";
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
const entry = catalog.decks.find((d) => d.id === "propis2_lang");
const installDb = await openDb("p2lang-install-" + Date.now());
await importTopic(installDb, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
const record = await getTopicRecord(installDb, "propis2_lang");

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
    useAppStore.setState({ topicRecords: [record], activeTopicId: "propis2_lang", activeStudentId: "s1", students: [{ id: "s1", name: "1А" }], studentTopicLinks: {}, screen: "params" });
  });

  it("one list, a language per notebook, marks and a filter once two are in use", async () => {
    const db = await openDb("p2lang-home-" + Date.now());
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });

    // only Russian in use: no marks, no filter, the Russian ready notebooks only (no Bulgarian «Цифры»)
    expect(host.querySelector('[data-testid="propis2-new-lang"]').textContent).toContain("Русский");
    expect(host.querySelector('[data-testid="propis2-lang-filter"]')).toBeNull();
    expect(host.querySelector(".p2-lang-tag")).toBeNull();
    for (let i = 0; i < 100 && !cards(host, "propis2-ready-card").length; i++) await act(async () => { await tick(50); }); // the bundled kits load apart
    const ruReady = cards(host, "propis2-ready-card").length;
    expect(ruReady).toBeGreaterThan(1);

    // a Kazakh notebook: the language chosen next to «Новая тетрадь»
    await click(host.querySelector('[data-testid="propis2-new-lang"]'));
    expect(document.querySelector('[data-testid="propis2-lang-sheet"]').textContent).toContain("черновик");
    await sheetPick("Қазақша");
    expect(host.querySelector('[data-testid="propis2-new-lang"]').textContent).toContain("Қазақша");
    expect(cards(host, "propis2-ready-card")).toHaveLength(0); // Kazakh has no ready notebooks
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

    // then Bulgarian for the next one: two languages in use -> marks and the filter; the Bulgarian ready notebooks join the list
    await click(host.querySelector('[data-testid="propis2-new-lang"]'));
    await sheetPick("Български");
    expect(cards(host, "propis2-set-card")).toHaveLength(1);
    expect(cards(host, "propis2-set-card")[0].textContent).toContain("ҚАЗ");
    const filter = host.querySelector('[data-testid="propis2-lang-filter"]');
    expect([...filter.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Все", "Български", "Қазақша"]);
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
});
