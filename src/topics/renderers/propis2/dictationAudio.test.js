import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { generateTasks } from "./engine.js";
import { dictationAudioUrl } from "../../../handwriting/dictationAudio.js";

// Every letter and every word the dictation can ask for has its recorded clip. Was the archived
// `propis` topic's own test (archive/propis); the same recordings now serve `propis2`.
const wide = JSON.parse(readFileSync("tools/handwriting/cyrillic/wide.json", "utf-8"));
const topic = JSON.parse(readFileSync("tools/propis2/topic.json", "utf-8"));
const rec = { ...topic, wide: wide.glyphs, elements: JSON.parse(readFileSync("tools/handwriting/cyrillic/elements.json", "utf-8")).elements };
const mode = topic.modes.find((m) => m.type === "dictation");
const clips = (item) => (item.audio?.length ? item.audio.map((a) => a.key) : [item.key]);

describe("propis2 dictation audio", () => {
  it("plays one shipped clip per letter («Заглавная Б.» / «Строчная б.»)", () => {
    const [task] = generateTasks(mode, rec, 1000, { level: "letters", itemCount: 1000 });
    // 33 small letters + 30 capitals: ъ ы ь have no capital in school cursive (alphabet.js RU_NO_CAPITAL)
    expect(task.items.length).toBe(63);
    for (const item of task.items) {
      expect(item.key).toMatch(/^(up|lo)_[а-яё]$/);
      for (const key of clips(item)) expect(existsSync(`public${dictationAudioUrl(key)}`), key).toBe(true);
    }
  });

  it("plays one shipped clip per dictation word", () => {
    const [task] = generateTasks(mode, rec, 1000, { level: "words", itemCount: 1000 });
    expect(task.items.length).toBe(topic.words.length);
    for (const item of task.items) {
      expect(item.key).toMatch(/^word_w\d{3}$/);
      for (const key of clips(item)) expect(existsSync(`public${dictationAudioUrl(key)}`), key).toBe(true);
    }
  });
});
