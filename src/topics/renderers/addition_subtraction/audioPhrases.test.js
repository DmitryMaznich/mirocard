import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PHRASE_ENTRIES, SIGN_ENTRIES } from "./audioPhraseBank";
import {
  nameActionCorrectAudioItems,
  observeStartAudioItems,
} from "./audioPhrases";
import { generateTasks } from "./engine";

const V = "/audio/addition-subtraction-voice";

describe("addition/subtraction phrase audio", () => {
  it("says the starting quantity as one recorded sentence", () => {
    expect(observeStartAudioItems(2)).toEqual([{ url: `${V}/was_2.mp3`, tight: false }]);
  });

  it("confirms the count step and the change with whole recorded sentences", () => {
    expect(nameActionCorrectAudioItems({ operation: "add", countStep: true, delta: 2, start: 3, result: 5 })).toEqual([
      { url: `${V}/correct_added_2.mp3`, tight: false },
      { url: `${V}/was_became_3_5.mp3`, tight: false },
    ]);
    expect(nameActionCorrectAudioItems({ operation: "subtract", countStep: false, delta: 1, start: 4, result: 3 })).toEqual([
      { url: `${V}/correct_removed.mp3`, tight: false },
      { url: `${V}/was_became_4_3.mp3`, tight: false },
    ]);
  });

  it("has a recording on disk for every entry of the bank", () => {
    const missing = [...PHRASE_ENTRIES, ...SIGN_ENTRIES]
      .filter(({ key }) => !existsSync(join(process.cwd(), "public", V, `${key}.mp3`)));
    expect(missing).toEqual([]);
  });

  it("has a whole recorded sentence for every task modes 2 and 3 can make", () => {
    const cards = ["add", "subtract"].map((operation) => ({ id: operation, conceptId: operation, renderer: "addition_subtraction", params: { operation } }));
    const variants = [
      { type: "operation_observe", maxNumber: 3 }, { type: "operation_observe", maxNumber: 5 },
      { type: "operation_name_action", maxNumber: 3, countStep: true }, { type: "operation_name_action", maxNumber: 5, countStep: true },
      { type: "operation_name_action", maxNumber: 5, countStep: false },
    ];
    for (const { type, ...params } of variants) {
      for (let round = 0; round < 20; round += 1) {
        const tasks = generateTasks(type, cards, 30, params);
        expect(tasks.length).toBeGreaterThan(0);
        for (const task of tasks) {
          const items = type === "operation_observe" ? observeStartAudioItems(task.start) : nameActionCorrectAudioItems(task);
          for (const { url } of items) expect(url.startsWith(V)).toBe(true);
          if (type === "operation_name_action") expect(items).toHaveLength(2);
        }
      }
    }
  });
});
