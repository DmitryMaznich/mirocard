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
    expect(rec.modes[0].type).toBe("builder");
  });

  it("the v1 propis deck keeps its wide-row data through the same installer", async () => {
    const file = readdirSync("public/decks").filter((n) => /^propis_v[0-9.]+\.zip$/.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).pop();
    const db = await openDb("test-p1-" + Date.now());
    await importTopic(db, await readFile(`public/decks/${file}`), "999.0.0");
    const rec = await getTopicRecord(db, "propis");
    expect(rec.wide.length).toBeGreaterThan(50);
    expect(rec.wideSheets.page18).toBeTruthy();
  });
});
