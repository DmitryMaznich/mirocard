import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateTasks } from "./engine.js";
import { dictationAudioUrl } from "./dictationAudio.js";

// vitest runs from the repo root.
const topic = JSON.parse(readFileSync(resolve("tools/propis/topic.json"), "utf8"));
const publicFile = (url) => resolve(`public${url}`);

describe("propis letter dictation audio", () => {
  it("plays one shipped clip per letter card («Заглавная Б.» / «Строчная б.»)", () => {
    const [task] = generateTasks({ type: "dictation" }, topic, 1000, { level: "letters", itemCount: 1000 });
    expect(task.items.length).toBeGreaterThanOrEqual(64);
    for (const item of task.items) {
      expect(item.key).toMatch(/^(up|lo)_[а-яё]$/);
      expect(item.soundKey).toBeUndefined();
      expect(existsSync(publicFile(dictationAudioUrl(item.key))), item.key).toBe(true);
    }
  });

  it("plays one shipped clip per dictation word (ElevenLabs, 2026-10-11)", () => {
    const [task] = generateTasks({ type: "dictation" }, topic, 1000, { level: "words", itemCount: 1000 });
    expect(task.items.length).toBe(topic.words.length);
    for (const item of task.items) {
      expect(item.key).toMatch(/^word_w\d{3}$/);
      expect(existsSync(publicFile(dictationAudioUrl(item.key))), item.key).toBe(true);
    }
  });
});
