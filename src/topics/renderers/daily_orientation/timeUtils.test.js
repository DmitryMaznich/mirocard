import { describe, expect, it } from "vitest";
import { addCalendarDays, formatDigitalClock, formatRussianClockTime, getRelativePrompt, getSeason } from "./timeUtils";

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
});
