import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  formatDigitalClock,
  formatRussianClockTime,
  getRelativePrompt,
  getSeason,
  getSpokenDate,
  getSpokenSeason,
  getSpokenTime,
  getSpokenWeekday,
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

  it("changes the spoken prompt when the carousel moves", () => {
    expect(getRelativePrompt(-1, "day")).toBe("Какой вчера был день недели?");
    expect(getRelativePrompt(1, "season")).toBe("Какое завтра будет время года?");
    expect(getRelativePrompt(0, "date")).toBe("Какое сегодня число?");
    expect(getRelativePrompt(-1, "month")).toBe("Какой месяц был вчера?");
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

  it("speaks the season with correct gender agreement in the past tense", () => {
    expect(getSpokenSeason(new Date(2026, 8, 24), 0)).toBe("Сейчас осень.");
    expect(getSpokenSeason(new Date(2026, 6, 15), -1)).toBe("Вчера было лето.");
    expect(getSpokenSeason(new Date(2026, 11, 10), 1)).toBe("Завтра будет зима.");
  });

  it("speaks the current time as a full sentence", () => {
    expect(getSpokenTime(new Date(2026, 8, 22, 14, 35))).toBe("Сейчас четырнадцать часов тридцать пять минут.");
  });
});
