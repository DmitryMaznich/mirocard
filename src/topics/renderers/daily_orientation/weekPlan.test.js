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
  it("reads a plan saved before the list editor: one picture, the rest plain words", () => {
    expect(parsePlanItems("🏫 Школа, спорт, занимаемся")).toEqual([
      { icon: "🏫", text: "Школа" },
      { icon: null, text: "спорт" },
      { icon: null, text: "занимаемся" },
    ]);
  });

  it("reads and writes items with their own pictures, keeping the one-line form", () => {
    const text = "🏫 Школа, 👟 Спорт, 🛏️ Спать";
    const items = parsePlanItems(text);
    expect(items.map((item) => item.icon)).toEqual(["🏫", "👟", "🛏️"]);
    expect(serializePlanItems(items)).toBe(text);
  });

  it("keeps a picture-only item and drops empty ones", () => {
    expect(parsePlanItems("🏊, , Спать")).toEqual([{ icon: "🏊", text: "" }, { icon: null, text: "Спать" }]);
    expect(parsePlanItems("")).toEqual([]);
  });

  it("never lets a comma inside a word split it into two items", () => {
    const text = serializePlanItems([{ icon: null, text: "Кафе, потом домой" }]);
    expect(parsePlanItems(text)).toEqual([{ icon: null, text: "Кафе потом домой" }]);
  });

  it("collects the week's own items once, a picture found later filling a missing one", () => {
    const items = collectPlanItems({
      1: parsePlanItems("Школа, спорт"),
      2: parsePlanItems("🏫 школа, 👟 Спорт"),
    }, [1, 2]);
    expect(items).toEqual([{ icon: "🏫", text: "Школа" }, { icon: "👟", text: "спорт" }]);
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
    const week = parseWeekItems("Пн: 🏫 Школа, 👟 Спорт\nСб: 🚶 Прогулка");
    expect(week[1]).toHaveLength(2);
    expect(week[0]).toEqual([]);
    week[6] = [];
    expect(serializeWeekItems(week)).toBe("Пн: 🏫 Школа, 👟 Спорт");
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
  it("puts the day's important date and added items before its last item", async () => {
    const { buildDayPlan, parsePlanItems } = await import("./weekPlan.js");
    const items = buildDayPlan({
      templateItems: parsePlanItems("🏫 Школа, 📚 Занимаемся, 🛏️ Спать"),
      events: [{ id: "g", title: "Приезд бабушки", icon: "👵" }],
      changes: { added: [{ icon: "☕", text: "Кафе" }] },
    });
    expect(items.map((item) => item.text)).toEqual(["Школа", "Занимаемся", "Приезд бабушки", "Кафе", "Спать"]);
    expect(items[2]).toMatchObject({ key: "event:g", important: true });
  });

  it("crosses out a cancelled template item or date, but drops a cancelled added one", async () => {
    const { buildDayPlan, parsePlanItems, planFocusIndex } = await import("./weekPlan.js");
    const items = buildDayPlan({
      templateItems: parsePlanItems("🏫 Школа, 👟 Спорт, 🛏️ Спать"),
      events: [{ id: "g", title: "Гости", icon: "🏠" }],
      changes: { off: ["школа", "event:g", "кафе"], added: [{ text: "Кафе" }], done: [] },
    });
    expect(items.map((item) => [item.text, item.cancelled])).toEqual([
      ["Школа", true], ["Спорт", false], ["Гости", true], ["Спать", false],
    ]);
    expect(planFocusIndex(items)).toBe(1);
  });

  it("moves the focus past what the child marked done, and takes the item's photo", async () => {
    const { buildDayPlan, parsePlanItems, planFocusIndex } = await import("./weekPlan.js");
    const items = buildDayPlan({
      templateItems: parsePlanItems("🏫 Школа, 👟 Спорт"),
      changes: { done: ["школа"] },
      photos: { "спорт": "/api/photos/s" },
    });
    expect(planFocusIndex(items)).toBe(1);
    expect(items[1].photo).toBe("/api/photos/s");
    expect(planFocusIndex(buildDayPlan({ templateItems: parsePlanItems("Школа"), changes: { done: ["школа"] } }))).toBe(-1);
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
