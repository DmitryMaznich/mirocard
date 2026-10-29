import { describe, it, expect, afterEach } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { generateTasks, generateTestSheet } from "./engine.js";
import ComparisonRenderer from "./index.jsx";

const MODE_TEST = { id: "compare_test", type: "compare_evaluate", defaultCardId: "compare_hard" };
const cards = [{ id: "compare_hard", conceptId: "compare_hard" }];
const relation = (l, r) => (l === r ? "equal" : l < r ? "less" : "more");
const swapped = ({ left, right }) => left !== right && String(left).split("").reverse().join("") === String(right);

describe("Сравнение — «Контрольная работа»: лист", () => {
  it("is one sheet, whatever level another mode left behind", () => {
    const tasks = generateTasks(MODE_TEST, cards, 500, { level: 5, testRange: 20, examplesCount: 8 });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].isTest).toBe(true);
    expect(tasks[0].items).toHaveLength(8);
    expect(tasks[0].items.every((i) => i.left <= 20 && i.right <= 20)).toBe(true);
  });

  it("mixes every step up to the ceiling and always has «равно»", () => {
    for (let run = 0; run < 30; run++) {
      const rows = generateTestSheet(100, 8);
      expect(rows).toHaveLength(8);
      rows.forEach((r) => expect(r.question).toBe(relation(r.left, r.right)));
      expect(rows.filter((r) => r.left === r.right)).toHaveLength(2);
      expect(rows.some((r) => Math.max(r.left, r.right) <= 10)).toBe(true);
      expect(rows.some((r) => Math.max(r.left, r.right) > 10 && Math.max(r.left, r.right) <= 20)).toBe(true);
      expect(rows.filter((r) => Math.max(r.left, r.right) >= 10 && r.left !== r.right && Math.min(r.left, r.right) >= 10).length).toBeGreaterThanOrEqual(2);
      expect(new Set(rows.map((r) => `${r.left},${r.right}`)).size).toBe(8);
    }
  });

  it("«до 100» brings the swapped-digit trap, «до 1000» the three-digit numbers", () => {
    const sheets100 = Array.from({ length: 40 }, () => generateTestSheet(100, 10));
    expect(sheets100.some((rows) => rows.some(swapped))).toBe(true);
    expect(sheets100.flat().every((r) => r.left <= 99 && r.right <= 99)).toBe(true);
    const rows1000 = generateTestSheet(1000, 10);
    expect(rows1000.some((r) => r.left >= 100 && r.right >= 100)).toBe(true);
  });

  it("«до 10» stays within 10, a short sheet has one «равно»", () => {
    const rows = generateTestSheet(10, 4);
    expect(rows.every((r) => r.left <= 10 && r.right <= 10)).toBe(true);
    expect(rows.filter((r) => r.left === r.right)).toHaveLength(1);
  });
});

describe("Сравнение — «Контрольная работа»: экран", () => {
  // The sheet measures itself; jsdom has no ResizeObserver.
  globalThis.ResizeObserver ??= class { observe() {} disconnect() {} };
  let container, root;
  afterEach(() => { act(() => root?.unmount()); container?.remove(); });

  it("no praise row by row; the end shows which rows needed a second try", async () => {
    const items = [{ left: 3, right: 7, question: "less" }, { left: 9, right: 4, question: "more" }, { left: 5, right: 5, question: "equal" }];
    const calls = { right: 0, mistake: 0, sounds: [] };
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ComparisonRenderer task={{ type: "compare_evaluate", items, conceptId: "compare_hard", style: "sign", isTest: true }} mode={MODE_TEST}
      sessionStatus="task_active" onCorrect={() => calls.right++} onMistake={() => calls.mistake++} playFeedback={(s) => calls.sounds.push(s)} />));
    const press = (sign) => act(() => [...container.querySelectorAll(".croc-put-sign-btn")].find((b) => b.textContent === sign).click());
    press("<");
    press("<"); press(">"); // row 2: wrong first
    press("=");
    await act(() => new Promise((r) => setTimeout(r, 10)));
    expect(calls.sounds).toEqual([]);
    expect(calls.mistake).toBe(1);
    expect(calls.right).toBe(1);
    expect(container.textContent).toContain("С первого раза: 2 из 3");
    expect(container.querySelectorAll(".cfn-multi-sign--fixed")).toHaveLength(1);
    expect(container.querySelectorAll(".cfn-multi-sign--done")).toHaveLength(2);
  });
});

describe("Сравнение — «Контрольная работа»: опубликованная тема", () => {
  it("the published ZIP installs the test as a finite lesson", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve, basename } = await import("node:path");
    const { openDb } = await import("@/core/db");
    const { importTopic } = await import("@/topics/topicLoader");
    const catalog = JSON.parse(await readFile(resolve("public/decks/catalog.json"), "utf8"));
    const deck = catalog.decks.find((d) => d.id === "comparison");
    const db = await openDb(`comparison-test-${Math.random()}`);
    const record = await importTopic(db, await readFile(resolve("public/decks", basename(deck.url))), "99.0.0");
    const test = record.modes.find((m) => m.id === "compare_test");
    expect(test.finite).toBe(true);
    const ids = record.modes.map((m) => m.id);
    expect(ids.indexOf("compare_evaluate")).toBeLessThan(ids.indexOf("compare_draw_sign"));
  });
});
