import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const CARDS = [
  { id: "letter_а", conceptId: "letter_а", primary: true,
    params: { printed_upper: "А", printed_lower: "а", has_upper: true, tags: ["oval"] } },
  { id: "letter_о", conceptId: "letter_о", primary: true,
    params: { printed_upper: "О", printed_lower: "о", has_upper: true, tags: ["oval"] } },
  { id: "letter_с", conceptId: "letter_с", primary: true,
    params: { printed_upper: "С", printed_lower: "с", has_upper: true, tags: ["arc"] } },
  { id: "letter_ъ", conceptId: "letter_ъ", primary: true,
    params: { printed_upper: null, printed_lower: "ъ", has_upper: false, tags: ["arch"] } },
];

describe("generateTasks — sort_case", () => {
  it("produces upper + lower tasks for has_upper=true letters", () => {
    const tasks = generateTasks("sort_case", CARDS);
    const forA  = tasks.filter((t) => t.letter === "А" || t.letter === "а");
    expect(forA.map((t) => t.letterCase)).toContain("upper");
    expect(forA.map((t) => t.letterCase)).toContain("lower");
  });

  it("produces only lower task for has_upper=false letters", () => {
    const tasks = generateTasks("sort_case", CARDS);
    const forHard = tasks.filter((t) => t.letter === "ъ");
    expect(forHard).toHaveLength(1);
    expect(forHard[0].letterCase).toBe("lower");
    expect(forHard[0].correctZone).toBe("lower");
  });

  it("every task has type sort_case with letter string", () => {
    const tasks = generateTasks("sort_case", CARDS);
    for (const t of tasks) {
      expect(t.type).toBe("sort_case");
      expect(typeof t.letter).toBe("string");
    }
  });

  it("total task count = has_upper letters × 2 + no-upper letters × 1", () => {
    const tasks = generateTasks("sort_case", CARDS);
    // 3 with upper × 2 + 1 without upper × 1 = 7
    expect(tasks).toHaveLength(7);
  });
});

describe("generateTasks — match_print_to_written", () => {
  it("produces one task per (letter, case) pair", () => {
    const tasks = generateTasks("match_print_to_written", CARDS);
    expect(tasks).toHaveLength(7); // 3×2 + 1×1
  });

  it("each task has exactly 4 options, exactly 1 target", () => {
    const tasks = generateTasks("match_print_to_written", CARDS);
    for (const t of tasks) {
      expect(t.options).toHaveLength(4);
      expect(t.options.filter((o) => o.isTarget)).toHaveLength(1);
    }
  });

  it("stimulus has printed letter and letterCase", () => {
    const tasks = generateTasks("match_print_to_written", CARDS);
    for (const t of tasks) {
      expect(typeof t.stimulus.printed).toBe("string");
      expect(["upper", "lower"]).toContain(t.stimulus.letterCase);
    }
  });

  it("options carry letter string for rendering", () => {
    const tasks = generateTasks("match_print_to_written", CARDS);
    for (const t of tasks) {
      expect(t.options.every((o) => typeof o.letter === "string")).toBe(true);
    }
  });
});

describe("generateTasks — match_written_to_print", () => {
  it("produces one task per (letter, case) pair", () => {
    const tasks = generateTasks("match_written_to_print", CARDS);
    expect(tasks).toHaveLength(7);
  });

  it("stimulus has letter and letterCase", () => {
    const tasks = generateTasks("match_written_to_print", CARDS);
    for (const t of tasks) {
      expect(typeof t.stimulus.letter).toBe("string");
      expect(["upper", "lower"]).toContain(t.stimulus.letterCase);
    }
  });

  it("options carry printed letter string", () => {
    const tasks = generateTasks("match_written_to_print", CARDS);
    for (const t of tasks) {
      expect(t.options.every((o) => typeof o.printed === "string")).toBe(true);
    }
  });
});

describe("generateTasks — match_pair", () => {
  it("skips has_upper=false letters", () => {
    const tasks = generateTasks("match_pair", CARDS);
    const lowerLetters = tasks.flatMap((t) => t.options.map((o) => o.letter));
    expect(lowerLetters).not.toContain("ъ");
  });

  it("produces one task per has_upper=true letter", () => {
    const tasks = generateTasks("match_pair", CARDS);
    expect(tasks).toHaveLength(3);
  });

  it("stimulus is uppercase letter, options are lowercase letter strings", () => {
    const tasks = generateTasks("match_pair", CARDS);
    for (const t of tasks) {
      expect(typeof t.stimulus.letter).toBe("string");
      expect(t.options.every((o) => typeof o.letter === "string")).toBe(true);
    }
  });
});
