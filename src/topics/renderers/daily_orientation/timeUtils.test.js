import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  formatDigitalClock,
  formatRussianClockTime,
  getClockWordParts,
  getDaypartId,
  getSpokenDaypart,
  getLocalDateKey,
  getSeason,
  getSpokenDate,
  getSpokenMonth,
  getSpokenSeason,
  getSpokenTime,
  getSpokenWeekday,
  parseWeeklyPlan,
} from "./timeUtils";

describe("daily orientation time helpers", () => {
  it("keeps yesterday and tomorrow on neighbouring calendar days", () => {
    const today = new Date(2026, 8, 22, 9, 0);
    expect(addCalendarDays(today, -1).getDate()).toBe(21);
    expect(addCalendarDays(today, 1).getDate()).toBe(23);
  });

  it("maps months to meteorological seasons", () => {
    expect(getSeason(8)).toEqual({ id: "autumn", label: "ОСЕНЬ" });
    expect(getSeason(11)).toEqual({ id: "winter", label: "ЗИМА" });
  });

  it("uses one consistent 24-hour verbal and digital time", () => {
    const afternoon = new Date(2026, 8, 22, 14, 35);
    expect(formatDigitalClock(afternoon)).toBe("14:35");
    expect(formatRussianClockTime(afternoon)).toBe("ЧЕТЫРНАДЦАТЬ ЧАСОВ ТРИДЦАТЬ ПЯТЬ МИНУТ");
  });

  it("splits the words into an hour half and a minute half, saying \"ровно\" on the hour", () => {
    expect(getClockWordParts(new Date(2026, 8, 22, 21, 1))).toEqual({ hour: "двадцать один час", minute: "одна минута" });
    expect(getClockWordParts(new Date(2026, 8, 22, 10, 0))).toEqual({ hour: "десять часов", minute: "ровно" });
    expect(getSpokenTime(new Date(2026, 8, 22, 10, 0))).toBe("Сейчас десять часов ровно.");
  });

  it("speaks the weekday as a full sentence with correct gender agreement in the past tense", () => {
    expect(getSpokenWeekday(new Date(2026, 8, 22), 0)).toBe("Сегодня вторник.");
    expect(getSpokenWeekday(new Date(2026, 8, 23), -1)).toBe("Вчера была среда.");
    expect(getSpokenWeekday(new Date(2026, 8, 27), -1)).toBe("Вчера было воскресенье.");
    expect(getSpokenWeekday(new Date(2026, 8, 23), 1)).toBe("Завтра будет среда.");
  });

  it("speaks the date as an ordinal with the month in genitive case", () => {
    expect(getSpokenDate(new Date(2026, 8, 24), 0)).toBe("Сегодня двадцать четвёртое сентября.");
    expect(getSpokenDate(new Date(2026, 0, 1), 0)).toBe("Сегодня первое января.");
    expect(getSpokenDate(new Date(2026, 8, 24), -1)).toBe("Вчера было двадцать четвёртое сентября.");
    expect(getSpokenDate(new Date(2026, 8, 24), 1)).toBe("Завтра будет двадцать четвёртое сентября.");
  });

  it("speaks the month on its own, as a name (all Russian month names are masculine, so no gender table is needed)", () => {
    expect(getSpokenMonth(new Date(2026, 8, 24), 0)).toBe("Сейчас сентябрь.");
    expect(getSpokenMonth(new Date(2026, 8, 24), -1)).toBe("Вчера был сентябрь.");
    expect(getSpokenMonth(new Date(2026, 8, 24), 1)).toBe("Завтра будет сентябрь.");
  });

  it("speaks the season with correct gender agreement in the past tense", () => {
    expect(getSpokenSeason(new Date(2026, 8, 24), 0)).toBe("Сейчас осень.");
    expect(getSpokenSeason(new Date(2026, 6, 15), -1)).toBe("Вчера было лето.");
    expect(getSpokenSeason(new Date(2026, 11, 10), 1)).toBe("Завтра будет зима.");
  });

  it("speaks the current time as a full sentence", () => {
    expect(getSpokenTime(new Date(2026, 8, 22, 14, 35))).toBe("Сейчас четырнадцать часов тридцать пять минут.");
  });

  it("parses a weekly plan text into a map keyed by day-of-week index, skipping empty or unrecognized lines", () => {
    const text = [
      "Пн: Школа",
      "вт:Школа",
      "Ср: Школа",
      "Чт: Школа",
      "Пт: Школа",
      "Сб: Поездка в парк",
      "Вс: ",
      "просто текст без дня",
    ].join("\n");

    expect(parseWeeklyPlan(text)).toEqual({
      1: "Школа",
      2: "Школа",
      3: "Школа",
      4: "Школа",
      5: "Школа",
      6: "Поездка в парк",
    });
  });

  it("returns an empty plan for empty or whitespace-only text", () => {
    expect(parseWeeklyPlan("")).toEqual({});
    expect(parseWeeklyPlan("   \n  \n")).toEqual({});
    expect(parseWeeklyPlan(undefined)).toEqual({});
  });

  it("formats a local calendar-day key that does not depend on time-of-day or timezone shifting", () => {
    expect(getLocalDateKey(new Date(2026, 8, 5, 23, 59))).toBe("2026-09-05");
    expect(getLocalDateKey(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
  });

  it("splits the day by the child's wake/bed hours at the edges and noon/18:00 in the middle", () => {
    const at = (h, m = 0) => new Date(2026, 8, 25, h, m);
    expect(getDaypartId(at(6, 59))).toBe("night");
    expect(getDaypartId(at(7, 0))).toBe("morning");
    expect(getDaypartId(at(11, 59))).toBe("morning");
    expect(getDaypartId(at(12, 0))).toBe("day");
    expect(getDaypartId(at(17, 59))).toBe("day");
    expect(getDaypartId(at(18, 0))).toBe("evening");
    expect(getDaypartId(at(20, 59))).toBe("evening");
    expect(getDaypartId(at(21, 0))).toBe("night");
    expect(getDaypartId(at(0, 30))).toBe("night");
    expect(getDaypartId(at(6, 30), 6, 22)).toBe("morning");
    expect(getDaypartId(at(21, 30), 6, 22)).toBe("evening");
    expect(getSpokenDaypart("evening")).toBe("Сейчас вечер.");
  });
});
