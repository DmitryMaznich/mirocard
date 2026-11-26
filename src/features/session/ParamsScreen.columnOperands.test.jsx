import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ParamsScreen from "./ParamsScreen";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";

// The real settings screen of «Столбик — Тренажёр» with the real deck:
// «Числа в примере» cells, «Любое (без нулей)», and an old saved «Разрядность».
const mocks = vi.hoisted(() => ({ persist: vi.fn(), start: vi.fn() }));
vi.mock("@/core/linkUtils", () => ({ persistStudentTopicLink: mocks.persist }));
vi.mock("@/features/timer/TimerContext", () => ({ useTimer: () => ({ markSessionStart: mocks.start }) }));

const db = await openDb("cop-" + Math.random());
await importTopic(db, await readFile("public/decks/column_addition_v1.3.3.zip"));
const topic = await getTopicRecord(db, "column_addition");
const initial = useAppStore.getState();
let root, host;

function mountWith(params) {
  useAppStore.setState({ activeStudentId: "kid", activeTopicId: "column_addition", activeModeId: "column_arithmetic",
    students: [{ id: "kid", name: "Миша" }], topicRecords: [structuredClone(topic)], sessions: [],
    studentTopicLinks: { kid_column_addition: { params, videoRewardEnabled: false } }, screen: "params", sessionReturnScreen: null });
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks(); setUiLanguage("ru");
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(initial, true); });

const cells = () => [...host.querySelectorAll(".cop-cell")];
const state = () => cells().map((c) => (c.textContent || (c.classList.contains("cop-cell--on") ? "•" : "_"))).join("");
// a tap opens the picker under the cells, the second tap picks (2026-11-26)
const pick = async (i, option) => {
  await act(async () => cells()[i].click());
  await act(async () => [...host.querySelectorAll(".cdp-option")].find((b) => b.textContent === option).click());
};
const start = async () => act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === "Начать занятие").click());

it("2 + 2: a cell picks «нет», «любая», 0 or a digit; the number grows and shrinks with it", async () => {
  mountWith({});
  await act(async () => root.render(<ParamsScreen />));
  expect(state()).toBe("_••_••");
  await pick(1, "нет"); // the top's tens — the number is one digit now
  expect(state()).toBe("__•_••");
  await pick(0, "любая"); // a value over an empty cell grows the top to 3 digits
  expect(state()).toBe("•••_••");
  await pick(1, "0");
  expect(state()).toBe("•0•_••");
  await pick(1, "7"); // a fixed digit
  expect(state()).toBe("•7•_••");
  await pick(3, "любая"); // a 3-digit bottom
  await start();
  expect(mocks.persist).toHaveBeenCalledWith("kid", "column_addition", expect.objectContaining({
    params: expect.objectContaining({ operands: { top: 3, topZeros: [], topFixed: { 1: 7 }, bottom: 3, bottomZeros: [] } }),
  }));
});

it("an old saved «Разрядность» opens as cells", async () => {
  mountWith({ digits: "zero" });
  await act(async () => root.render(<ParamsScreen />));
  expect(state()).toBe("•0•_••");
});

it("the sign is a cell; «Перенос / заём» is one row, the button the sign has no use for is off", async () => {
  mountWith({ carryMode: "carry" }); // an old «Перенос / заём: С» — both actions «есть»
  await act(async () => root.render(<ParamsScreen />));
  const button = (text) => [...host.querySelectorAll(".enum-btn")].find((b) => b.textContent === text);
  const labels = () => [...host.querySelectorAll(".param-label")].map((l) => l.textContent.trim());
  expect(labels()).toContain("Перенос / заём");
  expect(labels()).not.toContain("«Хватает?»");
  expect(button("Перенос").getAttribute("aria-pressed")).toBe("true");
  expect(button("Заём").disabled).toBe(true); // «+»: no borrow
  await act(async () => host.querySelector(".cop-sign-cell").click());
  await act(async () => [...host.querySelectorAll(".cdp-option")].find((b) => b.textContent === "любой").click());
  expect(host.querySelector(".cop-sign-cell").textContent).toBe("±");
  expect(button("Заём").disabled).toBe(false);
  expect(labels()).toContain("«Хватает?»");
  await act(async () => button("Заём").click()); // «есть» → «нет» for the borrow
  await start();
  expect(mocks.persist).toHaveBeenCalledWith("kid", "column_addition", expect.objectContaining({
    params: expect.objectContaining({ operation: "mixed", carry: "with", borrow: "none" }),
  }));
  const saved = mocks.persist.mock.calls.at(-1)[2].params;
  expect(saved).not.toHaveProperty("regroup");
});
