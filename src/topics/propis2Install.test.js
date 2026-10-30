import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { readdirSync } from "node:fs";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "./topicLoader";

// Installs the built propis2 deck through the real importer and checks the glyph data survives.
describe("propis2 deck install", () => {
  it("keeps wide glyphs, sheets and elements on the installed record", async () => {
    const file = readdirSync("public/decks").filter((n) => /^propis2_v.+\.zip$/.test(n)).sort().pop();
    expect(file).toBeTruthy();
    const db = await openDb("test-p2-" + Date.now());
    await importTopic(db, await readFile(`public/decks/${file}`), "999.0.0");
    const rec = await getTopicRecord(db, "propis2");
    expect(rec.meta.renderer).toBe("propis2");
    expect(rec.wide.length).toBeGreaterThan(50);
    expect(rec.wideSheets.page18).toBeTruthy();
    expect(rec.elements.length).toBeGreaterThan(0);
    // the element list's numbers and groups must survive the install step (the topic loader copies fields one by one)
    expect(Object.keys(rec.elementNumbers ?? {}).length).toBeGreaterThan(25);
    expect(rec.elementGroups?.length).toBeGreaterThan(3);
    expect(Object.keys(rec.elementRetired ?? {}).length).toBeGreaterThan(0);
    expect(rec.modes[0].type).toBe("builder");
    // «Диктант» draws from these banks; without them the words level was empty (2026-10-11). 247: «солнце» and «сердце» left the
    // dictation bank (silent consonants, owner 2026-10-29); `propis` below keeps all 249.
    expect(rec.words.length).toBe(247);
    expect(rec.texts.length).toBeGreaterThan(0);
  });

  it("the `propis` deck («Прописи старые») keeps its wide-row data through the same installer", async () => {
    const file = readdirSync("public/decks").filter((n) => /^propis_v[0-9.]+\.zip$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
    const db = await openDb("test-p1-" + Date.now());
    await importTopic(db, await readFile(`public/decks/${file}`), "999.0.0");
    const rec = await getTopicRecord(db, "propis");
    expect(rec.wide.length).toBeGreaterThan(50);
    expect(rec.wideSheets.page18).toBeTruthy();
    expect(rec.words.length).toBe(249);
  });
});
