import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentEditScreen from "./StudentEditScreen";
import { useAppStore } from "@/core/store";

const mocks = vi.hoisted(() => ({ getDb: vi.fn(), pushOp: vi.fn() }));
vi.mock("@/core/db", () => ({ getDb: mocks.getDb, kv: { set: vi.fn() } }));
vi.mock("@/core/syncApi", () => ({ pushOp: mocks.pushOp }));

describe("Student settings hints", () => {
  let root, container;
  const originalStore = useAppStore.getState();
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useAppStore.setState(originalStore, true);
    vi.unstubAllGlobals();
  });
  function mount(edit) {
    useAppStore.setState({ students: edit ? [{ id: "s1", name: "Миша" }] : [], editingStudentId: edit ? "s1" : null, screen: "student_edit", studentEditReturnScreen: null });
    act(() => root.render(<StudentEditScreen />));
  }
  function open() {
    act(() => container.querySelector('[aria-label="Показать подсказки"]').click());
  }
  function next() {
    act(() => document.querySelector(".screen-hints__primary").click());
  }
  const title = () => document.querySelector(".screen-hints__card strong").textContent;

  it("walks through all nine edit steps without changing or saving the profile", () => {
    mount(true);
    open();
    const expected = ["Введите имя ученика", "Добавьте фото", "Запишите важное", "Укажите пол", "Выберите основной язык", "Добавьте окружение", "Добавьте важные даты", "Подберите видео-награды", "Сохраните настройки"];
    for (const step of expected) { expect(title()).toBe(step); next(); }
    expect(document.querySelector(".screen-hints")).toBeNull();
    expect(container.querySelector(".se-name-input").value).toBe("Миша");
    expect(useAppStore.getState().students).toEqual([{ id: "s1", name: "Миша" }]);
    expect(mocks.getDb).not.toHaveBeenCalled();
    expect(mocks.pushOp).not.toHaveBeenCalled();
    open();
    expect(title()).toBe(expected[0]);
  });

  it("skips dates for a new student and retains name validation when saving", () => {
    mount(false);
    open();
    expect(document.querySelector(".screen-hints__eyebrow").textContent).toContain("1 ИЗ 8");
    for (let i = 0; i < 6; i++) next();
    expect(title()).toBe("Подберите видео-награды");
    next();
    expect(title()).toBe("Сохраните настройки");
    act(() => container.querySelector(".se-save-btn").click());
    expect(document.querySelector(".screen-hints")).toBeNull();
    expect(container.querySelector(".se-name-error").textContent).toBe("Введите имя ученика");
    expect(mocks.getDb).not.toHaveBeenCalled();
  });

  it("closes before opening a section explanation or leaving for dates", () => {
    mount(true);
    open();
    act(() => container.querySelector('[aria-label="Зачем нужны данные: Имя и фото"]').click());
    expect(document.querySelector(".screen-hints")).toBeNull();
    act(() => document.querySelector(".student-data-info-dialog .modal-close").click());
    open();
    act(() => [...container.querySelectorAll(".se-add-row")].find(button => button.textContent === "Добавить даты").click());
    expect(document.querySelector(".screen-hints")).toBeNull();
    expect(useAppStore.getState().screen).toBe("important_dates_settings");
  });
  it("saves the opt-in and duration in their own durable sync operation", async () => {
    mocks.getDb.mockResolvedValue({});
    mount(true);
    const pick = label => [...container.querySelectorAll("button")].find(button => button.textContent === label);
    await act(async () => pick("Новые правила").click());
    await act(async () => pick("1 минута").click());
    await act(async () => container.querySelector(".se-save-btn").click());
    expect(mocks.pushOp).toHaveBeenCalledWith("student.reward_settings.upsert", expect.objectContaining({ studentId: "s1", settings: expect.objectContaining({ algorithm: "flexible", duration: "60" }) }));
    expect(useAppStore.getState().students[0].rewardSettings.duration).toBe("60");
  });

  it("does not treat a remote policy change while the form is open as a local edit", async () => {
    mocks.getDb.mockResolvedValue({});
    mount(true);
    await act(async () => useAppStore.setState({ students: [{ id: "s1", name: "Миша", rewardSettings: { algorithm: "flexible", duration: "180" }, rewardSettingsUpdatedAt: "2026-10-23T12:00:00Z" }] }));
    await act(async () => container.querySelector(".se-save-btn").click());
    expect(mocks.pushOp.mock.calls.some(([type]) => type === "student.reward_settings.upsert")).toBe(false);
    expect(useAppStore.getState().students[0].rewardSettings.algorithm).toBe("flexible");
  });

});
