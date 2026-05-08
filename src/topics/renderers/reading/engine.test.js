import { describe, it, expect } from "vitest";
import { generateTasks, tokenizeReadingLine } from "./engine";

const TOPIC = {
  meta: { id: "reading_test", renderer: "reading" },
  texts: [
    {
      id: "dad_best",
      kind: "poem",
      title: "Папа наш",
      lines: [
        { id: "l1", text: "Кто на свете лучше всех?" },
        { id: "l2", text: "Папа наш!" },
      ],
      questions: [
        { id: "q1", prompt: "О ком стих?", supportLineIds: ["l2"] },
      ],
    },
  ],
};

describe("reading engine", () => {
  it("tokenizes lines into word tokens with punctuation attached", () => {
    expect(tokenizeReadingLine({ id: "l1", text: "Папа наш!" }).map((token) => token.text)).toEqual(["Папа", "наш!"]);
  });

  it("generates reading, understanding, and assemble tasks", () => {
    expect(generateTasks({ type: "read_text" }, TOPIC, "dad_best")).toHaveLength(1);

    const questions = generateTasks({ type: "understand_text" }, TOPIC, "dad_best");
    expect(questions).toHaveLength(1);
    expect(questions[0].supportLines[0].text).toBe("Папа наш!");

    const assemble = generateTasks({ type: "assemble_text" }, TOPIC, "dad_best");
    expect(assemble).toHaveLength(1);
    expect(assemble[0].text.lines[0].expectedTokens.map((token) => token.text)).toEqual([
      "Кто",
      "на",
      "свете",
      "лучше",
      "всех?",
    ]);
  });
});
