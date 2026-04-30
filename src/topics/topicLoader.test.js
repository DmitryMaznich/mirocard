import { describe, it, expect, beforeEach } from "vitest";
import JSZip from "jszip";
import { openDb } from "@/core/db";
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

describe("importTopic — valid cases", () => {
  it("imports a valid object topic and returns a record", async () => {
    const db = await freshDb();
    const buf = await makeObjectTopicZip();
    const record = await importTopic(db, buf, "2.0.0");

    expect(record.meta.id).toBe("test_clothes");
    expect(record.meta.version).toBe("1.0.0");
    expect(record.cards).toHaveLength(1);
    expect(record.installedAt).toBeTruthy();
  });

  it("imports a procedural topic (no image files)", async () => {
    const db = await freshDb();
    const buf = await makeProceduralTopicZip();
    const record = await importTopic(db, buf, "2.0.0");

    expect(record.meta.id).toBe("math_houses");
    expect(record.cards[0].renderer).toBe("math_houses");
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
});
