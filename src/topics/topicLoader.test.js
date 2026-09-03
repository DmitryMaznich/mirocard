import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { openDb, kv } from "@/core/db";
import {
  importTopic,
  getTopicRecord,
  listTopicRecords,
  deleteTopicRecord,
  TopicImportError,
} from "./topicLoader";

async function freshDb() {
  return openDb("test-" + Date.now() + Math.random());
}

async function makeObjectTopicZip({
  id = "test_clothes",
  version = "1.0.0",
  minAppVersion,
  cards,
  includeImage = true,
} = {}) {
  const zip = new JSZip();
  const defaultCards = [
    {
      id: "tshirt_1",
      conceptId: "tshirt",
      primary: true,
      label: "футболка",
      image: "media/tshirt_1.webp",
    },
  ];
  const manifest = {
    meta: { id, version, language: "ru", renderer: "flashcards", title: "Test Topic" },
    modes: [],
    cards: cards || defaultCards,
  };
  if (minAppVersion) manifest.meta.minAppVersion = minAppVersion;
  zip.file("topic.json", JSON.stringify(manifest));
  if (includeImage) {
    zip.file("media/tshirt_1.webp", "fake-image-data");
  }
  return zip.generateAsync({ type: "arraybuffer" });
}

async function makeProceduralTopicZip({ id = "math_houses", version = "1.0.0" } = {}) {
  const zip = new JSZip();
  const manifest = {
    meta: { id, version, language: "ru", renderer: "math_houses", title: "Math" },
    modes: [],
    cards: [
      {
        id: "house_5",
        conceptId: "house_5",
        primary: true,
        label: "Число 5",
        renderer: "math_houses",
        params: { number: 5 },
      },
    ],
  };
  zip.file("topic.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "arraybuffer" });
}

async function makeOperationTopicZip({ id = "addition_subtraction", version = "1.0.0" } = {}) {
  const zip = new JSZip();
  const manifest = {
    meta: { id, version, language: "ru", renderer: "addition_subtraction", cardType: "procedural", title: "Operations" },
    modes: [],
    cards: [
      {
        id: "operation_plus",
        conceptId: "plus",
        primary: true,
        label: "Плюс",
        renderer: "addition_subtraction",
        params: { operation: "add" },
      },
      {
        id: "operation_minus",
        conceptId: "minus",
        primary: true,
        label: "Минус",
        renderer: "addition_subtraction",
        params: { operation: "subtract" },
      },
    ],
  };
  zip.file("topic.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "arraybuffer" });
}

async function makeReadingTopicZip({ id = "reading_test", version = "1.0.0" } = {}) {
  const zip = new JSZip();
  const manifest = {
    meta: { id, version, language: "ru", renderer: "reading", title: "Reading" },
    modes: [],
    cards: [],
    texts: [
      {
        id: "dad_best",
        kind: "poem",
        title: "Папа наш",
        level: 1,
        lines: [
          { id: "l1", text: "Кто на свете лучше всех?" },
          { id: "l2", text: "Папа наш!" },
        ],
        questions: [
          { id: "q1", prompt: "О ком стих?", supportLineIds: ["l2"] },
        ],
      },
    ],
  };
  zip.file("topic.json", JSON.stringify(manifest));
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("importTopic — valid cases", () => {
  it("imports the shipped people-and-names deck end-to-end", async () => {
    const bytes = await readFile(resolve("public/decks/people_names_v1.1.0.zip"));
    const db = await freshDb();
    const record = await importTopic(db, bytes, "1.0.2046");

    expect(record.meta.id).toBe("people_names");
    expect(record.cards).toHaveLength(8);
    expect(record.cards.every((card) => card.imageUrl?.startsWith("data:image/webp;base64,"))).toBe(true);
    expect(record.modes.map((mode) => mode.type)).toEqual([
      "intro", "find_n", "sort_by_attribute", "person_intro", "find_person_by_name",
      "choose_name", "choose_all", "question_answer", "yes_no", "generalisation_probe",
    ]);

    const reloaded = await getTopicRecord(db, "people_names");
    expect(reloaded.modes.map((mode) => mode.id)).toEqual([
      "people_intro", "people_find_category", "people_sort_attribute", "people_person_intro",
      "people_find_person_by_name", "people_choose_name", "people_choose_all",
      "people_question_answer", "people_yes_no", "people_generalisation_probe",
    ]);
  });

  it("imports a valid object topic and returns a record", async () => {
    const db = await freshDb();
    const buf = await makeObjectTopicZip();
    const record = await importTopic(db, buf, "2.0.0");

    expect(record.meta.id).toBe("test_clothes");
    expect(record.meta.version).toBe("1.0.0");
    expect(record.meta.avatar).toBe("media/avatar_flashcards.svg");
    expect(record.cards).toHaveLength(1);
    expect(record.installedAt).toBeTruthy();
    expect(record.modes.every((mode) => mode.ui?.icon)).toBe(true);
  });

  it("imports a procedural topic (no image files)", async () => {
    const db = await freshDb();
    const buf = await makeProceduralTopicZip();
    const record = await importTopic(db, buf, "2.0.0");

    expect(record.meta.id).toBe("math_houses");
    expect(record.meta.avatar).toBe("media/avatar.svg");
    expect(record.cards[0].renderer).toBe("math_houses");
    expect(record.modes.map((m) => m.id)).toContain("math_houses_grow");
    expect(record.modes.every((m) => m.ui?.icon)).toBe(true);
  });

  it("imports addition/subtraction procedural cards with default modes", async () => {
    const db = await freshDb();
    const buf = await makeOperationTopicZip();
    const record = await importTopic(db, buf, "2.0.0");

    expect(record.meta.renderer).toBe("addition_subtraction");
    expect(record.meta.avatar).toBe("media/avatar_operations.svg");
    expect(record.modes.map((m) => m.id)).toEqual([
      "operation_observe",
      "operation_name_action",
      "operation_do_action",
      "operation_action_from_sign",
      "operation_find_sign",
      "operation_result",
      "operation_chain",
      "operation_worksheet",
      "operation_missing_term",
    ]);
    expect(record.modes.map((m) => m.ui.title)).toEqual([
      "1. Что изменилось?",
      "2. Назови действие (скоро)",
      "3. Сделай действие",
      "4. Знак ↔ Действие",
      "5. Найди знак",
      "6. Сколько стало?",
      "7. Цепочка",
      "8. Листок",
      "9. Найди неизвестное",
    ]);
    const observeMode = record.modes.find((mode) => mode.id === "operation_observe");
    expect(observeMode.params.maxNumber.default).toBe(3);
    expect(observeMode.params.showNumerals.default).toBe(false);
    expect(observeMode.params.shapeMode.default).toBe("circle");
  });

  it("imports a reading topic with texts and no cards", async () => {
    const db = await freshDb();
    const record = await importTopic(db, await makeReadingTopicZip(), "2.0.0");

    expect(record.meta.renderer).toBe("reading");
    expect(record.meta.avatar).toBe("media/avatar_reading.svg");
    expect(record.cards).toEqual([]);
    expect(record.texts).toHaveLength(1);
    expect(record.modes.map((m) => m.id)).toEqual(["read_text", "understand_text", "assemble_text", "follow_instruction", "safe_code", "read_poem_book"]);
  });

  it("accepts deck.json as fallback for v1 compatibility", async () => {
    const zip = new JSZip();
    const manifest = {
      meta: { id: "emotions_v1", version: "1.0.0", language: "ru", renderer: "flashcards", title: "Emotions" },
      modes: [],
      cards: [{ id: "happy_1", conceptId: "happy", primary: true, label: "радость", image: "media/happy.webp" }],
    };
    zip.file("deck.json", JSON.stringify(manifest));
    zip.file("media/happy.webp", "img");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const db = await freshDb();
    const record = await importTopic(db, buf, "2.0.0");
    expect(record.meta.id).toBe("emotions_v1");
  });

  it("meta.customModesOnly skips the default flashcards mode set on install", async () => {
    const zip = new JSZip();
    const manifest = {
      meta: { id: "test_custom_modes", version: "1.0.0", language: "ru", renderer: "flashcards", customModesOnly: true, title: "Custom" },
      modes: [{ id: "only_mode", type: "intro", evaluation: "auto", ui: { title: "Only mode" } }],
      cards: [{ id: "c1", conceptId: "c1", primary: true, label: "one" }],
    };
    zip.file("topic.json", JSON.stringify(manifest));
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    const db = await freshDb();
    const record = await importTopic(db, buf, "2.0.0");
    expect(record.modes.map((m) => m.id)).toEqual(["only_mode"]);
  });

  it("re-importing same topic replaces it", async () => {
    const db = await freshDb();
    const buf1 = await makeObjectTopicZip({ version: "1.0.0" });
    await importTopic(db, buf1, "2.0.0");

    const buf2 = await makeObjectTopicZip({ version: "1.1.0" });
    await importTopic(db, buf2, "2.0.0");

    const record = await getTopicRecord(db, "test_clothes");
    expect(record.meta.version).toBe("1.1.0");
    const all = await listTopicRecords(db);
    expect(all.filter((r) => r.meta.id === "test_clothes")).toHaveLength(1);
  });
});

describe("importTopic — validation errors", () => {
  it("throws TopicImportError when ZIP has no manifest", async () => {
    const db = await freshDb();
    const zip = new JSZip();
    zip.file("README.txt", "hello");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(importTopic(db, buf, "2.0.0")).rejects.toThrow(TopicImportError);
  });

  it("throws TopicImportError on invalid JSON", async () => {
    const db = await freshDb();
    const zip = new JSZip();
    zip.file("topic.json", "{invalid json");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(importTopic(db, buf, "2.0.0")).rejects.toThrow(TopicImportError);
  });

  it("throws TopicImportError when meta.id is missing", async () => {
    const db = await freshDb();
    const zip = new JSZip();
    zip.file("topic.json", JSON.stringify({ meta: { version: "1.0.0" }, modes: [], cards: [{ id: "c1" }] }));
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(importTopic(db, buf, "2.0.0")).rejects.toThrow(TopicImportError);
  });

  it("throws TopicImportError when cards is empty", async () => {
    const db = await freshDb();
    const zip = new JSZip();
    zip.file("topic.json", JSON.stringify({ meta: { id: "t1", version: "1.0.0" }, modes: [], cards: [] }));
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(importTopic(db, buf, "2.0.0")).rejects.toThrow(TopicImportError);
  });

  it("throws TopicImportError on duplicate card ids", async () => {
    const db = await freshDb();
    const buf = await makeObjectTopicZip({
      cards: [
        { id: "dup", conceptId: "a", primary: true, label: "a", image: "media/a.webp" },
        { id: "dup", conceptId: "b", primary: true, label: "b", image: "media/b.webp" },
      ],
      includeImage: false,
    });
    await expect(importTopic(db, buf, "2.0.0")).rejects.toThrow(TopicImportError);
  });

  it("throws TopicImportError when referenced image is missing in ZIP", async () => {
    const db = await freshDb();
    const buf = await makeObjectTopicZip({ includeImage: false });
    await expect(importTopic(db, buf, "2.0.0")).rejects.toThrow(TopicImportError);
  });

  it("throws TopicImportError when minAppVersion is newer than appVersion", async () => {
    const db = await freshDb();
    const buf = await makeObjectTopicZip({ minAppVersion: "3.0.0" });
    await expect(importTopic(db, buf, "2.0.0")).rejects.toThrow(TopicImportError);
  });

  it("allows import when appVersion satisfies minAppVersion", async () => {
    const db = await freshDb();
    const buf = await makeObjectTopicZip({ minAppVersion: "2.0.0" });
    await expect(importTopic(db, buf, "2.0.0")).resolves.not.toThrow();
  });
});

describe("getTopicRecord + listTopicRecords + deleteTopicRecord", () => {
  it("getTopicRecord returns null for unknown id", async () => {
    const db = await freshDb();
    expect(await getTopicRecord(db, "no_such_id")).toBeNull();
  });

  it("listTopicRecords returns empty array when nothing installed", async () => {
    const db = await freshDb();
    expect(await listTopicRecords(db)).toEqual([]);
  });

  it("listTopicRecords returns installed topic after import", async () => {
    const db = await freshDb();
    await importTopic(db, await makeObjectTopicZip(), "2.0.0");
    const all = await listTopicRecords(db);
    expect(all).toHaveLength(1);
    expect(all[0].meta.id).toBe("test_clothes");
  });

  it("deleteTopicRecord removes the topic and its assets", async () => {
    const db = await freshDb();
    await importTopic(db, await makeObjectTopicZip(), "2.0.0");
    await deleteTopicRecord(db, "test_clothes");
    expect(await getTopicRecord(db, "test_clothes")).toBeNull();
    expect(await listTopicRecords(db)).toHaveLength(0);
  });

  it("backfills avatars and mode icons for legacy records", async () => {
    const db = await freshDb();
    const legacyRecord = {
      id: "legacy_flashcards",
      meta: { id: "legacy_flashcards", version: "1.0.0", title: "Legacy topic" },
      modes: [{ id: "intro", type: "intro", evaluation: "none", ui: { title: "Знакомство" } }],
      cards: [{ id: "c1", label: "кошка", image: "media/cat.webp" }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:legacy_flashcards", legacyRecord);
    await kv.set(db, "installedTopicIds", ["legacy_flashcards"]);

    const record = await getTopicRecord(db, "legacy_flashcards");
    expect(record.meta.renderer).toBe("flashcards");
    expect(record.meta.avatar).toBe("media/avatar_flashcards.svg");
    expect(record.modes.every((mode) => mode.ui?.icon)).toBe(true);
  });

  it("meta.customModesOnly stays free of default flashcards modes on every re-read", async () => {
    // Confirms the migrateRecord path (every getTopicRecord/listTopicRecords call), not
    // just the one-time install path covered by the importTopic test above.
    const db = await freshDb();
    const record = {
      id: "custom_modes_topic",
      meta: { id: "custom_modes_topic", renderer: "flashcards", customModesOnly: true, version: "1.0.0", title: "Custom" },
      modes: [{ id: "only_mode", type: "intro", evaluation: "auto", ui: { title: "Only mode" } }],
      cards: [{ id: "c1", conceptId: "c1", primary: true, label: "one" }],
      installedAt: new Date().toISOString(),
    };
    await kv.set(db, "topic:custom_modes_topic", record);
    await kv.set(db, "installedTopicIds", ["custom_modes_topic"]);

    const loaded = await getTopicRecord(db, "custom_modes_topic");
    expect(loaded.modes.map((m) => m.id)).toEqual(["only_mode"]);
  });

  it("meta.customModesOnly retroactively strips default modes merged in before the flag existed", async () => {
    // Simulates a device that installed the topic before customModesOnly was added,
    // so its stored record still carries the generic find_n/yes_no/... set alongside
    // the topic's own mode — those must be stripped on read, not just kept out of
    // future installs.
    const db = await freshDb();
    const record = {
      id: "custom_modes_topic_legacy",
      meta: { id: "custom_modes_topic_legacy", renderer: "flashcards", customModesOnly: true, version: "1.0.0", title: "Custom" },
      modes: [
        { id: "intro", type: "intro", evaluation: "none", ui: { title: "Знакомство" } },
        { id: "find_n", type: "find_n", evaluation: "auto", ui: { title: "Найди картинку" } },
        { id: "yes_no", type: "yes_no", evaluation: "auto", ui: { title: "Да / Нет" } },
        { id: "choose_word_by_picture", type: "choose_word_by_picture", evaluation: "auto", ui: { title: "Выбери слово" } },
        { id: "choose_all", type: "choose_all", evaluation: "auto", ui: { title: "Выбери все" } },
        { id: "only_mode", type: "intro", evaluation: "auto", ui: { title: "Only mode" } },
      ],
      cards: [{ id: "c1", conceptId: "c1", primary: true, label: "one" }],
      installedAt: new Date().toISOString(),
    };
    await kv.set(db, "topic:custom_modes_topic_legacy", record);
    await kv.set(db, "installedTopicIds", ["custom_modes_topic_legacy"]);

    const loaded = await getTopicRecord(db, "custom_modes_topic_legacy");
    expect(loaded.modes.map((m) => m.id)).toEqual(["only_mode"]);
  });

  it("drops a mode param that no longer exists in the current default, keeping the new one", async () => {
    // Simulates a device that saved build_number's old "level" param before it was
    // renamed to "maxOnes" — on the next load, the stale key must not linger forever.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "build_number",
          type: "build_number",
          evaluation: "instant",
          ui: { title: "Собери число" },
          params: {
            level: { type: "enum", values: [1, 2, 3, 4, 5], default: 1, label: { ru: "Уровень" } },
          },
        },
      ],
      cards: [{ id: "build_number", conceptId: "build_number", renderer: "column_addition", params: { mode: "build_number" } }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const buildNumber = record.modes.find((m) => m.id === "build_number");
    expect(buildNumber.params).toHaveProperty("maxOnes");
    expect(buildNumber.params).not.toHaveProperty("level");
  });

  it("refreshes a mode's title/instruction/icon to the current default, even if older text was persisted", async () => {
    // Simulates a device that installed these modes back when build_number still used
    // the shared column_addition_mode.svg icon and regroup_ten's title had the wrong
    // "Размени" conjugation — on the next load, both must pick up the current text
    // instead of staying pinned to whatever was true the first time the record was
    // migrated.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "build_number",
          type: "build_number",
          evaluation: "instant",
          ui: { title: "Собери число", icon: "media/icons/column_addition_mode.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
          },
        },
        {
          id: "regroup_ten",
          type: "regroup_ten",
          evaluation: "instant",
          ui: { title: "Размени десяток", instruction: "Перетащи десяток в единицы", icon: "media/icons/column_addition_mode.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
          },
        },
      ],
      cards: [
        { id: "build_number", conceptId: "build_number", renderer: "column_addition", params: { mode: "build_number" } },
        { id: "regroup_ten", conceptId: "regroup_ten", renderer: "column_addition", params: { mode: "regroup_ten" } },
      ],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const buildNumber = record.modes.find((m) => m.id === "build_number");
    expect(buildNumber.ui.icon).toBe("media/icons/place_value_build.svg");

    const regroupTen = record.modes.find((m) => m.id === "regroup_ten");
    expect(regroupTen.ui.title).toBe("Разменяй десяток");
    expect(regroupTen.ui.icon).toBe("media/icons/place_value_regroup.svg");
  });

  // Widget-type migration (a param's `type` changing between what a stale
  // record persisted and the current default) is still covered — see
  // "refreshes column_arithmetic's params to the new reference shape" below,
  // which exercises showHelper/showCompare's enum → boolean change. The
  // dedicated boolean → visual_boolean example that used to live here
  // (identify_number's numericBlocks) no longer applies: visual_boolean isn't
  // used by any current default mode after the "drops ... numericBlocks"
  // tests below removed the only three params that had it.

  it("drops build_number's numericBlocks param now that only Десятки is offered", async () => {
    // build_number used to offer a "10" numeric-block visual alongside "Десятки" — the
    // choice is gone, so a device that saved the old param shape must have it dropped on
    // the next load, the same way a renamed/retired param is dropped elsewhere.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "build_number",
          type: "build_number",
          evaluation: "instant",
          ui: { title: "Собери число", icon: "media/icons/place_value_build.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
            maxTens: { type: "number", min: 1, max: 9, default: 3, label: { ru: "Максимум десятков" } },
            numericBlocks: { type: "visual_boolean", default: false, offLabel: { ru: "Десятки" }, label: { ru: "Блоки с цифрами вместо кубиков" } },
          },
        },
      ],
      cards: [{ id: "build_number", conceptId: "build_number", renderer: "column_addition", params: { mode: "build_number" } }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const buildNumber = record.modes.find((m) => m.id === "build_number");
    expect(buildNumber.params).not.toHaveProperty("numericBlocks");
    expect(buildNumber.params).toHaveProperty("maxOnes");
    expect(buildNumber.params).toHaveProperty("maxTens");
  });

  it("drops identify_number's and regroup_ten's numericBlocks param, same as build_number", async () => {
    // Same "10" vs "Десятки" choice build_number used to offer, removed for the
    // same reason — a stale device that saved the old param shape must have it
    // dropped on the next load.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "identify_number",
          type: "identify_number",
          evaluation: "instant",
          ui: { title: "Какое это число?", icon: "media/icons/place_value_identify.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
            showCounters: { type: "boolean", default: true, label: { ru: "Показывать счётчики" } },
            numericBlocks: { type: "visual_boolean", default: false, offLabel: { ru: "Десятки" }, label: { ru: "Блоки с цифрами" } },
          },
        },
        {
          id: "regroup_ten",
          type: "regroup_ten",
          evaluation: "instant",
          ui: { title: "Разменяй десяток", icon: "media/icons/place_value_regroup.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
            numericBlocks: { type: "visual_boolean", default: false, offLabel: { ru: "Десятки" }, label: { ru: "Блоки с цифрами" } },
          },
        },
      ],
      cards: [
        { id: "identify_number", conceptId: "identify_number", renderer: "column_addition", params: { mode: "identify_number" } },
        { id: "regroup_ten", conceptId: "regroup_ten", renderer: "column_addition", params: { mode: "regroup_ten" } },
      ],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const byId = Object.fromEntries(record.modes.map((m) => [m.id, m]));

    expect(byId.identify_number.params).not.toHaveProperty("numericBlocks");
    expect(byId.identify_number.params).toHaveProperty("maxOnes");
    // showCounters (identify_number's live tens/ones counter) was dropped on 2026-07-26
    // along with the manipulative/checklist redesign that removed the counter entirely.
    expect(byId.identify_number.params).not.toHaveProperty("showCounters");

    expect(byId.regroup_ten.params).not.toHaveProperty("numericBlocks");
    expect(byId.regroup_ten.params).toHaveProperty("maxOnes");
  });

  it("refreshes column_arithmetic's params to the new reference shape, even if an older shape was persisted", async () => {
    // Simulates a device that installed column_arithmetic back when showHelper/showCompare
    // were enum widgets and the mode had no section/info/hideConceptPicker/rewardDefaults —
    // on the next load, the mode must pick up the new reference-screen shape.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "column_arithmetic",
          type: "column_arithmetic",
          evaluation: "auto",
          ui: { title: "Столбик", instruction: "Перетащи цифры в нужные клетки", icon: "media/icons/column_addition_mode.svg" },
          params: {
            operation: { type: "enum", values: ["add", "subtract", "mixed"], labels: { ru: { add: "Только +", subtract: "Только −", mixed: "Микс" } }, default: "add", label: { ru: "Операция" } },
            carryMode: { type: "enum", values: ["none", "carry", "mixed"], labels: { ru: { none: "Без переноса / займа", carry: "С переносом / займом", mixed: "Микс" } }, default: "none", label: { ru: "Перенос / заём" } },
            digits: { type: "enum", values: [2, 3], labels: { ru: { "2": "2-значные", "3": "3-значные" } }, default: 2, label: { ru: "Разрядность" } },
            showHelper: { type: "enum", values: [false, true], labels: { ru: { "false": "Скрыт", "true": "Показывать" } }, default: false, label: { ru: "Помощник (палка)" } },
            showCompare: { type: "enum", values: [true, false], labels: { ru: { "true": "Показывать", "false": "Скрыт" } }, default: true, label: { ru: "Сравнение" } },
          },
        },
      ],
      cards: [
        { id: "col_add", conceptId: "col_add", renderer: "column_addition", params: { operation: "add" } },
        { id: "col_sub", conceptId: "col_sub", renderer: "column_addition", params: { operation: "subtract" } },
      ],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const mode = record.modes.find((m) => m.id === "column_arithmetic");

    expect(mode.hideConceptPicker).toBe(true);
    expect(mode.rewardDefaults).toEqual({ strictStars: false });
    expect(mode.params.showHelper.type).toBe("boolean");
    // showCompare was renamed to compareMode (2026-07-26) — the stale record above still
    // has the old key, but the refresh must drop it entirely and hand back the new one.
    expect(mode.params).not.toHaveProperty("showCompare");
    expect(mode.params.compareMode.type).toBe("enum");
    expect(mode.params.compareMode.values).toEqual(["onBorrow", "always", "off"]);
    expect(mode.params.operation.section).toBe("Что решаем");
    expect(mode.params.showHelper.section).toBe("Отображение в занятии");
    expect(mode.params.operation.info.ru.text).toEqual(expect.any(String));
    expect(mode.params.operation.info.ru.tip).toEqual(expect.any(String));
  });

  it("refreshes the rest of column_addition's modes to the reference screen shape", async () => {
    // Same reference-screen rollout as column_arithmetic, applied to the topic's other
    // modes: every mode in the topic hides the concept picker now (parents don't want
    // it as an option here at all — fingers_count's quick ≤5/>5 filter is a separate
    // standalone control, not gated by this), fingers_show's hint switches from an enum
    // to a real boolean, and every param picks up (i) info text.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "column_copy",
          type: "column_copy",
          evaluation: "none",
          ui: { title: "Перепиши", icon: "media/icons/column_copy_mode.svg" },
          params: {
            count: { type: "enum", values: [6, 8, 10], labels: { ru: { "6": "6", "8": "8", "10": "10" } }, default: 6, label: { ru: "Примеров на экране" } },
            operation: { type: "enum", values: ["add", "subtract", "mixed"], labels: { ru: { add: "Только +", subtract: "Только −", mixed: "Микс" } }, default: "add", label: { ru: "Операция" } },
          },
        },
        {
          id: "fingers_show",
          type: "fingers_show",
          evaluation: "none",
          ui: { title: "Покажи", icon: "media/icons/column_addition_mode.svg" },
          params: {
            hint: { type: "enum", values: [true, false], labels: { ru: { "true": "С руками (подсказка)", "false": "Только цифра" } }, default: true, label: { ru: "Подсказка" } },
          },
        },
        {
          id: "fingers_count",
          type: "fingers_count",
          evaluation: "instant",
          ui: { title: "Считаем на пальцах", icon: "media/icons/fingers_count_mode.svg" },
          params: {
            op: { type: "enum", values: ["add", "sub", "mixed"], labels: { ru: { add: "Сложение", sub: "Вычитание", mixed: "Микс" } }, default: "add", label: { ru: "Операция" } },
          },
        },
        {
          id: "identify_number",
          type: "identify_number",
          evaluation: "instant",
          ui: { title: "Какое это число?", icon: "media/icons/place_value_identify.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
          },
        },
      ],
      cards: [
        { id: "column_copy", conceptId: "column_copy", renderer: "column_addition", params: { operation: "add" } },
        { id: "fshow_0", conceptId: "fshow_0", renderer: "column_addition", params: { mode: "fingers_show", n: 0 } },
        { id: "fcount_a_1_1", conceptId: "fcount_a_1_1", renderer: "column_addition", params: { mode: "fingers_count", op: "add", a: 1, b: 1 } },
        { id: "identify_number", conceptId: "identify_number", renderer: "column_addition", params: { mode: "identify_number" } },
      ],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const byId = Object.fromEntries(record.modes.map((m) => [m.id, m]));

    expect(byId.column_copy.hideConceptPicker).toBe(true);
    expect(byId.column_copy.params.operation.section).toBe("Что решаем");
    expect(byId.column_copy.params.operation.info.ru.text).toEqual(expect.any(String));

    expect(byId.fingers_show.hideConceptPicker).toBe(true);
    expect(byId.fingers_show.params.hint.type).toBe("boolean");
    expect(byId.fingers_show.params.hint.info.ru.tip).toEqual(expect.any(String));

    expect(byId.fingers_count.hideConceptPicker).toBe(true);

    expect(byId.identify_number.hideConceptPicker).toBe(true);
    expect(byId.identify_number.params.maxOnes.info.ru.text).toEqual(expect.any(String));
  });

  it("reorders an already-installed column_addition record's modes to the current pedagogical sequence", async () => {
    // column_addition never had meta.cardType === "procedural" set (verified against the
    // shipped topic.json), so a stale record's modes used to stay pinned to whatever order
    // was persisted at install time, ignoring DEFAULT_MODES reorders — mode config here is
    // entirely code-owned (no manifest defines its own modes array), so the persisted order
    // is never a real customization worth preserving.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      // Old order: column_arithmetic first, column_copy second — the pre-reorder shape.
      modes: [
        { id: "column_arithmetic", type: "column_arithmetic", evaluation: "auto", ui: { title: "Столбик", icon: "media/icons/column_addition_mode.svg" }, params: {} },
        { id: "column_copy", type: "column_copy", evaluation: "none", ui: { title: "Перепиши", icon: "media/icons/column_copy_mode.svg" }, params: {} },
        { id: "fingers_show", type: "fingers_show", evaluation: "none", ui: { title: "Покажи", icon: "media/icons/column_addition_mode.svg" }, params: {} },
        { id: "fingers_count", type: "fingers_count", evaluation: "instant", ui: { title: "Считаем на пальцах", icon: "media/icons/fingers_count_mode.svg" }, params: {} },
        { id: "build_number", type: "build_number", evaluation: "instant", ui: { title: "Собери число", icon: "media/icons/place_value_build.svg" }, params: {} },
        { id: "identify_number", type: "identify_number", evaluation: "instant", ui: { title: "Какое это число?", icon: "media/icons/place_value_identify.svg" }, params: {} },
        { id: "regroup_ten", type: "regroup_ten", evaluation: "instant", ui: { title: "Разменяй десяток", icon: "media/icons/place_value_regroup.svg" }, params: {} },
      ],
      cards: [
        { id: "col_add", conceptId: "col_add", renderer: "column_addition", params: { operation: "add" } },
        { id: "col_sub", conceptId: "col_sub", renderer: "column_addition", params: { operation: "subtract" } },
      ],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    expect(record.modes.map((m) => m.id)).toEqual([
      "fingers_show",
      "fingers_count",
      "build_number",
      "identify_number",
      "regroup_ten",
      "column_arithmetic",
      "column_copy",
    ]);

    const arithmetic = record.modes.find((m) => m.id === "column_arithmetic");
    expect(arithmetic.ui.title).toBe("Столбик — Тренажёр");
    const copy = record.modes.find((m) => m.id === "column_copy");
    expect(copy.ui.title).toBe("Контрольная работа");
  });

  it("adds the new maxTens param to a build_number record saved before it existed", async () => {
    // Simulates a device that installed build_number before maxTens/the coin
    // mechanic existed — on the next load, the new range param and the updated
    // instruction copy must both appear.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "build_number",
          type: "build_number",
          evaluation: "instant",
          ui: { title: "Собери число", instruction: "Перетащи десятки и единицы на свои места", icon: "media/icons/place_value_build.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
            numericBlocks: { type: "visual_boolean", default: false, offLabel: { ru: "Десятки" }, label: { ru: "Блоки с цифрами вместо кубиков" } },
          },
        },
      ],
      cards: [{ id: "build_number", conceptId: "build_number", renderer: "column_addition", params: { mode: "build_number" } }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const buildNumber = record.modes.find((m) => m.id === "build_number");
    expect(buildNumber.params.maxTens).toMatchObject({
      type: "number", min: 1, max: 9, default: 3, label: { ru: "Максимум десятков" },
    });
    expect(buildNumber.ui.instruction).toBe("Перетаскивай монетки, пока не наберёшь число");
  });

  it("refreshes a mode's methodology tips to the current default, even if older tips were persisted", async () => {
    // Simulates a device that installed regroup_ten back when its tips still mentioned
    // the "Число изменилось?" question that has since been removed — on the next load,
    // the tips must reflect the current copy instead of staying pinned to the old text.
    const db = await freshDb();
    const staleRecord = {
      id: "column_addition",
      meta: { id: "column_addition", renderer: "column_addition", version: "1.3.0", title: { ru: "Сложение и вычитание в столбик" } },
      modes: [
        {
          id: "regroup_ten",
          type: "regroup_ten",
          evaluation: "instant",
          ui: { title: "Разменяй десяток", instruction: "Перетащи десяток в единицы", icon: "media/icons/place_value_regroup.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
          },
          methodology: {
            text: "старый текст с вопросом «Число изменилось?»",
            tips: ["Если ребёнок отвечает «Да» (число изменилось) — не поясняйте, просто дайте попробовать ещё раз."],
          },
        },
      ],
      cards: [{ id: "regroup_ten", conceptId: "regroup_ten", renderer: "column_addition", params: { mode: "regroup_ten" } }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const regroupTen = record.modes.find((m) => m.id === "regroup_ten");
    expect(regroupTen.methodology.text).not.toContain("Число изменилось");
    expect(regroupTen.methodology.tips.some((t) => t.includes("Число изменилось"))).toBe(false);
  });
});

describe("comparison mode migration", () => {
  // compare_first_number and compare_put_sign used to be merged into
  // compare_evaluate, and migrateRecord stripped both out of any stored
  // record that also had compare_evaluate — a blanket rule that ran on
  // every load, not just once for stale pre-merge records. As of v2.11.0,
  // compare_first_number is its own mode again (topic.json legitimately
  // ships both compare_evaluate and compare_first_number side by side), so
  // that same blanket rule would silently delete mode 5 from every
  // installed record on every single load. compare_put_sign stays merged.
  it("keeps compare_first_number alongside compare_evaluate instead of stripping it", async () => {
    const db = await freshDb();
    const record = {
      id: "comparison",
      meta: { id: "comparison", renderer: "comparison", version: "2.11.0", title: { ru: "Сравнение" } },
      modes: [
        { id: "compare_visual",       type: "compare_visual",       evaluation: "auto", ui: { title: "1. Сравни и нажми. Без знака" } },
        { id: "compare_sign",         type: "compare_sign",         evaluation: "auto", ui: { title: "2. Вводим знак — Крокодил" } },
        { id: "compare_draw_sign",    type: "compare_draw_sign",    evaluation: "auto", ui: { title: "3. Нарисуй знак" } },
        { id: "compare_evaluate",     type: "compare_evaluate",     evaluation: "auto", ui: { title: "4. Сравни и поставь знак" } },
        { id: "compare_first_number", type: "compare_first_number", evaluation: "auto", ui: { title: "5. Сравни первое число" } },
        { id: "compare_test",         type: "compare_evaluate",     evaluation: "auto", ui: { title: "6. Контрольная работа" } },
      ],
      cards: [{ id: "compare_hard", conceptId: "compare_hard", primary: true, label: "Ступень 3–6" }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:comparison", record);
    await kv.set(db, "installedTopicIds", ["comparison"]);

    const loaded = await getTopicRecord(db, "comparison");
    const ids = loaded.modes.map((m) => m.id);
    expect(ids).toContain("compare_first_number");
    expect(ids).toContain("compare_test");
  });

  it("still strips the fully-merged compare_put_sign when compare_evaluate is present", async () => {
    const db = await freshDb();
    const record = {
      id: "comparison",
      meta: { id: "comparison", renderer: "comparison", version: "2.9.0", title: { ru: "Сравнение" } },
      modes: [
        { id: "compare_evaluate", type: "compare_evaluate", evaluation: "auto", ui: { title: "4. Сравни и поставь знак" } },
        { id: "compare_put_sign", type: "compare_put_sign", evaluation: "auto", ui: { title: "Поставь знак" } },
      ],
      cards: [{ id: "compare_hard", conceptId: "compare_hard", primary: true, label: "Ступень 3–6" }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:comparison", record);
    await kv.set(db, "installedTopicIds", ["comparison"]);

    const loaded = await getTopicRecord(db, "comparison");
    expect(loaded.modes.map((m) => m.id)).not.toContain("compare_put_sign");
  });
});

// ─── chat_practice ────────────────────────────────────────────────────────────

async function makeChatPracticeZip({ id = "morning_greeting", version = "1.0.0" } = {}) {
  const zip = new JSZip();
  const manifest = {
    meta: { id, version, language: "ru", renderer: "chat_practice", title: "Утреннее приветствие" },
    contact: { name: "Мама", avatar: "mom.png", color: "#25d366" },
    turns: [
      {
        id: "t1",
        from: "contact",
        text: "Привет!",
        anyIsCorrect: true,
        choices: [{ text: "Привет!" }],
        reactionOnSend: "Мама: Отлично!",
      },
    ],
  };
  zip.file("topic.json", JSON.stringify(manifest));
  zip.file("mom.png", "fake-png-data");
  return zip.generateAsync({ type: "arraybuffer" });
}

describe("importTopic — chat_practice", () => {
  it("imports a chat_practice zip without errors", async () => {
    const db = await freshDb();
    const buf = await makeChatPracticeZip();
    const record = await importTopic(db, buf);
    expect(record.meta.renderer).toBe("chat_practice");
    expect(record.turns).toHaveLength(1);
    expect(record.contact.name).toBe("Мама");
  });

  it("throws when turns array is missing", async () => {
    const db = await freshDb();
    const zip = new JSZip();
    zip.file("topic.json", JSON.stringify({
      meta: { id: "bad", version: "1.0.0", renderer: "chat_practice", title: "Bad" },
    }));
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(importTopic(db, buf)).rejects.toBeInstanceOf(TopicImportError);
  });

  it("throws when turns array is empty", async () => {
    const db = await freshDb();
    const zip = new JSZip();
    zip.file("topic.json", JSON.stringify({
      meta: { id: "bad2", version: "1.0.0", renderer: "chat_practice", title: "Bad2" },
      turns: [],
    }));
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(importTopic(db, buf)).rejects.toBeInstanceOf(TopicImportError);
  });
});
