import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { aggregateStatistics } from "../../../shared/session-statistics.mjs";
import HomeScreen from "./HomeScreen";

vi.mock("@/core/api", () => ({ api: { get: vi.fn() } }));
vi.mock("@/core/syncApi", () => ({ flushQueue: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/features/analytics/restoreHistoricalSessions", () => ({ restoreHistoricalSessions: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/shared/hooks/useAppUpdate", () => ({ useAppUpdate: () => ({ hasUpdate: false, applyUpdate: () => {} }) }));
vi.mock("@/features/topics/catalogService", () => ({ silentUpdateOutdatedTopics: vi.fn().mockResolvedValue({ updated: [] }), refreshInstalledCatalogTopics: vi.fn() }));
vi.mock("@/shared/components/TopicCover", () => ({ default: () => <span>±</span> }));

const topic = id => ({ meta: { id, renderer: "addition_subtraction", title: { ru: id === "arithmetic" ? "Плюсы-минусы" : "Другая тема" }, version: "1" }, modes: [{ id: "operation_audio", type: "operation_audio", ui: { title: "Слушай и посчитай" } }], cards: [{ id: "plus", conceptId: "plus", label: "Плюс", primary: true }] });
const result = (extra = {}) => ({ id: "session", studentId: "kid", topicId: "arithmetic", topicVersion: "1", modeId: "operation_audio", completedAt: new Date().toISOString(), correctCount: 1, incorrectCount: 0, recordState: "checkpoint", completionReason: "checkpoint", ...extra });
let root, host;
const statsTab = () => [...host.querySelectorAll('[role="tab"]')].find(button => button.textContent === "Статистика");
const sessionTab = () => [...host.querySelectorAll('[role="tab"]')].find(button => button.textContent === "Занятие");
const mount = () => act(async () => root.render(<HomeScreen />));
const click = button => act(async () => button.click());

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  vi.clearAllMocks();
  api.get.mockResolvedValue({ totals: { sessions: 0 } });
  useAppStore.setState({ token: null, account: null, screen: "home", homeActiveTab: "session", buildInfo: { version: "test" }, activeStudentId: "kid", students: [{ id: "kid", name: "Миша" }, { id: "other", name: "Петя" }], activeTopicId: "arithmetic", activeModeId: "operation_audio", activeTextId: null, topicRecords: [topic("arithmetic"), topic("another")], sessions: [], studentTopicLinks: {} });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });

it("keeps the first-entry statistics tab visible and disabled", async () => {
  await mount();
  expect(statsTab().disabled).toBe(true);
  await click(statsTab());
  expect(host.querySelector(".statistics-screen")).toBeNull();
  expect(host.querySelectorAll('[role="tab"]')).toHaveLength(2);
});

it("does not use another student's results or another topic's results", async () => {
  useAppStore.setState({ sessions: [result({ studentId: "other" }), result({ id: "other-topic", topicId: "another" })] });
  await mount();
  expect(statsTab().disabled).toBe(true);
  expect(statsTab().title).toContain("пока нет сохраненных результатов");
});

it("opens the selected topic's checkpoint and returns with the topic and mode unchanged", async () => {
  useAppStore.setState({ sessions: [result()] });
  await mount();
  expect(statsTab().disabled).toBe(false);
  await click(statsTab());
  expect(host.querySelector("h1").textContent).toBe("Плюсы-минусы");
  expect(host.querySelector(".statistics-screen--embedded")).not.toBeNull();
  expect(host.querySelector('.statistics-filters select').value).toBe("kid");
  expect(statsTab().getAttribute("aria-selected")).toBe("true");
  expect(host.querySelector(".home-tabbar")).not.toBeNull();
  await click(sessionTab());
  expect(host.querySelector(".statistics-screen")).toBeNull();
  expect(useAppStore.getState()).toMatchObject({ activeTopicId: "arithmetic", activeModeId: "operation_audio", activeStudentId: "kid" });
  await click(statsTab());
  await click(host.querySelector('[aria-label="Назад"]'));
  expect(sessionTab().getAttribute("aria-selected")).toBe("true");
});

it("activates after the first saved result and disables for another selected topic", async () => {
  await mount();
  await act(async () => useAppStore.getState().appendSession(result()));
  expect(statsTab().disabled).toBe(false);
  await act(async () => useAppStore.setState({ activeTopicId: "another" }));
  expect(statsTab().disabled).toBe(true);
});

it("keeps the toolbar disabled when the topic or student is absent", async () => {
  useAppStore.setState({ topicRecords: [], activeTopicId: null, sessions: [result()] });
  await mount();
  expect(statsTab().disabled).toBe(true);
  await act(async () => useAppStore.setState({ students: [], activeStudentId: null }));
  expect(statsTab().disabled).toBe(true);
});

it("checks all server history when no matching local sessions remain", async () => {
  localStorage.setItem("mirocard_home_picker_confirmed_kid", JSON.stringify({ topic: true, mode: true }));
  useAppStore.setState({ token: "token", account: { id: "account" } });
  const old = result({ completedAt: "2025-09-10T12:00:00Z" });
  api.get.mockResolvedValue(aggregateStatistics([old], { studentId: "kid", topicId: "arithmetic" }));
  await mount();
  expect(api.get).toHaveBeenCalledWith("/statistics?studentId=kid&topicId=arithmetic");
  expect(statsTab().disabled).toBe(false);
});

it("ignores a late server result for a previously selected student", async () => {
  for (const id of ["kid", "other"]) localStorage.setItem(`mirocard_home_picker_confirmed_${id}`, JSON.stringify({ topic: true, mode: true }));
  useAppStore.setState({ token: "token", account: { id: "account" } });
  let finishOld;
  api.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }));
  api.get.mockResolvedValueOnce({ totals: { sessions: 0 } });
  await mount();
  expect(statsTab().disabled).toBe(true);
  await act(async () => useAppStore.setState({ activeStudentId: "other" }));
  await act(async () => finishOld({ totals: { sessions: 99 } }));
  expect(statsTab().disabled).toBe(true);
});

it("keeps optional tools behind their existing feature flags", async () => {
  useAppStore.setState({ account: { id: "account", featureFlags: ["planner", "instructions", "lesson_plan"] } });
  await mount();
  expect([...host.querySelectorAll('[role="tab"]')].map(button => button.textContent)).toEqual(["Занятие", "Статистика", "План занятий", "Меню и магазин", "Инструкции"]);
});
