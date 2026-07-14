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

  it("refreshes a mode's icon to the current default, even if an older icon was persisted", async () => {
    // Simulates a device that installed build_number back when it still used the
    // shared column_addition_mode.svg icon — on the next load, it must pick up the
    // mode-specific icon instead of staying pinned to the old shared one forever.
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
      ],
      cards: [{ id: "build_number", conceptId: "build_number", renderer: "column_addition", params: { mode: "build_number" } }],
      installedAt: new Date().toISOString(),
    };

    await kv.set(db, "topic:column_addition", staleRecord);
    await kv.set(db, "installedTopicIds", ["column_addition"]);

    const record = await getTopicRecord(db, "column_addition");
    const buildNumber = record.modes.find((m) => m.id === "build_number");
    expect(buildNumber.ui.icon).toBe("media/icons/place_value_build.svg");
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
