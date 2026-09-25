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
    window.localStorage.clear();
  });

  function mountAt(date, sessionParams, soundEnabled) {
    vi.useFakeTimers();
    vi.setSystemTime(date);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<DailyOrientationRenderer sessionParams={sessionParams} soundEnabled={soundEnabled} />));
  }

  it("shows today by default and updates the date fields through the carousel", () => {
    mountAt(new Date(2026, 8, 22, 14, 35));

    expect(container.textContent).toContain("ВТОРНИК");
    expect(container.textContent).toContain("22-е");
    expect(container.textContent).toContain("СЕНТЯБРЬ");
    expect(container.textContent).toContain("День недели");
    expect(container.textContent).toContain("Число");
    expect(container.textContent).toContain("Месяц");
    expect(container.textContent).toContain("Время года");
    expect(container.textContent).toContain("Время");
    expect(container.querySelectorAll(".daily-orientation__card-title")).toHaveLength(0);

    const tomorrow = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Завтра");
    act(() => tomorrow.click());

    expect(container.textContent).toContain("СРЕДА");
    expect(container.textContent).toContain("23-е");
    // Captions stay plain nominative labels regardless of offset — the carousel
    // pill is what shows which day is being looked at, not the card captions.
    expect(container.textContent).toContain("День недели");
    expect(container.textContent).toContain("Число");
    expect(container.textContent).toContain("Месяц");

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
    expect(container.textContent).toContain("Месяц");
    expect(container.textContent).not.toContain("Число");
    expect(container.textContent).toContain("Время");
    expect(container.querySelector(".daily-orientation__clock")).not.toBeNull();
    expect(container.querySelector(".daily-orientation__digital-time")).toBeNull();
  });

  describe("tap-to-speak", () => {
    let speakSpy;

    function stubSpeechSynthesis() {
      speakSpy = vi.fn();
      vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: speakSpy, getVoices: () => [] });
      vi.stubGlobal("SpeechSynthesisUtterance", class {
        constructor(text) { this.text = text; }
      });
    }

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("speaks the matching sentence when a card is tapped, respecting the carousel offset", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const seasonCard = container.querySelector(".daily-orientation__card--season");
      act(() => seasonCard.click());
      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][0].text).toBe("Сейчас осень.");

      const tomorrow = Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Завтра");
      act(() => tomorrow.click());
      act(() => { vi.advanceTimersByTime(3000); }); // clear the tap cooldown from the first speak

      act(() => seasonCard.click());
      expect(speakSpy).toHaveBeenCalledTimes(2);
      expect(speakSpy.mock.calls[1][0].text).toBe("Завтра будет осень.");
    });

    it("does nothing when sound is disabled", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, false);

      const dateCard = container.querySelector(".daily-orientation__card--date");
      expect(dateCard.getAttribute("role")).toBeNull();
      act(() => dateCard.click());
      expect(speakSpy).not.toHaveBeenCalled();
    });

    it("ignores a rapid second tap within the cooldown window", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const dateCard = container.querySelector(".daily-orientation__card--date");
      act(() => dateCard.click());
      act(() => dateCard.click());
      expect(speakSpy).toHaveBeenCalledTimes(1);
    });

    it("speaks via the icon on the weekday card without also opening the weekly plan modal", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const weekdayCard = container.querySelector(".daily-orientation__card--weekday");
      const icon = weekdayCard.querySelector(".daily-orientation__speaker-icon");
      act(() => icon.click());

      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][0].text).toBe("Сегодня вторник.");
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it("tapping the weather row does not also speak the season", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      act(() => container.querySelector(".daily-orientation__weather-row").click());
      expect(speakSpy).not.toHaveBeenCalled();
    });
  });

  describe("weekly plan modal", () => {
    it("opens when the weekday card is tapped, even with sound disabled", () => {
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, false);
      expect(container.querySelector('[role="dialog"]')).toBeNull();

      const weekdayCard = container.querySelector(".daily-orientation__card--weekday");
      act(() => weekdayCard.click());

      expect(container.querySelector('[role="dialog"]')).not.toBeNull();
    });

    it("highlights today, marks weekends, and shows plan text only for days that have one", () => {
      mountAt(new Date(2026, 8, 22, 14, 35), {
        weeklyPlan: "Пн: Школа\nВт: Школа\nСр: Школа\nЧт: Школа\nПт: Школа\nСб: Поездка в парк",
      });

      const weekdayCard = container.querySelector(".daily-orientation__card--weekday");
      act(() => weekdayCard.click());

      const days = Array.from(container.querySelectorAll(".daily-orientation__week-day"));
      expect(days).toHaveLength(7);

      const tuesday = days.find((d) => d.textContent.startsWith("ВТ"));
      expect(tuesday.classList.contains("daily-orientation__week-day--today")).toBe(true);
      expect(tuesday.textContent).toContain("Школа");

      const saturday = days.find((d) => d.textContent.startsWith("СБ"));
      expect(saturday.classList.contains("daily-orientation__week-day--weekend")).toBe(true);
      expect(saturday.textContent).toContain("Поездка в парк");

      const sunday = days.find((d) => d.textContent.startsWith("ВС"));
      expect(sunday.classList.contains("daily-orientation__week-day--weekend")).toBe(true);
      expect(sunday.querySelector(".daily-orientation__week-day-plan")).toBeNull();
    });

    it("closes via the close button", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      const weekdayCard = container.querySelector(".daily-orientation__card--weekday");
      act(() => weekdayCard.click());
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();

      act(() => container.querySelector(".daily-orientation__modal-close").click());
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it("auto-closes after being left open and idle", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      const weekdayCard = container.querySelector(".daily-orientation__card--weekday");
      act(() => weekdayCard.click());
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();

      act(() => { vi.advanceTimersByTime(90_000); });
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });

  describe("weather picker", () => {
    it("invites the child to pick today's weather when none has been set yet, under its own caption", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));

      const seasonCard = container.querySelector(".daily-orientation__card--season");
      expect(seasonCard.textContent).toContain("Погода");

      const weatherRow = container.querySelector(".daily-orientation__weather-row");
      expect(weatherRow.classList.contains("daily-orientation__weather-row--unset")).toBe(true);
      expect(weatherRow.textContent).toContain("Добавить");
    });

    it("offers fog alongside the other options", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      act(() => container.querySelector(".daily-orientation__weather-row").click());

      const dialog = container.querySelector('[role="dialog"]');
      const fogOption = Array.from(dialog.querySelectorAll("button"))
        .find((button) => button.textContent.includes("ТУМАННАЯ"));
      expect(fogOption).not.toBeUndefined();
    });

    // Weather agrees in gender with "погода" (feminine): "погода дождливая",
    // never a bare noun like "погода — дождь" (rain is the precipitation, not
    // a description of the weather) -- see feedback that shipped this fix.
    it("labels each option as a feminine adjective agreeing with погода, not the precipitation noun", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      act(() => container.querySelector(".daily-orientation__weather-row").click());

      const optionTexts = Array.from(container.querySelectorAll(".daily-orientation__weather-option"))
        .map((button) => button.textContent);
      expect(optionTexts).toEqual([
        "СОЛНЕЧНАЯ",
        "ПАСМУРНАЯ",
        "ДОЖДЛИВАЯ",
        "СНЕЖНАЯ",
        "ТУМАННАЯ",
      ]);
    });

    it("opens a picker, shows the pick on the card, and persists it under today's date", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));

      act(() => container.querySelector(".daily-orientation__weather-row").click());
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();

      const rainOption = Array.from(dialog.querySelectorAll("button"))
        .find((button) => button.textContent.includes("ДОЖДЛИВАЯ"));
      act(() => rainOption.click());

      expect(container.querySelector('[role="dialog"]')).toBeNull();
      const weatherRow = container.querySelector(".daily-orientation__weather-row");
      expect(weatherRow.classList.contains("daily-orientation__weather-row--set")).toBe(true);
      expect(weatherRow.textContent).toContain("ДОЖДЛИВАЯ");

      expect(window.localStorage.getItem("daily_orientation_weather")).toBe(
        JSON.stringify({ date: "2026-09-22", weatherId: "rain" })
      );
    });

    it("does not carry yesterday's stored pick into a new day", () => {
      window.localStorage.setItem(
        "daily_orientation_weather",
        JSON.stringify({ date: "2026-09-21", weatherId: "snow" })
      );
      mountAt(new Date(2026, 8, 22, 14, 35));

      const weatherRow = container.querySelector(".daily-orientation__weather-row");
      expect(weatherRow.classList.contains("daily-orientation__weather-row--unset")).toBe(true);
      expect(weatherRow.textContent).not.toContain("СНЕЖНАЯ");
    });

    it("is hidden while viewing Вчера/Завтра", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      const tomorrow = Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Завтра");
      act(() => tomorrow.click());

      expect(container.querySelector(".daily-orientation__weather-row")).toBeNull();
    });
  });
});
