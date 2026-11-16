import { act } from "react";
import { createRoot } from "react-dom/client";
import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ParamsScreen from "./ParamsScreen";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import { isPickableMode } from "@/shared/utils/topicUtils";

// «Контрольная работа» of «Столбик» moved to «Контрольные по математике» (2026-11-16): the mode list
// shows a link instead of the old check; opening it lands on the link screen, not a session.
vi.mock("@/core/linkUtils", () => ({ persistStudentTopicLink: vi.fn() }));
vi.mock("@/features/timer/TimerContext", () => ({ useTimer: () => ({ markSessionStart: vi.fn() }) }));

const db = await openDb("link-" + Math.random());
await importTopic(db, await readFile("public/decks/column_addition_v1.3.3.zip"));
const column = await getTopicRecord(db, "column_addition");
const initial = useAppStore.getState();
let root, host;

function mountWith(topicRecords) {
  useAppStore.setState({ activeStudentId: "kid", activeTopicId: "column_addition", activeModeId: "column_tests_link",
    students: [{ id: "kid", name: "Миша" }], topicRecords, sessions: [],
    studentTopicLinks: { kid_column_addition: { params: {} } }, screen: "params" });
}
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; setUiLanguage("ru"); host = document.createElement("div"); document.body.append(host); root = createRoot(host); });
afterEach(async () => { await act(async () => root.unmount()); host.remove(); useAppStore.setState(initial, true); });

it("the mode list: the link instead of the old check (kept as retired)", () => {
  const listed = column.modes.filter(isPickableMode).map((m) => m.id);
  expect(listed).toContain("column_tests_link");
  expect(listed).not.toContain("column_copy");
  expect(column.modes.find((m) => m.id === "column_copy")?.retired).toBe(true);
});

it("not installed: the catalog opens on the topic", async () => {
  mountWith([structuredClone(column)]);
  await act(async () => root.render(<ParamsScreen />));
  expect(host.textContent).toContain("Контрольные по столбику — в отдельной теме");
  expect(host.textContent).not.toMatch(/теперь|переехал/i);
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent === "Установить тему");
  await act(async () => button.click());
  expect(useAppStore.getState().screen).toBe("topics");
  expect(useAppStore.getState().topicLibraryQuery).toBe("Контрольные по математике");
});

it("installed: the topic opens", async () => {
  mountWith([structuredClone(column), { meta: { id: "math_tests", title: { ru: "Контрольные по математике" } }, modes: [] }]);
  await act(async () => root.render(<ParamsScreen />));
  const button = [...host.querySelectorAll("button")].find((b) => b.textContent.startsWith("Открыть"));
  await act(async () => button.click());
  expect(useAppStore.getState().activeTopicId).toBe("math_tests");
  expect(useAppStore.getState().screen).toBe("modes"); // the topic's own mode list
});
