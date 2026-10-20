import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import { setUiLanguage } from "@/shared/i18n/uiLanguage.js";
import HomeScreen from "./HomeScreen";
import StudentsScreen from "@/features/students/StudentsScreen";
import StudentEditScreen from "@/features/students/StudentEditScreen";
import TopicLibraryScreen from "@/features/topics/TopicLibraryScreen";

const mocks = vi.hoisted(() => ({ pushOp: vi.fn(), fetchCatalog: vi.fn() }));
vi.mock("@/core/syncApi", () => ({ pushOp: mocks.pushOp, flushQueue: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/shared/hooks/useAppUpdate", () => ({ useAppUpdate: () => ({ hasUpdate: false, applyUpdate: vi.fn() }) }));
vi.mock("@/features/topics/catalogService", async importOriginal => ({
  ...await importOriginal(), fetchCatalog: mocks.fetchCatalog,
  silentUpdateOutdatedTopics: vi.fn().mockResolvedValue({ updated: [] }),
}));
vi.mock("@/shared/components/TopicCover", () => ({ default: () => <span /> }));

let root, host;
const initialState = useAppStore.getState();
const topic = { meta: { id: "comparison", title: { ru: "Сравнение" }, version: "1", builtin: true }, modes: [{ id: "compare", ui: { title: "Сравни" } }], cards: [] };
const mount = Component => act(async () => root.render(<Component />));
const changeLanguage = language => act(async () => setUiLanguage(language));
const button = text => [...host.querySelectorAll("button")].find(node => node.textContent === text);
function inputValue(input, value) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.clearAllMocks();
  localStorage.clear();
  setUiLanguage("sl");
  mocks.fetchCatalog.mockResolvedValue({ decks: [], archivedTopicIds: [] });
  useAppStore.setState({ account: null, token: null, screen: "home", homeActiveTab: "session", students: [], activeStudentId: null, topicRecords: [topic], activeTopicId: "comparison", activeModeId: "compare", activeTextId: null, sessions: [], ownedTopics: [], buildInfo: { version: "test" }, editingStudentId: null, studentEditReturnScreen: null });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount()); host.remove();
  setUiLanguage("ru"); useAppStore.setState(initialState, true); vi.unstubAllGlobals();
});

it("uses Slovenian on home and in its menu, switches live, and keeps the selected lesson", async () => {
  const student = { id: "kid", name: "Миша" };
  useAppStore.setState({ students: [student], activeStudentId: "kid", sessions: [{ id: "past", studentId: "kid" }] });
  await mount(HomeScreen);
  expect(host.textContent).toContain("Sestavi učno uro");
  expect(host.textContent).toContain("Primerjanje");
  await act(async () => host.querySelector('[aria-label="Meni"]').click());
  expect(button("Učenci")).toBeTruthy();
  expect(button("Nastavitve")).toBeTruthy();
  await changeLanguage("ru");
  expect(button("Ученики")).toBeTruthy();
  expect(host.textContent).toContain("Собери занятие");
  expect(useAppStore.getState()).toMatchObject({ activeStudentId: "kid", activeTopicId: "comparison", activeModeId: "compare", students: [student] });
  expect(topic.meta.title).toEqual({ ru: "Сравнение" });
});

it("keeps an unsaved student name across switching, localizes hints and saves the original name", async () => {
  await mount(StudentEditScreen);
  expect(host.querySelector("h1").textContent).toBe("Prvi učenec");
  await act(async () => inputValue(host.querySelector('.se-name-input'), "Миша"));
  await act(async () => host.querySelector('[aria-label="Prikaži namige"]').click());
  expect(document.querySelector('.screen-hints__card strong').textContent).toBe("Vnesite ime učenca");
  await changeLanguage("ru");
  expect(document.querySelector('.screen-hints__card strong').textContent).toBe("Введите имя ученика");
  expect(host.querySelector('.se-name-input').value).toBe("Миша");
  await changeLanguage("sl");
  await act(async () => host.querySelector('.se-save-btn').click());
  expect(useAppStore.getState().students[0].name).toBe("Миша");
  expect(mocks.pushOp).toHaveBeenCalledWith("student.upsert", expect.objectContaining({ name: "Миша" }));
  await mount(StudentsScreen);
  expect(host.querySelector('h1').textContent).toBe("Učenci");
  expect(host.textContent).toContain("Миша");
  await act(async () => host.querySelector('.icon-btn--danger').click());
  expect(host.querySelector('[role="dialog"]').textContent).toContain("Zgodovina učnih ur bo izgubljena.");
});

it("localizes the catalog and categories without resetting its filter or search", async () => {
  await mount(TopicLibraryScreen);
  expect(host.querySelector('h1').textContent).toBe("Teme");
  expect(button("Matematika")).toBeTruthy();
  expect(host.textContent).toContain("Primerjanje");
  await act(async () => button("Matematika").click());
  await changeLanguage("ru");
  expect(button("Математика").className).toContain("is-active");
  await act(async () => inputValue(host.querySelector('input'), "Сравнение"));
  expect(host.textContent).toContain("Результаты поиска");
  await changeLanguage("sl");
  expect(host.querySelector('input').value).toBe("Сравнение");
  expect(host.textContent).toContain("Rezultati iskanja");
  expect(useAppStore.getState().activeTopicId).toBe("comparison");
});
