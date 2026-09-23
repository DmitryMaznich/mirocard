import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import DailyOrientationRenderer from "./index.jsx";

describe("DailyOrientationRenderer", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    container = null;
    vi.useRealTimers();
  });

  function mountAt(date, sessionParams) {
    vi.useFakeTimers();
    vi.setSystemTime(date);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<DailyOrientationRenderer sessionParams={sessionParams} />));
  }

  it("shows today by default and updates the date fields through the carousel", () => {
    mountAt(new Date(2026, 8, 22, 14, 35));

    expect(container.textContent).toContain("ВТОРНИК");
    expect(container.textContent).toContain("22-е");
    expect(container.textContent).toContain("СЕНТЯБРЬ");
    expect(container.textContent).toContain("Какой сегодня день недели?");
    expect(container.textContent).toContain("Какое сегодня число?");
    expect(container.textContent).toContain("Какой сейчас месяц?");
    expect(container.textContent).toContain("Сколько сейчас времени?");
    expect(container.querySelectorAll(".daily-orientation__card-title")).toHaveLength(0);

    const tomorrow = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Завтра");
    act(() => tomorrow.click());

    expect(container.textContent).toContain("СРЕДА");
    expect(container.textContent).toContain("23-е");
    expect(container.textContent).toContain("Какой завтра будет день недели?");
    expect(container.textContent).toContain("Какое число будет завтра?");
    expect(container.textContent).toContain("Какой месяц будет завтра?");

    const timeCard = container.querySelector(".daily-orientation__card--time");
    expect(timeCard?.classList.contains("daily-orientation__card--time-hidden")).toBe(true);
    expect(timeCard?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll(".daily-orientation__card")).toHaveLength(4);

    const today = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Сегодня");
    act(() => today.click());

    expect(timeCard?.classList.contains("daily-orientation__card--time-hidden")).toBe(false);
    expect(timeCard?.getAttribute("aria-hidden")).toBe("false");
  });

  it("renders only the selected orientation blocks and closes gaps in the grid", () => {
    mountAt(new Date(2026, 8, 22, 14, 35), {
      showCarousel: false,
      showWeekday: false,
      showDayOfMonth: false,
      showMonth: true,
      showSeason: false,
      showAnalogClock: true,
      showTimeWords: false,
      showDigitalTime: false,
    });

    expect(container.querySelector(".daily-orientation__carousel")).toBeNull();
    expect(container.querySelector(".daily-orientation__grid")?.classList.contains("daily-orientation__grid--2")).toBe(true);
    expect(container.textContent).toContain("СЕНТЯБРЬ");
    expect(container.textContent).toContain("Какой сейчас месяц?");
    expect(container.textContent).not.toContain("Какое сегодня число?");
    expect(container.textContent).toContain("Сколько сейчас времени?");
    expect(container.querySelector(".daily-orientation__clock")).not.toBeNull();
    expect(container.querySelector(".daily-orientation__digital-time")).toBeNull();
  });
});
