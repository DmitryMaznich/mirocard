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

// «Мои тетради» of the deck with several writing languages (docs/propis2-languages.md): the chip names the student's language, the
// sheet switches it, every language keeps its own notebooks, a new notebook remembers its language.
const catalog = JSON.parse(await readFile("public/decks/catalog.json", "utf-8"));
const entry = catalog.decks.find((d) => d.id === "propis2_lang");
const installDb = await openDb("p2lang-install-" + Date.now());
await importTopic(installDb, await readFile(`public/decks/${entry.url.replace("./decks/", "")}`), "999.0.0");
const record = await getTopicRecord(installDb, "propis2_lang");

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const btn = (host, text) => [...host.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") ?? b.textContent).includes(text));
const click = async (el) => { await act(async () => { el.click(); await tick(); }); };

describe("propis2: the writing language in «Мои тетради»", () => {
  beforeEach(() => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("offline"));
    useAppStore.setState({ topicRecords: [record], activeTopicId: "propis2_lang", activeStudentId: "s1", students: [{ id: "s1", name: "Миша" }], studentTopicLinks: {}, screen: "params" });
  });

  it("switches the language, keeps each language's notebooks apart and tags a new one", async () => {
    const db = await openDb("p2lang-home-" + Date.now());
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<Propis2Home db={db} />); await tick(); });

    const chip = host.querySelector('[data-testid="propis2-lang-chip"]');
    expect(chip.textContent).toContain("Русский");
    await click(chip);
    const sheet = document.querySelector('[data-testid="propis2-lang-sheet"]');
    expect([...sheet.querySelectorAll(".p2-lang-name")].map((n) => n.textContent)).toEqual(["Русский", "Български", "Қазақша"]);
    expect(sheet.textContent).toContain("черновик");
    await click([...sheet.querySelectorAll('[role="radio"]')].find((b) => b.textContent.includes("Български")));
    await click(btn(sheet, "Готово"));

    expect(useAppStore.getState().studentTopicLinks.s1_propis2_lang.params.writingLang).toBe("bg");
    expect(host.querySelector('[data-testid="propis2-lang-chip"]').textContent).toContain("Български");
    expect(host.querySelector('[data-testid="propis2-lang-empty"]').textContent).toContain("Български");

    // a new Bulgarian notebook, saved: it is in the Bulgarian list only, and remembers its language
    await click(btn(host, "Новая тетрадь"));
    const field = host.querySelector('[aria-label="Текст страницы"]');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(field, "щъркел");
      field.dispatchEvent(new Event("input", { bubbles: true }));
      await tick();
    });
    await click(host.querySelector(".back-btn"));
    await click([...host.querySelectorAll('[data-testid="propis2-save-dialog"] button')].find((b) => b.textContent.includes("Сохранить")));
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(1);
    await act(async () => { await tick(400); });
    expect((await loadLibrary(db)).sets.map((s) => s.lang)).toEqual(["bg"]);

    // back to Russian: the Bulgarian notebook is not in its list
    await click(host.querySelector('[data-testid="propis2-lang-chip"]'));
    await click([...document.querySelectorAll('[data-testid="propis2-lang-sheet"] [role="radio"]')].find((b) => b.textContent.includes("Русский")));
    await click(btn(document.querySelector('[data-testid="propis2-lang-sheet"]'), "Готово"));
    expect(host.querySelectorAll('[data-testid="propis2-set-card"]')).toHaveLength(0);
    expect(host.querySelector('[data-testid="propis2-lang-empty"]')).toBeNull(); // Russian, the deck's first: no empty-language note

    await act(async () => { root.unmount(); await tick(400); });
    host.remove();
  });
});
