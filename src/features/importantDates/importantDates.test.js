import { describe, expect, it } from "vitest";
import {
  agePhrase,
  countdownPhrase,
  dayPhrase,
  daysUntil,
  eventsOnDate,
  genitivePhrase,
  isOnDate,
  nearestCountdown,
  normaliseImportantDate,
  sortByNextOccurrence,
  suggestBirthdayTitle,
  visibleImportantDates,
} from "./importantDates.js";

const card = (patch) => normaliseImportantDate({ id: patch.id ?? "x", title: "Тест", ...patch });
const oct7 = new Date(2026, 9, 7, 9, 20);

describe("occurrences", () => {
  it("matches a yearly date in any year", () => {
    const mom = card({ type: "birthday", title: "День рождения мамы", day: 7, month: 10, year: 1990 });
    expect(isOnDate(mom, oct7)).toBe(true);
    expect(isOnDate(mom, new Date(2030, 9, 7))).toBe(true);
    expect(isOnDate(mom, new Date(2026, 9, 8))).toBe(false);
  });

  it("matches a one-off event only in its own year", () => {
    const school = card({ type: "event", day: 7, month: 10, year: 2026, repeat: "once" });
    expect(isOnDate(school, oct7)).toBe(true);
    expect(isOnDate(school, new Date(2027, 9, 7))).toBe(false);
  });

  it("celebrates a 29 February birthday on 28 February in other years", () => {
    const leap = card({ type: "birthday", day: 29, month: 2 });
    expect(isOnDate(leap, new Date(2027, 1, 28))).toBe(true);
    expect(isOnDate(leap, new Date(2028, 1, 29))).toBe(true);
    expect(isOnDate(leap, new Date(2028, 1, 28))).toBe(false);
  });

  it("counts days to the next occurrence, wrapping into next year", () => {
    expect(daysUntil(card({ day: 7, month: 10 }), oct7)).toBe(0);
    expect(daysUntil(card({ day: 10, month: 10 }), oct7)).toBe(3);
    expect(daysUntil(card({ day: 6, month: 10 }), oct7)).toBe(364);
    expect(daysUntil(card({ day: 6, month: 10, year: 2026, repeat: "once" }), oct7)).toBeNull();
  });

  it("sorts upcoming first and passed one-offs last", () => {
    const list = [
      card({ id: "passed", day: 1, month: 1, year: 2026, repeat: "once" }),
      card({ id: "far", day: 1, month: 3 }),
      card({ id: "soon", day: 9, month: 10 }),
    ];
    expect(sortByNextOccurrence(list, oct7).map((item) => item.id)).toEqual(["soon", "far", "passed"]);
  });
});

describe("visibility and countdown", () => {
  it("hides deleted, switched-off, untitled and year-less one-offs", () => {
    const list = visibleImportantDates([
      { id: "a", title: "Ок", day: 1, month: 1 },
      { id: "b", title: "Удалена", day: 1, month: 1, deletedAt: "2026-01-01" },
      { id: "c", title: "Выключена", day: 1, month: 1, enabled: false },
      { id: "d", title: "", day: 1, month: 1 },
      { id: "e", title: "Без года", day: 1, month: 1, repeat: "once" },
    ]);
    expect(list.map((item) => item.id)).toEqual(["a"]);
  });

  it("picks the nearest card inside its own countdown window", () => {
    const list = [
      card({ id: "mom", day: 10, month: 10, countdownDays: 7 }),
      card({ id: "dad", day: 9, month: 10, countdownDays: 0 }),
      card({ id: "far", day: 30, month: 10, countdownDays: 14 }),
    ];
    expect(nearestCountdown(list, oct7)).toMatchObject({ daysLeft: 3, item: { id: "mom" } });
    // On the day itself the festive look takes over, not the countdown.
    expect(nearestCountdown([card({ day: 7, month: 10 })], oct7)).toBeNull();
  });

  it("finds every card on a date", () => {
    const list = [card({ id: "a", day: 7, month: 10 }), card({ id: "b", day: 7, month: 10 }), card({ id: "c", day: 8, month: 10 })];
    expect(eventsOnDate(list, oct7).map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("phrases", () => {
  it("says the day phrase without needing gender agreement", () => {
    expect(dayPhrase(card({ type: "birthday", title: "День рождения мамы" }))).toBe("Сегодня день рождения мамы!");
    expect(dayPhrase(card({ type: "event", title: "Идём в новую школу" }), 1)).toBe("Завтра идём в новую школу!");
    expect(dayPhrase(card({ type: "holiday", title: "Новый год" }))).toBe("Сегодня Новый год!");
    expect(dayPhrase(card({ type: "own_birthday" }))).toBe("Сегодня мой день рождения!");
  });

  it("gives the child's age in the first person", () => {
    expect(agePhrase(card({ type: "own_birthday", year: 2018 }), oct7)).toBe("Мне 8 лет.");
    expect(agePhrase(card({ type: "own_birthday", year: 2025 }), oct7)).toBe("Мне 1 год.");
    expect(agePhrase(card({ type: "own_birthday" }), oct7)).toBeNull();
  });

  it("phrases the countdown", () => {
    expect(countdownPhrase(card({ title: "День рождения мамы" }), 3)).toEqual({ title: "День рождения мамы", when: "через 3 дня" });
    expect(countdownPhrase(card({ title: "Поездка" }), 5)).toEqual({ title: "Поездка", when: "через 5 дней" });
    expect(countdownPhrase(card({ title: "Поездка" }), 1).when).toBe("завтра!");
  });

  it("suggests a genitive birthday title from a relation", () => {
    expect(genitivePhrase("мама")).toBe("мамы");
    expect(genitivePhrase("бабушка Галя")).toBe("бабушки Гали");
    expect(genitivePhrase("брат")).toBe("брата");
    expect(genitivePhrase("дедушка")).toBe("дедушки");
    expect(suggestBirthdayTitle({ relation: "папа" })).toBe("День рождения папы");
  });
});
