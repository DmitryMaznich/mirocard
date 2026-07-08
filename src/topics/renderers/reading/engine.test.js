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

describe("daily_sentences mode", () => {
  const POOL_TOPIC = {
    meta: { id: "reading_test", renderer: "reading" },
    texts: [
      {
        id: "pool",
        kind: "sentence_pool",
        dailySize: 10,
        lines: Array.from({ length: 20 }, (_, i) => ({
          id: `s${i + 1}`,
          text: `Инструкция ${i + 1}.`,
        })),
      },
    ],
  };

  it("returns exactly dailySize tasks (one per sentence)", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    expect(tasks).toHaveLength(10);
  });

  it("each task has exactly one line", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    for (const task of tasks) {
      expect(task.text.lines).toHaveLength(1);
    }
  });

  it("task type is read_text", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    expect(tasks[0].type).toBe("read_text");
  });

  it("all selected lines come from the original pool", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const poolIds = new Set(POOL_TOPIC.texts[0].lines.map((l) => l.id));
    for (const task of tasks) {
      expect(poolIds.has(task.text.lines[0].id)).toBe(true);
    }
  });

  it("no duplicate sentences in selection", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const ids = tasks.map((t) => t.text.lines[0].id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("same date produces the same selection", () => {
    const tasks1 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const tasks2 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    expect(tasks1.map((t) => t.text.lines[0].id)).toEqual(
      tasks2.map((t) => t.text.lines[0].id)
    );
  });

  it("different dates produce different selections", () => {
    const tasks1 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01" });
    const tasks2 = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-02" });
    expect(tasks1.map((t) => t.text.lines[0].id)).not.toEqual(
      tasks2.map((t) => t.text.lines[0].id)
    );
  });

  it("returns empty array for non-sentence_pool kind", () => {
    const tasks = generateTasks({ type: "daily_sentences" }, TOPIC, "dad_best", { today: "2024-01-01" });
    expect(tasks).toHaveLength(0);
  });

  it("respects selectedLineIds — only selected sentences appear", () => {
    const ids = ["s1", "s3", "s5"];
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01", selectedLineIds: ids });
    expect(tasks).toHaveLength(3);
    for (const task of tasks) {
      expect(ids).toContain(task.text.lines[0].id);
    }
  });

  it("caps dailySize at pool size when selectedLineIds is small", () => {
    const ids = ["s1", "s2"]; // 2 < dailySize(10)
    const tasks = generateTasks({ type: "daily_sentences" }, POOL_TOPIC, "pool", { today: "2024-01-01", selectedLineIds: ids });
    expect(tasks).toHaveLength(2);
  });
});

describe("safe_code mode", () => {
  const SAFE_CODE_TOPIC = {
    meta: { id: "reading_test", renderer: "reading" },
    texts: [
      {
        id: "safe_code_locations",
        kind: "safe_code",
        title: { ru: "Код от сейфа" },
        spots: [
          { id: "pillow", label: "Подушка", phrase: "под подушкой" },
          { id: "box", label: "Коробка", phrase: "в коробке" },
        ],
      },
    ],
  };

  it("generates one safe_code task ignoring textId", () => {
    const tasks = generateTasks({ type: "safe_code" }, SAFE_CODE_TOPIC, "any_text_id");
    expect(tasks).toHaveLength(1);
    expect(tasks[0].type).toBe("safe_code");
    expect(tasks[0].text.kind).toBe("safe_code");
    expect(tasks[0].text.spots).toHaveLength(2);
  });

  it("returns empty if no safe_code kind text exists", () => {
    const tasks = generateTasks({ type: "safe_code" }, TOPIC, "dad_best");
    expect(tasks).toHaveLength(0);
  });
});
