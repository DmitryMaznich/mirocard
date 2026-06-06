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

describe("shopping_list mode", () => {
  const SHOPPING_TOPIC = {
    meta: { id: "reading_test", renderer: "reading" },
    texts: [
      {
        id: "shopping_list",
        kind: "shopping_list",
        title: { ru: "Список покупок" },
        file: "shopping/shopping.txt",
      },
    ],
  };

  it("generates one shopping_list task ignoring textId", () => {
    const tasks = generateTasks({ type: "shopping_list" }, SHOPPING_TOPIC, "any_text_id");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("shopping_list");
    expect(tasks[0].text.kind).toBe("shopping_list");
  });

  it("returns empty if no shopping_list kind text exists", () => {
    const tasks = generateTasks({ type: "shopping_list" }, TOPIC, "dad_best");
    expect(tasks).toHaveLength(0);
  });
});
