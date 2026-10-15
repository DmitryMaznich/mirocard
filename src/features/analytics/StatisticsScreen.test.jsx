import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { api } from "@/core/api";
import { aggregateStatistics } from "../../../shared/session-statistics.mjs";
import StatisticsScreen from "./StatisticsScreen";

vi.mock("@/core/syncApi", () => ({ flushQueue: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/core/api", () => ({ api: { get: vi.fn() } }));
vi.mock("./restoreHistoricalSessions", () => ({ restoreHistoricalSessions: vi.fn().mockResolvedValue(undefined) }));
let root, host;
const record = (id, studentId = "kid") => ({ id, studentId, topicId: "animals", topicVersion: "1", modeId: "find_n", completedAt: new Date().toISOString(), activeDurationMs: 60000, completionReason: "manual", statistics: { schemaVersion: 1, firstTotal: 10, firstCorrect: 8, corrected: 2, conditions: { params: { optionCount: 4 }, optionCounts: [4], conceptIds: ["cat"] }, concepts: { cat: { total: 10, correct: 8 } } } });
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  useAppStore.setState({ token: null, account: null, activeStudentId: "kid", students: [{ id: "kid", name: "Маша" }, { id: "other", name: "Петя" }], sessions: [record("a"), record("b", "other")], topicRecords: [{ meta: { id: "animals", title: { ru: "Животные" } }, modes: [{ id: "find_n", ui: { title: "Найди картинку" } }], cards: [{ conceptId: "cat", label: "Кошка" }] }] });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); });
const click = async element => act(async () => element.click());

describe("statistics navigation and data sources", () => {
  it("shows the start time and active duration instead of completion reasons", async () => {
    const startedAt = new Date(Date.now() - 65000).toISOString();
    useAppStore.setState({ sessions: [{ ...record("timed"), startedAt, activeDurationMs: 65000, elapsedDurationMs: 3600000 }] });
    await act(async () => root.render(<StatisticsScreen initialTopicId="animals" onClose={() => {}} />));
    const history = host.querySelector(".statistics-history");
    expect(history.querySelector("time").getAttribute("datetime")).toBe(startedAt);
    expect(history.querySelector("time").textContent).toMatch(/\d{2}:\d{2}/);
    expect(history.textContent).toContain("1 мин 5 с");
    expect(history.textContent).not.toContain("Причина завершения");
    expect(history.textContent).not.toContain("Завершено вручную");
    expect(history.textContent).not.toContain("1 ч");
  });
  it("labels elapsed duration as including pauses when active duration is unknown", async () => {
    useAppStore.setState({ sessions: [{ ...record("elapsed"), activeDurationMs: null, elapsedDurationMs: 123000 }] });
    await act(async () => root.render(<StatisticsScreen initialTopicId="animals" onClose={() => {}} />));
    expect(host.querySelector(".statistics-history").textContent).toContain("2 мин 3 с (с паузами)");
  });
  it("does not invent midnight or duration for old date-only records", async () => {
    useAppStore.setState({ sessions: [{ ...record("legacy-date"), completedAt: new Date().toISOString().slice(0, 10), activeDurationMs: null }] });
    await act(async () => root.render(<StatisticsScreen initialTopicId="animals" onClose={() => {}} />));
    const history = host.querySelector(".statistics-history");
    expect(history.querySelector("time").textContent).not.toMatch(/\d{2}:\d{2}/);
    expect(history.textContent).not.toContain("0 с");
    expect(history.textContent).not.toContain("не сохранена");
  });
  it("shows an explicitly measured zero without substituting elapsed time", async () => {
    useAppStore.setState({ sessions: [{ ...record("zero"), activeDurationMs: 0, elapsedDurationMs: 123000 }] });
    await act(async () => root.render(<StatisticsScreen initialTopicId="animals" onClose={() => {}} />));
    expect(host.querySelector(".statistics-history").textContent).toContain("0 с");
    expect(host.querySelector(".statistics-history").textContent).not.toContain("2 мин");
  });
  it("opens a topic from the student summary and shows sample size, comparable history and readable concepts", async () => {
    const onClose = vi.fn();
    await act(async () => root.render(<StatisticsScreen onClose={onClose} />));
    expect(host.textContent).toContain("Более ранняя история может быть неполной");
    expect(host.querySelectorAll(".statistics-topics button")).toHaveLength(1);
    await click(host.querySelector(".statistics-topics button"));
    expect(host.textContent).toContain("80% · 8 из 10");
    expect(host.textContent).toContain("Кошка: 2 из 10");
    expect(host.textContent).toContain("Фактически вариантов: 4");
    await click(host.querySelector('[aria-label="Назад"]'));
    expect(host.querySelector("h1").textContent).toBe("Статистика ученика");
    expect(onClose).not.toHaveBeenCalled();
  });
  it("switches students without mixing their locally saved sessions", async () => {
    useAppStore.setState({ sessions: [record("a")] });
    await act(async () => root.render(<StatisticsScreen initialTopicId="animals" onClose={() => {}} />));
    await act(async () => { const select = host.querySelector("select"); select.value = "other"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.textContent).toContain("За выбранный период занятий нет");
    expect(host.textContent).not.toContain("80%");
  });
  it("uses the full server report and ignores a late response for a previously selected student", async () => {
    useAppStore.setState({ token: "token", account: { id: "account" } });
    let resolveFirst;
    api.get.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    api.get.mockResolvedValueOnce(aggregateStatistics([], { studentId: "other" }));
    await act(async () => root.render(<StatisticsScreen onClose={() => {}} />));
    await act(async () => { const select = host.querySelector("select"); select.value = "other"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    await act(async () => resolveFirst(aggregateStatistics(Array.from({ length: 205 }, (_, i) => record(String(i))), { studentId: "kid" })));
    expect(host.textContent).toContain("Сводка по всем синхронизированным занятиям");
    expect(host.textContent).toContain("За выбранный период занятий нет");
    expect(host.textContent).not.toContain("205");
  });
  it("falls back visibly to device history after a network error", async () => {
    useAppStore.setState({ token: "token", account: { id: "account" } });
    api.get.mockRejectedValue(new Error("offline"));
    await act(async () => root.render(<StatisticsScreen initialTopicId="animals" onClose={() => {}} />));
    expect(host.textContent).toContain("Сервер недоступен");
    expect(host.textContent).toContain("80% · 8 из 10");
  });
  it("labels restored evidence and unknown conditions without presenting it as native measurements", async () => {
    const old = { id: "old", studentId: "kid", topicId: "animals", topicVersion: "1", modeId: "find_n", completedAt: new Date().toISOString(), correctCount: 1, incorrectCount: 1, paramsSnapshot: { optionCount: 2 }, cardEvents: [{ conceptId: "cat", attemptCount: 2, taps: [{ isCorrect: false }, { isCorrect: true }] }] };
    useAppStore.setState({ sessions: [old] });
    await act(async () => root.render(<StatisticsScreen initialTopicId="animals" onClose={() => {}} />));
    expect(host.textContent).toContain("Из старой истории восстановлено: 1 занятие");
    expect(host.textContent).toContain("Восстановлены сохраненные настройки");
    expect(host.textContent).toContain("0% · 0 из 1");
    expect(host.textContent).toContain("Результаты по сохранившимся событиям");
    expect(host.textContent).not.toContain("Последние сопоставимые занятия");
    expect(host.textContent).not.toContain("Завершено с отмеченной помощью: 0");
  });
});
