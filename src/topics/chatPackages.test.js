import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { openDb } from "@/core/db";
import { importTopic } from "./topicLoader";
for (const [id, version] of [
  ["can_i_watch_tv", "1.0.1"],
  ["chat_with_mom", "1.0.2"],
  ["feel_sick", "1.0.1"],
  ["good_night", "1.0.1"],
  ["help_me", "1.0.1"],
  ["im_hungry", "1.0.0"],
  ["morning_greeting", "1.0.1"],
]) {
  test(`prepared chat package ${id} imports into the real client`, async () => {
    const bytes = readFileSync(
      path.resolve(`public/decks/${id}_v${version}.zip`),
    );
    const db = await openDb(`chat-package-${id}-${Math.random()}`);
    const record = await importTopic(db, bytes, "1.0.9999");
    expect(record.meta.id).toBe(id);
    expect(record.meta.renderer).toBe("chat_practice");
    if (record.modes?.length)
      for (const mode of record.modes)
        expect(record.scripts[mode.id].turns.length).toBeGreaterThan(0);
    else expect(record.turns.length).toBeGreaterThan(0);
    db.close();
  });
}


test("published sentence builder package exposes the new letter-writing mode",async()=>{
  const db=await openDb(`sentence-package-${Math.random()}`);
  const bytes=readFileSync(path.resolve("public/decks/sentence_puzzle_v1.10.0.zip"));
  const record=await importTopic(db,bytes,"1.0.9999");
  expect(record.meta.version).toBe("1.10.0");expect(record.modes.map(m=>m.id)).toContain("listen_write_letters");db.close();
});
