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
await importTopic(db, await readFile("public/decks/column_addition_v1.3.2.zip"));
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
const state = () => cells().map((c) => (c.classList.contains("cop-cell--zero") ? "0" : c.classList.contains("cop-cell--on") ? "•" : "_")).join("");
const tap = async (i) => act(async () => cells()[i].click());
const clear = () => host.querySelector(".cop-clear");
const start = async () => act(async () => [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === "Начать занятие").click());

it("2 + 2: the middle cell is the leading tens — no zero, it says why; a 3-digit top takes a zero in the middle", async () => {
  mountWith({});
  await act(async () => root.render(<ParamsScreen />));
  expect(state()).toBe("_••_••");
  expect(clear()).toBeNull();
  await tap(1);
  expect(state()).toBe("_••_••");
  expect(host.textContent).toContain("Число не начинается с нуля");
  await tap(0); // grow the top to 3 digits
  await tap(1); // now the middle is the tens of a 3-digit number
  expect(state()).toBe("•0•_••");
  await act(async () => clear().click()); // «Убрать нули» — only there while zeros are
  expect(state()).toBe("•••_••");
  expect(clear()).toBeNull();
  await tap(1);
  await start();
  expect(mocks.persist).toHaveBeenCalledWith("kid", "column_addition", expect.objectContaining({
    params: expect.objectContaining({ operands: { top: 3, topZeros: [1], bottom: 2, bottomZeros: [] } }),
  }));
});

it("an old saved «Разрядность» opens as cells", async () => {
  mountWith({ digits: "zero" });
  await act(async () => root.render(<ParamsScreen />));
  expect(state()).toBe("•0•_••");
});
