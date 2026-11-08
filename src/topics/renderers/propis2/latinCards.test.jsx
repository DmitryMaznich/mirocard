import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { renderToStaticMarkup } from "react-dom/server";
import { openDb } from "@/core/db";
import { importTopic, getTopicRecord } from "@/topics/topicLoader";
import Propis2Renderer from "./index.jsx";
import { generateTasks } from "./engine.js";

// The letter cards («Узнай букву», «Строчная и заглавная») in English, both styles (docs/latin-letters.md): the tasks are made of the
// Latin alphabet and every card view draws them from the chosen style. The test copy of the deck carries the draft English.
const tc = JSON.parse(await readFile("tools/propis2/test-copy.json", "utf-8"));
const db = await openDb(`test-latin-cards-${Date.now()}`);
await importTopic(db, await readFile(`public/decks/propis2_lang_v${tc.version}.zip`), "999.0.0");
const deck = await getTopicRecord(db, "propis2_lang");
const modes = deck.modes.filter((m) => ["letters_recognize", "letters_case"].includes(m.type));

describe("letter cards in English", () => {
  it("the card modes offer the English styles", () => {
    for (const m of modes) {
      expect(m.params.writingLang.values).toContain("en");
      expect(m.params.writingStyle.values).toEqual(["print", "british"]);
    }
  });

  for (const style of ["print", "british"]) {
    it(`${style}: every kind of card task is Latin and draws`, () => {
      const kinds = new Set();
      for (const m of modes) {
        for (const params of [{}, { direction: "written_to_print" }, { variant: "pair" }]) {
          for (const task of generateTasks(m, deck, 6, { ...params, writingLang: "en", writingStyle: style })) {
            if (kinds.has(task.type)) continue;
            kinds.add(task.type);
            expect(task.writingStyle).toBe(style);
            const letter = task.letter ?? task.stimulus?.printed ?? task.stimulus?.letter;
            expect(letter, task.type).toMatch(/^[a-zA-Z]$/);
            const html = renderToStaticMarkup(<Propis2Renderer task={task} topicRecord={deck} onAdvance={() => {}} onCorrect={() => {}} onMistake={() => {}} />);
            expect(html, task.type).toContain("<path");
          }
        }
      }
      expect([...kinds].sort()).toEqual(expect.arrayContaining(["match_print_to_written", "sort_case"]));
    });
  }
});
