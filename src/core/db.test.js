import { describe, it, expect, beforeEach } from "vitest";
import { openDb, kv, topics } from "./db";

describe("kv store", () => {
  let db;
  beforeEach(async () => { db = await openDb("test-" + Date.now()); });

  it("set and get a value", async () => {
    await kv.set(db, "settings", { uiLanguage: "ru" });
    const val = await kv.get(db, "settings");
    expect(val).toEqual({ uiLanguage: "ru" });
  });

  it("get returns null for missing key", async () => {
    const val = await kv.get(db, "missing_key");
    expect(val).toBeNull();
  });

  it("set overwrites existing value", async () => {
    await kv.set(db, "x", 1);
    await kv.set(db, "x", 2);
    expect(await kv.get(db, "x")).toBe(2);
  });

  it("del removes a key", async () => {
    await kv.set(db, "y", "hello");
    await kv.del(db, "y");
    expect(await kv.get(db, "y")).toBeNull();
  });
});

describe("topics store", () => {
  let db;
  beforeEach(async () => { db = await openDb("test-" + Date.now()); });

  it("saves and retrieves topic files", async () => {
    const blob = new Blob(["hello"], { type: "image/webp" });
    await topics.saveFile(db, "clothes_basic", "media/shirt.webp", blob);
    const retrieved = await topics.getFile(db, "clothes_basic", "media/shirt.webp");
    expect(retrieved).toBeInstanceOf(Blob);
  });

  it("getFile returns null for missing file", async () => {
    const result = await topics.getFile(db, "nope", "nope.webp");
    expect(result).toBeNull();
  });

  it("listFiles returns all files for a topic", async () => {
    const b = new Blob(["x"]);
    await topics.saveFile(db, "t1", "a.webp", b);
    await topics.saveFile(db, "t1", "b.webp", b);
    await topics.saveFile(db, "t2", "c.webp", b); // different topic
    const files = await topics.listFiles(db, "t1");
    expect(files).toHaveLength(2);
    expect(files).toContain("a.webp");
  });

  it("deleteTopic removes all files for topic", async () => {
    const b = new Blob(["x"]);
    await topics.saveFile(db, "del_me", "a.webp", b);
    await topics.saveFile(db, "del_me", "b.webp", b);
    await topics.deleteTopic(db, "del_me");
    expect(await topics.listFiles(db, "del_me")).toHaveLength(0);
  });
});
