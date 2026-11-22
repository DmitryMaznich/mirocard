import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ModePickerScreen from "@/features/home/ModePickerScreen";
import ParamsScreen from "./ParamsScreen";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import { NUMBER_PATH_MODE } from "@/topics/renderers/math_houses/numberPathConfig.js";
import { generateTasks } from "@/topics/renderers/math_houses/engine.js";

const mocks = vi.hoisted(() => ({ persist: vi.fn(), start: vi.fn() }));
vi.mock("@/core/linkUtils", () => ({ persistStudentTopicLink: mocks.persist }));
vi.mock("@/features/timer/TimerContext", () => ({ useTimer: () => ({ markSessionStart: mocks.start }) }));
let root, host;
const initial = useAppStore.getState();
const definition = {
  meta: { id: "demo", title: { ru: "Тема пользователя" }, renderer: "flashcards" }, cards: [],
  modes: [{ id: "find", type: "find_n", ui: { title: { ru: "Найди картинку" } }, hideConceptPicker: true, hideVideoReward: true,
    params: { optionCount: { type: "enum", label: { ru: "Вариантов ответа" }, values: [2, 4], labels: { ru: { 2: "Две", 4: "Четыре" } }, default: 2 }, texts: { type: "text_list", label: { ru: "Материал занятия" } } } }],
};
const switchLanguage = language => act(async () => setUiLanguage(language));
const button = text => [...host.querySelectorAll("button")].find(b => b.textContent.trim() === text);
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.clearAllMocks(); setUiLanguage("sl");
  useAppStore.setState({ activeStudentId: "kid", activeTopicId: "demo", activeModeId: "find", activeTextId: null,
    students: [{ id: "kid", name: "Миша" }], topicRecords: [structuredClone(definition)], sessions: [],
    studentTopicLinks: { kid_demo: { params: { optionCount: 2, texts: ["Мой русский текст"] } } }, screen: "params", sessionReturnScreen: null });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); setUiLanguage("ru"); useAppStore.setState(initial, true); });

it("translates metadata and keeps chosen machine values when starting after a language switch", async () => {
  await act(async () => root.render(<ParamsScreen />));
  expect(host.querySelector('h1').textContent).toBe("Poišči sliko");
  expect(host.textContent).toContain("Možnosti odgovora");
  await act(async () => button("Štiri").click());
  await switchLanguage("ru");
  expect(button("Четыре").className).toContain("enum-btn--active");
  await switchLanguage("sl");
  expect(button("Štiri").className).toContain("enum-btn--active");
  expect(mocks.persist).not.toHaveBeenCalled();
  await act(async () => button("Začni učno uro").click());
  expect(mocks.persist).toHaveBeenCalledWith("kid", "demo", expect.objectContaining({ params: expect.objectContaining({ optionCount: 4, texts: ["Мой русский текст"] }), videoRewardEnabled: false }));
  expect(mocks.start).toHaveBeenCalledTimes(1);
  expect(useAppStore.getState().screen).toBe("session");
  expect(useAppStore.getState().topicRecords[0]).toEqual(definition);
});

it("keeps custom lesson content unchanged in the translated text picker", async () => {
  await act(async () => root.render(<ParamsScreen />));
  await act(async () => host.querySelector('.text-list-select-btn, .figure-difficulty-option').click());
  expect(host.querySelector('[role="dialog"]').textContent).toContain("Izberite besedila");
  expect(host.querySelector('[aria-label="Izbriši besedilo"]')).toBeTruthy();
  expect(host.textContent).toContain("Мой русский текст");
  await switchLanguage("ru");
  expect(host.querySelector('[aria-label="Удалить текст"]')).toBeTruthy();
  expect(host.textContent).toContain("Мой русский текст");
  expect(mocks.persist).not.toHaveBeenCalled();
});

it("keeps assessment-mode styling independent of its translated display name", async () => {
  const topic=structuredClone(definition);
  topic.modes=[{ id: "check", type: "check", ui: { title: "7. Контрольная работа" } }, topic.modes[0]];
  useAppStore.setState({ topicRecords: [topic] });
  await act(async () => root.render(<ModePickerScreen />));
  expect(host.querySelector('.mode-item--test .mode-item__title').textContent).toBe("7. Preizkus znanja");
  await switchLanguage("ru");
  expect(host.querySelector('.mode-item--test .mode-item__title').textContent).toBe("7. Контрольная работа");
});

it("keeps the number-path bounds ordered and saves only an available grid size", async () => {
  const topicId = "math_houses";
  useAppStore.setState({
    activeTopicId: topicId,
    activeModeId: NUMBER_PATH_MODE.id,
    topicRecords: [{ meta: { id: topicId, renderer: topicId }, cards: [], modes: [NUMBER_PATH_MODE] }],
    studentTopicLinks: { kid_math_houses: { params: {}, videoRewardEnabled: false } },
  });
  await switchLanguage("ru");
  await act(async () => root.render(<ParamsScreen />));
  const rangeRow = (label) => [...host.querySelectorAll(".param-row")].find((row) => row.textContent.includes(label));
  const [lowerMax] = rangeRow("Максимальное число").querySelectorAll(".stepper-btn");
  const [, raiseMin] = rangeRow("Минимальное число").querySelectorAll(".stepper-btn");
  for (let i = 0; i < 5; i++) await act(async () => lowerMax.click());
  expect(button("Средняя · 10 × 10")).toBeUndefined();
  await act(async () => raiseMin.click());
  await act(async () => raiseMin.click());
  expect(raiseMin.disabled).toBe(true);
  expect(lowerMax.disabled).toBe(true);
  await act(async () => button("Начать занятие").click());
  expect(mocks.persist).toHaveBeenCalledWith("kid", topicId, expect.objectContaining({
    params: expect.objectContaining({
      byMode: expect.objectContaining({
        number_path: expect.objectContaining({ minNumber: 5, maxNumber: 5, boardSize: 5 }),
      }),
    }),
  }));
});

it.each([
  ["Средняя · 10 × 10", 10, 100],
  ["Продвинутая · 10 × 14 / 14 × 10", 14, 140],
])("starts from 6 with the selected field %s", async (label, boardSize, cellCount) => {
  const topicId = "math_houses";
  const card = { id: "house_6", conceptId: "house_6", params: { number: 6 } };
  useAppStore.setState({
    activeTopicId: topicId,
    activeModeId: NUMBER_PATH_MODE.id,
    topicRecords: [{ meta: { id: topicId, renderer: topicId }, cards: [card], modes: [NUMBER_PATH_MODE] }],
    studentTopicLinks: { kid_math_houses: { params: {}, videoRewardEnabled: false } },
  });
  await switchLanguage("ru");
  await act(async () => root.render(<ParamsScreen />));
  await act(async () => button(label).click());
  const minRow = [...host.querySelectorAll(".param-row")].find(row => row.textContent.includes("Минимальное число"));
  expect(minRow.querySelector(".stepper-value").textContent).toBe("6");
  expect(minRow.querySelector(".stepper-btn").disabled).toBe(true);
  await act(async () => button("Начать занятие").click());
  const { params } = mocks.persist.mock.lastCall[2];
  expect(params.byMode.number_path).toMatchObject({ minNumber: 6, maxNumber: 10, boardSize });
  const [first] = generateTasks(NUMBER_PATH_MODE, [card], params.byMode.number_path);
  expect(first).toMatchObject({ number: 6, size: boardSize });
  expect(first.cells).toHaveLength(cellCount);
});
