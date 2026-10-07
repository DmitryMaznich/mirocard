import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/core/store";
import DailyOrientationRenderer from "./index.jsx";

const MOM = { id: "mom", type: "birthday", title: "День рождения мамы", day: 7, month: 10, icon: "🎂", countdownDays: 7 };
const SCHOOL = { id: "school", type: "event", title: "Идём в новую школу", day: 19, month: 10, year: 2026, repeat: "once", icon: "🏫", countdownDays: 14 };
const ME = { id: "me", type: "own_birthday", day: 7, month: 10, year: 2018, icon: "🎂", countdownDays: 7 };

describe("DailyOrientationRenderer — важные даты", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.useRealTimers();
    useAppStore.setState({ students: [], activeStudentId: null });
  });

  function mountAt(date, importantDates, sessionParams = {}) {
    useAppStore.setState({ students: [{ id: "s1", name: "Миша", importantDates, myPeople: [] }], activeStudentId: "s1" });
    vi.useFakeTimers();
    vi.setSystemTime(date);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<DailyOrientationRenderer sessionParams={sessionParams} soundEnabled={false} />));
  }

  function clickCarousel(label) {
    const button = Array.from(container.querySelectorAll("button")).find((candidate) => candidate.textContent === label);
    act(() => button.click());
  }

  it("dresses up the day itself with a ribbon, a garland and a mark on the number", () => {
    mountAt(new Date(2026, 9, 7, 9, 20), [MOM, SCHOOL]);
    expect(container.querySelector(".daily-orientation__important--day")?.textContent).toContain("Сегодня день рождения мамы!");
    expect(container.querySelector(".daily-orientation--festive")).not.toBeNull();
    expect(container.querySelector(".daily-orientation__garland")).not.toBeNull();
    expect(container.querySelector(".daily-orientation__date-mark")?.textContent).toBe("🎂");
    // The day's own ribbon replaces any countdown.
    expect(container.querySelector(".daily-orientation__important--countdown")).toBeNull();
  });

  it("gives the child's own birthday in the first person with the age", () => {
    mountAt(new Date(2026, 9, 7, 9, 20), [ME]);
    const ribbon = container.querySelector(".daily-orientation__important--day");
    expect(ribbon.textContent).toContain("Сегодня мой день рождения!");
    expect(ribbon.textContent).toContain("Мне 8 лет.");
    expect(ribbon.querySelectorAll(".daily-orientation__candle--lit")).toHaveLength(8);
  });

  it("counts down in the days before, with candles for a birthday", () => {
    mountAt(new Date(2026, 9, 4, 9, 20), [MOM]);
    const ribbon = container.querySelector(".daily-orientation__important--countdown");
    expect(ribbon.textContent).toContain("День рождения мамы");
    expect(ribbon.textContent).toContain("через 3 дня");
    expect(ribbon.querySelectorAll(".daily-orientation__candle")).toHaveLength(7);
    expect(ribbon.querySelectorAll(".daily-orientation__candle--lit")).toHaveLength(3);
    expect(container.querySelector(".daily-orientation--festive")).toBeNull();
  });

  it("previews tomorrow's festive look from the carousel", () => {
    mountAt(new Date(2026, 9, 6, 19, 0), [MOM]);
    clickCarousel("Завтра");
    expect(container.querySelector(".daily-orientation__important--day")?.textContent).toContain("Завтра день рождения мамы!");
  });

  it("says «Вчера был …» the day after, calmly, with the day's photos", () => {
    const photos = ["data:image/png;base64,AAA", "data:image/png;base64,BBB"];
    mountAt(new Date(2026, 9, 8, 9, 0), [{ ...MOM, eventPhotos: { 2026: photos, 2025: ["data:image/png;base64,OLD"] } }]);
    clickCarousel("Вчера");
    const ribbon = container.querySelector(".daily-orientation__important--past");
    expect(ribbon.textContent).toContain("Вчера был день рождения мамы.");
    expect(container.querySelector(".daily-orientation--festive")).toBeNull();
    expect(ribbon.querySelectorAll(".daily-orientation__important-photos img")).toHaveLength(2);

    act(() => ribbon.querySelector(".daily-orientation__important-photos").click());
    expect(container.querySelector(".daily-orientation__viewer")?.textContent).toContain("1 / 2");
  });

  it("falls back to the title when a verb title has no «вчера» sentence", () => {
    mountAt(new Date(2026, 9, 20, 9, 0), [SCHOOL]);
    clickCarousel("Вчера");
    expect(container.querySelector(".daily-orientation__important--past .daily-orientation__important-phrase").textContent).toBe("Идём в новую школу");
  });

  it("opens questions for the adult from the ribbon's «?»", () => {
    mountAt(new Date(2026, 9, 7, 9, 20), [MOM]);
    act(() => container.querySelector(".daily-orientation__ask").click());
    const dialog = container.querySelector('[role="dialog"]');
    expect(dialog.textContent).toContain("У кого сегодня день рождения?");
    expect(dialog.textContent).toContain("родительный падеж");
  });

  it("keeps the ribbon but drops the garland in the calm style, and shows nothing when off", () => {
    mountAt(new Date(2026, 9, 7, 9, 20), [MOM], { importantDatesStyle: "calm" });
    expect(container.querySelector(".daily-orientation__important--day")).not.toBeNull();
    expect(container.querySelector(".daily-orientation__garland")).toBeNull();
    act(() => root.unmount());
    container.remove();
    root = null;

    mountAt(new Date(2026, 9, 7, 9, 20), [MOM], { importantDatesStyle: "off" });
    expect(container.querySelector(".daily-orientation__important")).toBeNull();
  });

  it("ignores switched-off and deleted dates", () => {
    mountAt(new Date(2026, 9, 7, 9, 20), [{ ...MOM, enabled: false }, { ...MOM, id: "gone", deletedAt: "2026-10-01T00:00:00.000Z" }]);
    expect(container.querySelector(".daily-orientation__important")).toBeNull();
  });
});
