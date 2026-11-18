// The installed deck must show exactly its own modes, and each must give tasks.
// 2026-11-18: topicLoader still carried the 1.0.0 modes in DEFAULT_MODES and appended
// them to the 2.x deck's menu; those modes gave no tasks («карточки не показываются»).
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { importTopic } from "../../topicLoader.js";
import { openDb } from "@/core/db";
import { generateTasks } from "./engine.js";

const catalog = JSON.parse(await readFile(resolve("public/decks/catalog.json"), "utf8"));
const deck = catalog.decks.find((d) => d.id === "phonetic_analysis");

describe("phonetic_analysis deck as installed", () => {
  it("has only the deck's own modes, and every mode gives tasks", async () => {
    const bytes = await readFile(resolve("public/decks", basename(deck.url)));
    const manifest = JSON.parse(await (await import("jszip")).default.loadAsync(bytes).then((z) => z.file("topic.json").async("string")));
    const db = await openDb(`pa-import-${Math.random()}`);
    const record = await importTopic(db, bytes, "99.0.0");
    expect(record.modes.map((m) => m.id)).toEqual(manifest.modes.map((m) => m.id));
    for (const mode of record.modes) {
      // every value of every setting (Сложность, Где искать, Направление, …)
      const variants = [{}];
      for (const [key, def] of Object.entries(mode.params ?? {})) {
        if (def?.type !== "enum") continue;
        for (const v of [...variants]) for (const value of def.values) variants.push({ ...v, [key]: value });
      }
      for (const params of variants) {
        const tasks = generateTasks(mode, record.cards, 10, params);
        expect(tasks.length, `${mode.id} ${JSON.stringify(params)}`).toBeGreaterThan(0);
        expect(tasks.some((t) => t.type === "pa_need_more"), `${mode.id} ${JSON.stringify(params)}`).toBe(false);
      }
    }
  });
});
