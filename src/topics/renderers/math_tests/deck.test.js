import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { openDb } from "@/core/db";
import { importTopic } from "@/topics/topicLoader";

// The published deck must install: the app refuses a ZIP without cards («Тема не содержит карточек»),
// which is what broke the first release (0.1.0).
describe("math_tests deck", () => {
  it("the catalog's ZIP imports", async () => {
    const catalog = JSON.parse(await readFile(resolve("public/decks/catalog.json"), "utf8"));
    const entry = catalog.decks.find((d) => d.id === "math_tests");
    const db = await openDb(`math-tests-${Math.random()}`);
    const record = await importTopic(db, await readFile(resolve("public/decks", basename(entry.url))), "99.0.0");
    expect(record.meta.id).toBe("math_tests");
    expect(record.meta.version).toBe(entry.version);
    expect(record.modes.map((m) => m.id)).toEqual(["constructor", "solve"]);
  });
});
