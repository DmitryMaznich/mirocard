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
    // The tests that pass soundEnabled are about the speakers themselves, so
    // they also switch on the topic's own "Озвучка карточек" (off by default).
    const params = soundEnabled ? { cardSound: true, ...sessionParams } : sessionParams;
    act(() => root.render(<DailyOrientationRenderer sessionParams={params} soundEnabled={soundEnabled} />));
  }

  function dateCards() {
    // [Число, Месяц] in DOM order -- both share daily-orientation__card--date.
    return Array.from(container.querySelectorAll(".daily-orientation__card--date"));
  }

  it("shows today as day, date and clock over now, weather and the day's plan; follows the carousel", () => {
    mountAt(new Date(2026, 8, 22, 14, 35));

    expect(container.textContent).toContain("ВТОРНИК");
    expect(container.textContent).toContain("БУДНИЙ ДЕНЬ");
    // Plain number, the month in the genitive next to it, and how to say it in words.
    expect(container.querySelector(".daily-orientation__date-number")?.textContent).toBe("22");
    expect(container.querySelector(".daily-orientation__date-month")?.textContent).toBe("СЕНТЯБРЯ");
    expect(container.querySelector(".daily-orientation__date-words")?.textContent).toBe("ДВАДЦАТЬ ВТОРОЕ СЕНТЯБРЯ");
    expect(container.textContent).not.toContain("СЕНТЯБРЬ");
    expect(container.querySelector(".daily-orientation__season-band")?.textContent).toBe("ОСЕНЬ");
    for (const caption of ["День недели", "Число", "Время", "Сейчас", "Погода", "План на день"]) {
      expect(container.textContent).toContain(caption);
    }
    expect(container.querySelectorAll(".daily-orientation__card")).toHaveLength(6);
    // Digits and words only: no dial on the wall screen.
    expect(container.querySelector(".daily-orientation__clock")).toBeNull();
    expect(container.querySelector(".daily-orientation__digital-time")).not.toBeNull();

    const tomorrow = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Завтра");
    act(() => tomorrow.click());

    expect(container.textContent).toContain("СРЕДА");
    expect(container.querySelector(".daily-orientation__date-number")?.textContent).toBe("23");
    const timeCard = container.querySelector(".daily-orientation__card--time");
    expect(timeCard?.classList.contains("daily-orientation__card--time-hidden")).toBe(true);
    expect(timeCard?.getAttribute("aria-hidden")).toBe("true");

    const today = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Сегодня");
    act(() => today.click());

    expect(timeCard?.classList.contains("daily-orientation__card--time-hidden")).toBe(false);
    expect(timeCard?.getAttribute("aria-hidden")).toBe("false");
  });

  it("asks for fullscreen once, not on every tap (a pinned Android app showed its «unpin» hint each time)", () => {
    const requestFullscreen = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    document.documentElement.requestFullscreen = requestFullscreen;
    try {
      mountAt(new Date(2026, 8, 22, 14, 35));
      act(() => container.querySelector(".daily-orientation__card--date").click());
      act(() => container.querySelector(".daily-orientation__modal-close").click());
      act(() => container.querySelector(".daily-orientation__card--weekday").click());
      expect(requestFullscreen).toHaveBeenCalledTimes(1);
      // Back from sleep (still not fullscreen): one more try.
      act(() => document.dispatchEvent(new Event("visibilitychange")));
      act(() => container.querySelector(".daily-orientation__modal-close").click());
      expect(requestFullscreen).toHaveBeenCalledTimes(2);
      act(() => root.unmount());
      container.remove();
      requestFullscreen.mockClear();
      mountAt(new Date(2026, 8, 22, 14, 35), { fullscreen: false });
      act(() => container.querySelector(".daily-orientation__card--weekday").click());
      expect(requestFullscreen).not.toHaveBeenCalled();

      // Already covering the whole screen (no system bars): nothing to hide.
      act(() => root.unmount());
      container.remove();
      vi.stubGlobal("screen", { width: window.innerWidth, height: window.innerHeight });
      mountAt(new Date(2026, 8, 22, 14, 35));
      act(() => container.querySelector(".daily-orientation__card--weekday").click());
      expect(requestFullscreen).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    } finally {
      delete document.fullscreenEnabled;
      delete document.documentElement.requestFullscreen;
    }
  });

  it("warms the weekday card on the weekend and says «ВЫХОДНОЙ»", () => {
    mountAt(new Date(2026, 10, 28, 10, 0));
    const card = container.querySelector(".daily-orientation__card--weekday");
    expect(card.classList.contains("daily-orientation__card--weekend")).toBe(true);
    expect(card.textContent).toContain("СУББОТА");
    expect(card.textContent).toContain("ВЫХОДНОЙ");
  });

  it("renders only the selected orientation cards", () => {
    mountAt(new Date(2026, 8, 22, 14, 35), {
      showCarousel: false,
      showWeekday: false,
      showDayOfMonth: false,
      showMonth: true,
      showSeason: false,
      showDaypart: false,
      showWeather: false,
      showTimeWords: false,
      showDigitalTime: true,
      showPlan: false,
    });

    expect(container.querySelector(".daily-orientation__carousel")).toBeNull();
    expect(container.querySelectorAll(".daily-orientation__card")).toHaveLength(2);
    // Without the number the month is named on its own, in the nominative.
    expect(container.querySelector(".daily-orientation__date-month")?.textContent).toBe("СЕНТЯБРЬ");
    expect(container.querySelector(".daily-orientation__date-number")).toBeNull();
    expect(container.querySelector(".daily-orientation__digital-time")).not.toBeNull();
    expect(container.querySelector(".daily-orientation__time-words")).toBeNull();
    expect(container.querySelector(".daily-orientation__card--plan")).toBeNull();
  });

  it("marks the current part of the day by the child's own wake/bed hours, today only", () => {
    const currentStep = () => container.querySelector(".daily-orientation__daypart-step--current")?.textContent;

    mountAt(new Date(2026, 8, 22, 14, 35));
    expect(currentStep()).toBe("ДЕНЬ");
    expect(container.querySelectorAll(".daily-orientation__daypart-step")).toHaveLength(4);
    expect(container.querySelector(".daily-orientation__daypart-picture")?.getAttribute("src"))
      .toBe("/daily-orientation/daypart_day.webp");

    const tomorrow = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "Завтра");
    act(() => tomorrow.click());
    expect(container.querySelector(".daily-orientation__card--daypart")?.getAttribute("aria-hidden")).toBe("true");

    act(() => root.unmount());
    container.remove();
    mountAt(new Date(2026, 8, 22, 21, 30), { bedHour: 22 });
    expect(currentStep()).toBe("ВЕЧЕР");
  });

  describe("tap-to-speak (via the speaker icon only -- whole cards no longer speak)", () => {
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

    it("speaks the matching sentence via each card's icon, respecting the carousel offset", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const weekdayIcon = container.querySelector(".daily-orientation__card--weekday .daily-orientation__speaker-icon");
      act(() => weekdayIcon.click());
      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][0].text).toBe("Сегодня вторник.");

      const tomorrow = Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Завтра");
      act(() => tomorrow.click());
      act(() => { vi.advanceTimersByTime(3000); }); // clear the tap cooldown from the first speak

      act(() => weekdayIcon.click());
      expect(speakSpy).toHaveBeenCalledTimes(2);
      expect(speakSpy.mock.calls[1][0].text).toBe("Завтра будет среда.");
    });

    it("speaks the full date on the Число card's icon", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const [numberCard] = dateCards();
      act(() => numberCard.querySelector(".daily-orientation__speaker-icon").click());

      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][0].text).toBe("Сегодня двадцать второе сентября.");
    });

    it("shows no speakers unless the adult turns on Озвучка карточек", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), { cardSound: false }, true);
      expect(container.querySelector(".daily-orientation__speaker-icon")).toBeNull();
    });

    it("cards no longer speak on a whole-card tap, and render no icon when sound is disabled", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, false);

      const [numberCard] = dateCards();
      expect(numberCard.querySelector(".daily-orientation__speaker-icon")).toBeNull();
      act(() => numberCard.click());
      expect(speakSpy).not.toHaveBeenCalled();
    });

    it("ignores a rapid second tap on the same icon within the cooldown window", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const [numberCard] = dateCards();
      const icon = numberCard.querySelector(".daily-orientation__speaker-icon");
      act(() => icon.click());
      act(() => icon.click());
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

    it("speaks the weather via its icon without also opening the picker, only once a pick exists", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const weatherCard = container.querySelector(".daily-orientation__card--weather");
      expect(weatherCard.querySelector(".daily-orientation__speaker-icon")).toBeNull();

      act(() => weatherCard.click());
      const rainOption = Array.from(container.querySelectorAll(".daily-orientation__weather-option"))
        .find((button) => button.textContent.includes("ИДЁТ ДОЖДЬ"));
      act(() => rainOption.click());

      const icon = weatherCard.querySelector(".daily-orientation__speaker-icon");
      expect(icon).not.toBeNull();
      act(() => icon.click());

      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][0].text).toBe("Сегодня идёт дождь.");
      expect(container.querySelector('[role="dialog"]')).toBeNull();
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

    const openWeek = () => act(() => container.querySelector(".daily-orientation__card--weekday").click());
    const rows = () => Array.from(container.querySelectorAll(".dom-weekplan__day"));

    it("shows this week as a planner page: full names, today framed, past days paler, weekends warm, no numbers", () => {
      mountAt(new Date(2026, 8, 23, 10, 0), { // a Wednesday
        weeklyPlan: "Пн: 🏫 Школа, 👟 Спорт, 🛏️ Спать\nВт: 🏫 Школа, 🏊 Бассейн, 🛏️ Спать\nСр: 🏫 Школа, 🛏️ Спать\nСб: 🚶 Прогулка, 🛏️ Спать",
      });
      openWeek();
      expect(rows().map((row) => row.querySelector(".dom-weekplan__name").textContent)).toEqual([
        "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье",
      ]);
      expect(container.querySelector(".dom--week").textContent).not.toMatch(/\d/);
      expect(rows()[2].classList.contains("dom-weekplan__day--today")).toBe(true);
      expect(rows().map((row) => row.querySelector(".dom-weekplan__tag").textContent)).toEqual(["", "вчера", "сегодня", "завтра", "", "", ""]);
      expect(rows()[0].classList.contains("dom-weekplan__day--past")).toBe(true);
      expect(rows()[1].classList.contains("dom-weekplan__day--past")).toBe(true);
      expect(rows()[3].classList.contains("dom-weekplan__day--past")).toBe(false);
      expect(rows()[5].classList.contains("dom-weekplan__day--weekend")).toBe(true);
    });

    it("shows each day's events but hides those every planned day has", () => {
      mountAt(new Date(2026, 8, 23, 10, 0), {
        weeklyPlan: "Пн: 🏫 Школа, 👟 Спорт, 🛏️ Спать\nВт: 🏫 Школа, 🏊 Бассейн, 🛏️ Спать\nСб: 🚶 Прогулка, 🛏️ Спать",
      });
      openWeek();
      const icons = (row) => Array.from(row.querySelectorAll(".dom-weekplan__icon")).map((icon) => icon.textContent);
      expect(icons(rows()[0])).toEqual(["🏫", "👟"]);
      expect(icons(rows()[1])).toEqual(["🏫", "🏊"]);
      expect(icons(rows()[5])).toEqual(["🚶"]);
      expect(icons(rows()[3])).toEqual([]);
    });

    it("names the days in order, says it's one week, then that Monday comes again", () => {
      const speakSpy = vi.fn();
      vi.stubGlobal("speechSynthesis", { cancel: vi.fn(), speak: speakSpy, getVoices: () => [] });
      vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(text) { this.text = text; } });
      mountAt(new Date(2026, 8, 23, 10, 0), undefined, true);
      openWeek();
      act(() => container.querySelector(".dom-week__count").click());
      act(() => { vi.advanceTimersByTime(0); });
      expect(container.querySelector(".dom-weekplan__day--lit .dom-weekplan__name").textContent).toBe("Понедельник");
      act(() => { vi.advanceTimersByTime(6 * 1400); });
      expect(container.querySelector(".dom-weekplan__day--lit .dom-weekplan__name").textContent).toBe("Воскресенье");
      act(() => { vi.advanceTimersByTime(1400); });
      expect(container.querySelector(".dom-week__say").textContent).toBe("Это одна неделя");
      act(() => { vi.advanceTimersByTime(2000); });
      expect(container.querySelector(".dom-week__say").textContent).toBe("Потом снова понедельник");
      expect(container.querySelector(".dom-weekplan__day--lit .dom-weekplan__name").textContent).toBe("Понедельник");
      expect(container.querySelector(".dom-week__count").disabled).toBe(false);
      vi.unstubAllGlobals();
    });

    it("closes via the close button", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      const weekdayCard = container.querySelector(".daily-orientation__card--weekday");
      act(() => weekdayCard.click());
      expect(container.querySelector('[role="dialog"]')).not.toBeNull();

      act(() => container.querySelector(".daily-orientation__modal-close").click());
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it("closes when the backdrop around it is tapped", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      act(() => container.querySelector(".daily-orientation__card--weekday").click());
      act(() => container.querySelector(".daily-orientation__modal-backdrop").click());
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
    it("is its own card, invites a pick when unset, under its own caption", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));

      const weatherCard = container.querySelector(".daily-orientation__card--weather");
      expect(weatherCard.textContent).toContain("Погода");

      const display = weatherCard.querySelector(".daily-orientation__weather-display");
      expect(display.classList.contains("daily-orientation__weather-display--unset")).toBe(true);
      expect(display.textContent).toContain("Отметить");
    });

    it("offers fog alongside the other options", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      act(() => container.querySelector(".daily-orientation__card--weather").click());

      const dialog = container.querySelector('[role="dialog"]');
      const fogOption = Array.from(dialog.querySelectorAll("button"))
        .find((button) => button.textContent.includes("ТУМАН"));
      expect(fogOption).not.toBeUndefined();
    });

    // Said the way people say it: "Сегодня солнечно / идёт дождь / туман"
    // (the speech therapist's call, 2026-10-07 -- replaced "погода дождливая").
    it("labels each option the way it's said: солнечно, идёт дождь, туман", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      act(() => container.querySelector(".daily-orientation__card--weather").click());

      const optionTexts = Array.from(container.querySelectorAll(".daily-orientation__weather-option"))
        .map((button) => button.textContent);
      expect(optionTexts).toEqual([
        "СОЛНЕЧНО",
        "ПАСМУРНО",
        "ИДЁТ ДОЖДЬ",
        "ИДЁТ СНЕГ",
        "ТУМАН",
      ]);
    });

    it("opens a picker, shows the pick on the card, and persists it under today's date", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));

      const weatherCard = container.querySelector(".daily-orientation__card--weather");
      act(() => weatherCard.click());
      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();

      const rainOption = Array.from(dialog.querySelectorAll("button"))
        .find((button) => button.textContent.includes("ИДЁТ ДОЖДЬ"));
      act(() => rainOption.click());

      expect(container.querySelector('[role="dialog"]')).toBeNull();
      const display = weatherCard.querySelector(".daily-orientation__weather-display");
      expect(display.classList.contains("daily-orientation__weather-display--set")).toBe(true);
      expect(display.textContent).toContain("ИДЁТ ДОЖДЬ");

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

      const display = container.querySelector(".daily-orientation__weather-display");
      expect(display.classList.contains("daily-orientation__weather-display--unset")).toBe(true);
      expect(display.textContent).not.toContain("СНЕЖНАЯ");
    });

    it("is hidden (not removed) while viewing Вчера/Завтра, like the time card", () => {
      mountAt(new Date(2026, 8, 22, 14, 35));
      const weatherCard = container.querySelector(".daily-orientation__card--weather");
      expect(weatherCard.getAttribute("aria-hidden")).toBe("false");

      const tomorrow = Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Завтра");
      act(() => tomorrow.click());

      expect(weatherCard.getAttribute("aria-hidden")).toBe("true");
      expect(weatherCard.classList.contains("daily-orientation__card--weather-hidden")).toBe(true);
    });
  });

  describe("concept modals", () => {
    function openFrom(selector) {
      act(() => container.querySelector(selector).click());
      return container.querySelector('[role="dialog"]');
    }

    it("Число: month calendar with the day circled and «29 сентября» linked to «сентябрь»", () => {
      mountAt(new Date(2026, 8, 29, 10, 0));
      const dialog = openFrom(".daily-orientation__card--date");
      expect(dialog.querySelector(".dom-title").textContent).toBe("Сентябрь 2026");
      expect(dialog.querySelectorAll(".dom-calendar__cell:not(.dom-calendar__cell--blank)")).toHaveLength(30);
      expect(dialog.querySelector(".dom-calendar__cell--active").textContent).toBe("29");
      expect(dialog.querySelector(".dom-date-say__phrase").textContent).toBe("Сегодня 29 сентября");
      // the one letter that changes is marked in both forms
      expect(Array.from(dialog.querySelectorAll(".dom-date-say__bridge mark")).map((m) => m.textContent)).toEqual(["ь", "я"]);
    });

    it("Число follows the carousel: tomorrow's date and «Завтра будет»", () => {
      mountAt(new Date(2026, 8, 30, 10, 0));
      const tomorrow = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Завтра");
      act(() => tomorrow.click());
      const dialog = openFrom(".daily-orientation__card--date");
      expect(dialog.querySelector(".dom-title").textContent).toBe("Октябрь 2026");
      expect(dialog.querySelector(".dom-date-say__phrase").textContent).toBe("Завтра будет 1 октября");
    });

    it("Месяц (the month word on the Число card): twelve months grouped by season", () => {
      mountAt(new Date(2028, 1, 10, 10, 0)); // leap February
      const dialog = openFrom(".daily-orientation__date-month");
      const months = Array.from(dialog.querySelectorAll(".dom-months__month"));
      expect(months).toHaveLength(12);
      expect(months[0].textContent).toBe("Декабрь");
      const february = dialog.querySelector(".dom-months__month--active");
      expect(february.textContent).toBe("Февраль");
    });

    it("Время года: the four seasons as a cycle with the current one marked", () => {
      mountAt(new Date(2026, 8, 29, 10, 0));
      const dialog = openFrom(".daily-orientation__season-band");
      expect(Array.from(dialog.querySelectorAll(".dom-cycle__name")).map((n) => n.textContent)).toEqual(["Зима", "Весна", "Лето", "Осень"]);
      expect(dialog.querySelector(".dom-cycle__item--active .dom-cycle__name").textContent).toBe("Осень");
      expect(dialog.querySelector(".dom-cycle__month--active").textContent).toBe("сентябрь");
    });

    it("Время суток: the four parts with the child's own hours, and no modal for вчера/завтра", () => {
      mountAt(new Date(2026, 8, 29, 20, 0), { wakeHour: 6, bedHour: 22 });
      const dialog = openFrom(".daily-orientation__card--daypart");
      expect(dialog.querySelector(".dom-cycle__item--active .dom-cycle__name").textContent).toBe("Вечер");
      expect(dialog.textContent).toContain("6:00 – 12:00");
      expect(dialog.textContent).toContain("22:00 – 6:00");
      act(() => container.querySelector(".daily-orientation__modal-close").click());

      const yesterday = Array.from(container.querySelectorAll("button")).find((b) => b.textContent === "Вчера");
      act(() => yesterday.click());
      act(() => container.querySelector(".daily-orientation__card--daypart").click());
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });

    it("Время: the dial lives in the «Часы» modal, not on the card", () => {
      mountAt(new Date(2026, 8, 29, 10, 15));
      const dialog = openFrom(".daily-orientation__card--time");
      expect(dialog.querySelector(".daily-orientation__clock")).not.toBeNull();
      expect(dialog.querySelector(".daily-orientation__digital-time").textContent).toBe("10:15");
    });

    it("the speaker button speaks without opening the modal", () => {
      mountAt(new Date(2026, 8, 29, 10, 0), undefined, true);
      const speaker = container.querySelector(".daily-orientation__card--weekday .daily-orientation__speaker-icon");
      act(() => speaker.click());
      expect(container.querySelector('[role="dialog"]')).toBeNull();
    });
  });
});

describe("DailyOrientationRenderer — оценка темы, шаг 3", () => {
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
    act(() => root.render(<DailyOrientationRenderer sessionParams={sessionParams} soundEnabled={false} />));
  }
  function clickCarousel(label) {
    act(() => Array.from(container.querySelectorAll("button")).find((button) => button.textContent === label).click());
  }

  const PLAN = "Пн: 🏫 Школа, 👟 Спорт, 🛏️ Спать\nВт: 🏊 Бассейн, 🛏️ Спать\nСр: 🏫 Школа, 📚 Занимаемся, 🛏️ Спать";
  const planItems = () => Array.from(container.querySelectorAll(".daily-orientation__plan-item"));
  const words = () => planItems().map((item) => item.querySelector(".daily-orientation__plan-word").textContent);

  it("shows the day's plan from the weekly plan, the first thing framed and the next one «ПОТОМ»", () => {
    mountAt(new Date(2026, 9, 7, 9, 0), { weeklyPlan: PLAN }); // a Wednesday
    expect(words()).toEqual(["ШКОЛА", "ЗАНИМАЕМСЯ", "СПАТЬ"]);
    expect(planItems()[0].classList.contains("daily-orientation__plan-item--focus")).toBe(true);
    expect(planItems()[1].querySelector(".daily-orientation__plan-tag").textContent).toBe("ПОТОМ");
    clickCarousel("Вчера");
    expect(words()).toEqual(["БАССЕЙН", "СПАТЬ"]);
    expect(planItems()[0].querySelector(".daily-orientation__plan-picture").textContent).toBe("🏊");
  });

  it("a tap on the framed thing marks it done (kept for the day), a tap on the done one undoes it", () => {
    mountAt(new Date(2026, 9, 7, 15, 0), { weeklyPlan: PLAN });
    act(() => planItems()[0].click());
    expect(planItems()[0].classList.contains("daily-orientation__plan-item--done")).toBe(true);
    expect(planItems()[1].classList.contains("daily-orientation__plan-item--focus")).toBe(true);
    expect(JSON.parse(window.localStorage.getItem("daily_orientation_plan_changes"))["2026-10-07"].done).toEqual(["школа"]);
    act(() => planItems()[0].click());
    expect(planItems()[0].classList.contains("daily-orientation__plan-item--focus")).toBe(true);
    window.localStorage.clear();
  });

  it("switches a thing off for today from «Что меняется?»: crossed out «НЕ БУДЕТ», the frame moves on", () => {
    mountAt(new Date(2026, 9, 7, 8, 0), { weeklyPlan: PLAN });
    act(() => container.querySelector(".daily-orientation__plan-edit").click());
    const dialog = container.querySelector('[role="dialog"]');
    const school = Array.from(dialog.querySelectorAll(".daily-orientation__plan-change")).find((b) => b.textContent.includes("Школа"));
    act(() => school.click());
    act(() => container.querySelector(".daily-orientation__modal-close").click());
    expect(planItems()[0].classList.contains("daily-orientation__plan-item--cancelled")).toBe(true);
    expect(planItems()[0].textContent).toContain("НЕ БУДЕТ");
    expect(planItems()[1].classList.contains("daily-orientation__plan-item--focus")).toBe(true);
    window.localStorage.clear();
  });

  it("goes dark after bedtime with «НОЧЬ», the clock and the next day's first thing; a tap shows the screen for a minute", () => {
    mountAt(new Date(2026, 9, 6, 22, 30), { weeklyPlan: PLAN, bedHour: 21 }); // Tuesday night, Wednesday next
    const night = () => container.querySelector(".daily-orientation__night");
    expect(night().textContent).toContain("НОЧЬ");
    expect(night().textContent).toContain("22:30");
    expect(night().querySelector(".daily-orientation__night-next-word").textContent).toBe("ШКОЛА");
    act(() => night().click());
    expect(night()).toBeNull();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(night()).not.toBeNull();
  });

  it("after midnight the next thing is that same day's, and the dark screen can be switched off", () => {
    mountAt(new Date(2026, 9, 7, 5, 0), { weeklyPlan: PLAN, wakeHour: 7 }); // Wednesday 5:00
    expect(container.querySelector(".daily-orientation__night-next-word").textContent).toBe("ШКОЛА");
    act(() => root.unmount());
    container.remove();
    mountAt(new Date(2026, 9, 7, 5, 0), { weeklyPlan: PLAN, nightScreen: false });
    expect(container.querySelector(".daily-orientation__night")).toBeNull();
  });

  it("writes answers in sentence case when asked to", () => {
    mountAt(new Date(2026, 9, 7, 9, 0), { letterCase: "sentence" });
    expect(container.textContent).toContain("Среда");
    expect(container.textContent).not.toContain("СРЕДА");
    expect(container.querySelector(".daily-orientation--sentence-case")).not.toBeNull();
  });

  it("can say the time the way it's said at home", () => {
    mountAt(new Date(2026, 9, 7, 9, 20), { timeWordsStyle: "spoken" });
    const words = container.querySelector(".daily-orientation__time-words");
    expect(Array.from(words.children).map((span) => [span.className, span.textContent])).toEqual([
      ["daily-orientation__time-words-minute", "ДВАДЦАТЬ МИНУТ"],
      ["daily-orientation__time-words-hour", "ДЕСЯТОГО"],
    ]);
    expect(words.getAttribute("aria-label")).toBe("двадцать минут десятого");
  });
});
