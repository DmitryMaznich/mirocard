import { describe, it, expect } from "vitest";
import JSZip from "jszip";
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
      "operation_action_from_sign",
      "operation_do_action",
      "operation_name_action",
      "operation_more_less",
      "operation_sign_from_action",
      "operation_build_expression",
      "operation_result",
      "operation_missing_sign",
    ]);
    expect(record.modes.map((m) => m.ui.title)).toEqual([
      "Знак ↔ действие",
      "Сделай действие",
      "Что сделали?",
      "Больше / меньше",
      "Действие → знак",
      "Собери пример",
      "Сколько стало?",
      "Вставь знак",
    ]);
    expect(record.modes.every((m) => m.params?.maxNumber)).toBe(true);
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

  it("refreshes a mode's param widget type to the current default, even if an older shape was persisted", async () => {
    // Simulates a device that installed identify_number back when numericBlocks was a
    // plain boolean checkbox — on the next load, the param definition must switch to
    // the current visual_boolean toggle instead of staying pinned to the old shape.
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
            numericBlocks: { type: "boolean", default: false, label: { ru: "Блоки с цифрами вместо кубиков" } },
          },
        },
      ],
      cards: [{ id: "identify_number", conceptId: "identify_number", renderer: "column_addition", params: { mode: "identify_number" } }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const identifyNumber = record.modes.find((m) => m.id === "identify_number");
    expect(identifyNumber.params.numericBlocks.type).toBe("visual_boolean");
    expect(identifyNumber.params.numericBlocks.offLabel.ru).toBe("Десятки");
  });

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
    expect(mode.params.showCompare.type).toBe("boolean");
    expect(mode.params.operation.section).toBe("Что решаем");
    expect(mode.params.showHelper.section).toBe("Отображение в занятии");
    expect(mode.params.operation.info.ru.text).toEqual(expect.any(String));
    expect(mode.params.operation.info.ru.tip).toEqual(expect.any(String));
  });

  it("refreshes the rest of column_addition's modes to the reference screen shape", async () => {
    // Same reference-screen rollout as column_arithmetic, applied to the topic's other
    // modes: column_copy/build_number/identify_number/regroup_ten hide the decorative
    // concept picker (only one relevant card exists among the topic's 88), fingers_show's
    // hint switches from an enum to a real boolean, and every param picks up (i) info text.
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
          id: "identify_number",
          type: "identify_number",
          evaluation: "instant",
          ui: { title: "Какое это число?", icon: "media/icons/place_value_identify.svg" },
          params: {
            maxOnes: { type: "number", min: 0, max: 9, default: 2, label: { ru: "Максимум единиц" } },
            showCounters: { type: "boolean", default: true, label: { ru: "Показывать счётчики" } },
            numericBlocks: { type: "visual_boolean", default: false, offLabel: { ru: "Десятки" }, label: { ru: "Блоки с цифрами вместо кубиков" } },
          },
        },
      ],
      cards: [
        { id: "column_copy", conceptId: "column_copy", renderer: "column_addition", params: { operation: "add" } },
        { id: "fshow_0", conceptId: "fshow_0", renderer: "column_addition", params: { mode: "fingers_show", n: 0 } },
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

    expect(byId.fingers_show.hideConceptPicker).toBeUndefined();
    expect(byId.fingers_show.params.hint.type).toBe("boolean");
    expect(byId.fingers_show.params.hint.info.ru.tip).toEqual(expect.any(String));

    expect(byId.identify_number.hideConceptPicker).toBe(true);
    expect(byId.identify_number.params.numericBlocks.label.ru).toBe("Блоки с цифрами");
    expect(byId.identify_number.params.numericBlocks.section).toBe("Отображение");
    expect(byId.identify_number.params.numericBlocks.info.ru.text).toEqual(expect.any(String));
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
