import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ParamsScreen from "./ParamsScreen";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";

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
