import { describe, expect, it } from "vitest";
import {
  collectPlanItems,
  firstEmoji,
  moveItem,
  parsePlanItems,
  planItemKey,
  serializePlanItems,
  setItemIconEverywhere,
  suggestEmoji,
} from "./weekPlan.js";

describe("weekly plan items", () => {
  it("reads a plan saved before parts of the day: one picture, the rest plain words, parts guessed by place", () => {
    expect(parsePlanItems("🏫 Школа, спорт, занимаемся")).toEqual([
      { icon: "🏫", text: "Школа", daypart: "morning" },
      { icon: null, text: "спорт", daypart: "evening" },
      { icon: null, text: "занимаемся", daypart: "night" },
    ]);
    expect(parsePlanItems("Школа, Спорт, Занимаемся, Душ, Спать").map((item) => item.daypart))
      .toEqual(["morning", "day", "evening", "evening", "night"]);
    expect(parsePlanItems("Спать, Прогулка").map((item) => [item.text, item.daypart]))
      .toEqual([["Прогулка", "evening"], ["Спать", "night"]]);
  });

  it("reads and writes each item's part of the day, keeping the one-line form", () => {
    const text = "🏫 Школа [утро], 👟 Спорт [день], 🛏️ Спать [ночь]";
    const items = parsePlanItems(text);
    expect(items.map((item) => [item.icon, item.daypart])).toEqual([["🏫", "morning"], ["👟", "day"], ["🛏️", "night"]]);
    expect(serializePlanItems(items)).toBe(text);
  });

  it("keeps the order of the day: by part, then as entered", () => {
    expect(serializePlanItems([
      { text: "Спать", daypart: "night" },
      { text: "Душ", daypart: "evening" },
      { text: "Школа", daypart: "morning" },
      { text: "Занимаемся", daypart: "evening" },
    ])).toBe("Школа [утро], Душ [вечер], Занимаемся [вечер], Спать [ночь]");
  });

  it("keeps a picture-only item and drops empty ones", () => {
    expect(parsePlanItems("🏊 [день], , Спать [ночь]")).toEqual([
      { icon: "🏊", text: "", daypart: "day" },
      { icon: null, text: "Спать", daypart: "night" },
    ]);
    expect(parsePlanItems("")).toEqual([]);
  });

  it("never lets a comma inside a word split it into two items", () => {
    const text = serializePlanItems([{ icon: null, text: "Кафе, потом домой", daypart: "day" }]);
    expect(parsePlanItems(text)).toEqual([{ icon: null, text: "Кафе потом домой", daypart: "day" }]);
  });

  it("collects the week's own items once, a picture found later filling a missing one", () => {
    const items = collectPlanItems({
      1: parsePlanItems("Школа [утро], спорт [день]"),
      2: parsePlanItems("🏫 школа [утро], 👟 Спорт [день]"),
    }, [1, 2]);
    expect(items).toEqual([{ icon: "🏫", text: "Школа", daypart: "morning" }, { icon: "👟", text: "спорт", daypart: "day" }]);
  });

  it("changes an item's picture in every day", () => {
    const next = setItemIconEverywhere({
      1: parsePlanItems("Спорт, Спать"),
      3: parsePlanItems("⚽ спорт"),
    }, planItemKey({ text: "Спорт" }), "👟");
    expect(next[1][0].icon).toBe("👟");
    expect(next[3][0].icon).toBe("👟");
    expect(next[1][1].icon).toBe(null);
  });

  it("moves an item and ignores a move past either end", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(items, 2, 1)).toBe(items);
  });

  it("suggests pictures by the start of a word, also while it is being typed", () => {
    expect(suggestEmoji("Бассейн")).toContain("🏊");
    expect(suggestEmoji("бас")).toContain("🏊");
    expect(suggestEmoji("идём в школу")).toContain("🏫");
    expect(suggestEmoji("ы")).toEqual([]);
    expect(suggestEmoji("кузнечик")).toEqual([]);
  });

  it("takes the first picture out of whatever was typed or pasted", () => {
    expect(firstEmoji("вот 🏊‍♂️ и 🏫")).toBe("🏊‍♂️");
    expect(firstEmoji("🛏️")).toBe("🛏️");
    expect(firstEmoji("слово")).toBe(null);
  });
});

describe("the whole week", () => {
  it("round-trips the stored «Пн: …» text, dropping an emptied day", async () => {
    const { parseWeekItems, serializeWeekItems } = await import("./weekPlan.js");
    const week = parseWeekItems("Пн: 🏫 Школа [утро], 👟 Спорт [день]\nСб: 🚶 Прогулка [день]");
    expect(week[1]).toHaveLength(2);
    expect(week[0]).toEqual([]);
    week[6] = [];
    expect(serializeWeekItems(week)).toBe("Пн: 🏫 Школа [утро], 👟 Спорт [день]");
  });
});

describe("plan photos", () => {
  it("keeps a photo only while its item is somewhere in the week", async () => {
    const { parsePlanPhotos, serializePlanPhotos, parseWeekItems } = await import("./weekPlan.js");
    const photos = parsePlanPhotos('{"спорт":"/api/photos/a","кафе":"/api/photos/b"}');
    const text = serializePlanPhotos(photos, parseWeekItems("Пн: 👟 Спорт"));
    expect(JSON.parse(text)).toEqual({ "спорт": "/api/photos/a" });
    expect(serializePlanPhotos(photos, parseWeekItems(""))).toBe("");
  });

  it("reads broken or foreign text as no photos", async () => {
    const { parsePlanPhotos } = await import("./weekPlan.js");
    expect(parsePlanPhotos("не json")).toEqual({});
    expect(parsePlanPhotos("[1]")).toEqual({});
    expect(parsePlanPhotos('{"a":5,"b":"/api/photos/x"}')).toEqual({ b: "/api/photos/x" });
  });
});

describe("the day's plan on the wall screen", () => {
  it("puts important dates and added items in their part of the day", async () => {
    const { buildDayPlan, parsePlanItems } = await import("./weekPlan.js");
    const items = buildDayPlan({
      templateItems: parsePlanItems("🏫 Школа [утро], 📚 Занимаемся [вечер], 🛏️ Спать [ночь]"),
      events: [{ id: "g", title: "Приезд бабушки", icon: "👵" }],
      changes: { added: [{ icon: "☕", text: "Кафе", daypart: "evening" }] },
    });
    expect(items.map((item) => [item.text, item.daypart])).toEqual([
      ["Школа", "morning"], ["Приезд бабушки", "day"], ["Занимаемся", "evening"], ["Кафе", "evening"], ["Спать", "night"],
    ]);
    expect(items[1]).toMatchObject({ key: "event:g", important: true });
  });

  it("crosses out a cancelled template item or date, but drops a cancelled added one; takes the item's photo", async () => {
    const { buildDayPlan, parsePlanItems } = await import("./weekPlan.js");
    const items = buildDayPlan({
      templateItems: parsePlanItems("🏫 Школа [утро], 👟 Спорт [день], 🛏️ Спать [ночь]"),
      events: [{ id: "g", title: "Гости", icon: "🏠", daypart: "evening" }],
      changes: { off: ["школа", "event:g", "кафе"], added: [{ text: "Кафе", daypart: "day" }] },
      photos: { "спорт": "/api/photos/s" },
    });
    expect(items.map((item) => [item.text, item.cancelled])).toEqual([
      ["Школа", true], ["Спорт", false], ["Гости", true], ["Спать", false],
    ]);
    expect(items[1].photo).toBe("/api/photos/s");
  });
});

describe("plan changes shared between devices", () => {
  it("merges two devices' documents day by day, the newer day winning, old days dropped", async () => {
    const { mergePlanDocs } = await import("./weekPlan.js");
    const wall = { days: { "2026-11-23": { off: ["школа"], added: [], updatedAt: 5 }, "2026-11-20": { off: ["x"], added: [], updatedAt: 1 } } };
    const phone = { days: { "2026-11-23": { off: [], added: [], updatedAt: 9 }, "2026-11-24": { off: ["спорт"], added: [], updatedAt: 3 } } };
    expect(mergePlanDocs(wall, phone, "2026-11-22")).toEqual({ days: {
      "2026-11-23": { off: [], added: [], updatedAt: 9 },
      "2026-11-24": { off: ["спорт"], added: [], updatedAt: 3 },
    } });
  });

  it("updates one day with a fresh time and reads junk as an empty document", async () => {
    const { normalizePlanDoc, updatePlanDoc } = await import("./weekPlan.js");
    const doc = updatePlanDoc(null, "2026-11-23", (day) => ({ ...day, off: ["школа"] }), 42);
    expect(doc).toEqual({ days: { "2026-11-23": { off: ["школа"], added: [], updatedAt: 42 } } });
    expect(normalizePlanDoc("мусор")).toEqual({ days: {} });
    expect(normalizePlanDoc({ days: { "вчера": {}, "2026-11-23": { off: [1, "a"] } } })).toEqual({ days: { "2026-11-23": { off: ["a"], added: [], updatedAt: 0 } } });
  });
});
