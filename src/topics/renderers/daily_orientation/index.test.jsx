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

  it("shows today by default as seven separate cards and updates through the carousel", () => {
    mountAt(new Date(2026, 8, 22, 14, 35));

    expect(container.textContent).toContain("ВТОРНИК");
    // Plain number on the card -- no "-е" for the child to read as a letter.
    expect(container.querySelector(".daily-orientation__date-number")?.textContent).toBe("22");
    expect(container.textContent).not.toContain("22-е");
    expect(container.textContent).toContain("СЕНТЯБРЬ");
    expect(container.textContent).toContain("День недели");
    expect(container.textContent).toContain("Число");
    expect(container.textContent).toContain("Месяц");
    expect(container.textContent).toContain("Время года");
    expect(container.textContent).toContain("Погода");
    expect(container.textContent).toContain("Сейчас");
    expect(container.textContent).toContain("Время");
    expect(container.querySelectorAll(".daily-orientation__card")).toHaveLength(7);

    const tomorrow = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Завтра");
    act(() => tomorrow.click());

    expect(container.textContent).toContain("СРЕДА");
    expect(container.querySelector(".daily-orientation__date-number")?.textContent).toBe("23");
    // Captions stay plain nominative labels regardless of offset — the carousel
    // pill is what shows which day is being looked at, not the card captions.
    expect(container.textContent).toContain("День недели");
    expect(container.textContent).toContain("Число");
    expect(container.textContent).toContain("Месяц");

    const timeCard = container.querySelector(".daily-orientation__card--time");
    expect(timeCard?.classList.contains("daily-orientation__card--time-hidden")).toBe(true);
    expect(timeCard?.getAttribute("aria-hidden")).toBe("true");

    const today = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent === "Сегодня");
    act(() => today.click());

    expect(timeCard?.classList.contains("daily-orientation__card--time-hidden")).toBe(false);
    expect(timeCard?.getAttribute("aria-hidden")).toBe("false");
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
      showAnalogClock: true,
      showTimeWords: false,
      showDigitalTime: false,
    });

    expect(container.querySelector(".daily-orientation__carousel")).toBeNull();
    expect(container.querySelectorAll(".daily-orientation__card")).toHaveLength(2);
    expect(container.textContent).toContain("СЕНТЯБРЬ");
    expect(container.textContent).toContain("Месяц");
    expect(container.textContent).not.toContain("Число");
    expect(container.textContent).toContain("Время");
    expect(container.querySelector(".daily-orientation__clock")).not.toBeNull();
    expect(container.querySelector(".daily-orientation__digital-time")).toBeNull();
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
      // 30 November: tomorrow is winter, so the season card still speaks on
      // Завтра (an unchanged season is dimmed and silent there).
      mountAt(new Date(2026, 10, 30, 14, 35), undefined, true);

      const seasonIcon = container.querySelector(".daily-orientation__card--season .daily-orientation__speaker-icon");
      act(() => seasonIcon.click());
      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][0].text).toBe("Сейчас осень.");

      const tomorrow = Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Завтра");
      act(() => tomorrow.click());
      act(() => { vi.advanceTimersByTime(3000); }); // clear the tap cooldown from the first speak

      act(() => seasonIcon.click());
      expect(speakSpy).toHaveBeenCalledTimes(2);
      expect(speakSpy.mock.calls[1][0].text).toBe("Завтра будет зима.");
    });

    it("speaks only the month on the Месяц card's icon", () => {
      stubSpeechSynthesis();
      mountAt(new Date(2026, 8, 22, 14, 35), undefined, true);

      const [, monthCard] = dateCards();
      act(() => monthCard.querySelector(".daily-orientation__speaker-icon").click());

      expect(speakSpy).toHaveBeenCalledTimes(1);
      expect(speakSpy.mock.calls[0][0].text).toBe("Сейчас сентябрь.");
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

    it("shows the whole week with full day names, today outlined, weekends marked and each day's plan", () => {
      mountAt(new Date(2026, 8, 22, 14, 35), {
        weeklyPlan: "Пн: Школа\nВт: Школа\nСр: Школа\nЧт: Школа\nПт: Школа\nСб: Поездка в парк",
      });

      act(() => container.querySelector(".daily-orientation__card--weekday").click());

      const days = Array.from(container.querySelectorAll(".dom-week__day"));
      expect(days.map((d) => d.querySelector(".dom-week__name").textContent)).toEqual([
        "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье",
      ]);
      // short forms only as a caption under the full name
      expect(days[0].querySelector(".dom-week__short").textContent).toBe("пн");

      const tuesday = days[1];
      expect(tuesday.classList.contains("dom-week__day--active")).toBe(true);
      expect(tuesday.querySelector(".dom-week__tag").textContent).toBe("сегодня");
      expect(days[0].querySelector(".dom-week__tag").textContent).toBe("вчера");
      expect(days[2].querySelector(".dom-week__tag").textContent).toBe("завтра");
      expect(tuesday.textContent).toContain("Школа");

      expect(days[5].classList.contains("dom-week__day--weekend")).toBe(true);
      expect(days[5].textContent).toContain("Поездка в парк");
      expect(days[6].classList.contains("dom-week__day--weekend")).toBe(true);
      expect(days[6].querySelector(".dom-week__plan")).toBeNull();
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
      const dialog = openFrom(".daily-orientation__card--narrow.daily-orientation__card--date");
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
      const dialog = openFrom(".daily-orientation__card--narrow.daily-orientation__card--date");
      expect(dialog.querySelector(".dom-title").textContent).toBe("Октябрь 2026");
      expect(dialog.querySelector(".dom-date-say__phrase").textContent).toBe("Завтра будет 1 октября");
    });

    it("Месяц: twelve months grouped by season (names only, no day counts)", () => {
      mountAt(new Date(2028, 1, 10, 10, 0)); // leap February
      const dialog = openFrom(".daily-orientation__card--wide.daily-orientation__card--date");
      const months = Array.from(dialog.querySelectorAll(".dom-months__month"));
      expect(months).toHaveLength(12);
      expect(months[0].textContent).toBe("Декабрь");
      const february = dialog.querySelector(".dom-months__month--active");
      expect(february.textContent).toBe("Февраль");
    });

    it("Время года: the four seasons as a cycle with the current one marked", () => {
      mountAt(new Date(2026, 8, 29, 10, 0));
      const dialog = openFrom(".daily-orientation__card--season");
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

    it("the speaker button speaks without opening the modal", () => {
      mountAt(new Date(2026, 8, 29, 10, 0), undefined, true);
      const speaker = container.querySelector(".daily-orientation__card--season .daily-orientation__speaker-icon");
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

  it("dims month and season on Вчера/Завтра when they haven't changed", () => {
    mountAt(new Date(2026, 9, 7, 9, 0));
    clickCarousel("Вчера");
    expect(container.querySelectorAll(".daily-orientation__card--unchanged")).toHaveLength(2);
    act(() => root.unmount());
    container.remove();
    mountAt(new Date(2026, 10, 30, 9, 0)); // tomorrow: December, winter
    clickCarousel("Завтра");
    expect(container.querySelectorAll(".daily-orientation__card--unchanged")).toHaveLength(0);
  });

  it("shows that day's plan, with its picture, on Вчера/Завтра", () => {
    mountAt(new Date(2026, 9, 7, 9, 0), { weeklyPlan: "Вт: 🏊 Бассейн\nЧт: Логопед" }); // a Wednesday
    clickCarousel("Вчера");
    const plan = container.querySelector(".daily-orientation__card--plan");
    expect(plan.textContent).toContain("Что было вчера");
    expect(plan.querySelector(".daily-orientation__plan-icon").textContent).toBe("🏊");
    expect(plan.textContent).toContain("БАССЕЙН");
    clickCarousel("Завтра");
    expect(container.querySelector(".daily-orientation__card--plan").textContent).toContain("Что будет завтра");
    clickCarousel("Сегодня");
    expect(container.querySelector(".daily-orientation__card--plan")).toBeNull();
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
