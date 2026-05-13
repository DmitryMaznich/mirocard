import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";

const topicRecord = {
  cards: [
    { id: "mom",    type: "subject",   label: "Мама",    emoji: "👩" },
    { id: "dad",    type: "subject",   label: "Папа",    emoji: "👨" },
    { id: "boy",    type: "subject",   label: "Мальчик", emoji: "👦" },
    { id: "wash",   type: "verb",      label: "моет",    emoji: "🧼" },
    { id: "draw",   type: "verb",      label: "рисует",  emoji: "✏️" },
    { id: "read_v", type: "verb",      label: "читает",  emoji: "📖" },
    { id: "red",    type: "adjective", label: "красную", emoji: "🔴" },
    { id: "cup",    type: "object",    label: "чашку",   nominative: "чашка", emoji: "☕" },
  ],
  sentences: [
    { id: "s01", subject: "mom", verb: "wash" },
    { id: "s02", subject: "dad", verb: "draw" },
    { id: "s03", subject: "boy", verb: "read_v" },
  ],
};

describe("generateTasks — sentence_puzzle mode", () => {
  it("returns exactly one task", () => {
    const tasks = generateTasks({ type: "sentence_puzzle" }, topicRecord, {});
    expect(tasks).toHaveLength(1);
  });

  it("task has type sentence_puzzle", () => {
    const [task] = generateTasks({ type: "sentence_puzzle" }, topicRecord, {});
    expect(task.type).toBe("sentence_puzzle");
  });

  it("groups cards by type", () => {
    const [task] = generateTasks({ type: "sentence_puzzle" }, topicRecord, {});
    expect(task.subjects).toHaveLength(3);
    expect(task.verbs).toHaveLength(3);
    expect(task.adjectives).toHaveLength(1);
    expect(task.objects).toHaveLength(1);
  });

  it("handles missing cards of a type gracefully", () => {
    const noObjects = { ...topicRecord, cards: topicRecord.cards.filter((c) => c.type !== "object") };
    const [task] = generateTasks({ type: "sentence_puzzle" }, noObjects, {});
    expect(task.objects).toHaveLength(0);
  });

  it("returns one task even when no cards provided", () => {
    const tasks = generateTasks({ type: "sentence_puzzle" }, { cards: [], sentences: [] }, {});
    expect(tasks).toHaveLength(1);
    expect(tasks[0].subjects).toHaveLength(0);
  });
});

describe("generateTasks — listen_build mode", () => {
  it("returns one task per sentence", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 1 }
    );
    expect(tasks).toHaveLength(3);
  });

  it("each task.target contains the correct cards", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 0 }
    );
    const t = tasks.find((x) => x.target.subject.id === "mom");
    expect(t).toBeDefined();
    expect(t.target.verb.id).toBe("wash");
    expect(t.type).toBe("listen_build");
  });

  it("pool has correct card + N distractors per slot type", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 1 }
    );
    const task = tasks[0];
    const subjects = task.pool.filter((c) => c.type === "subject");
    const verbs    = task.pool.filter((c) => c.type === "verb");
    expect(subjects).toHaveLength(2);
    expect(verbs).toHaveLength(2);
  });

  it("pool always contains the correct card for each slot", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 2 }
    );
    for (const task of tasks) {
      for (const slotType of ["subject", "verb"]) {
        const correctId = task.target[slotType].id;
        expect(task.pool.some((c) => c.id === correctId)).toBe(true);
      }
    }
  });

  it("filters to only simple sentences when structure=simple", () => {
    const topicWithFull = {
      cards: [
        ...topicRecord.cards,
        { id: "blue", type: "adjective", label: "синюю", emoji: "🔵" },
        { id: "car",  type: "object",    label: "машинку", emoji: "🚗" },
      ],
      sentences: [
        ...topicRecord.sentences,
        { id: "f01", subject: "mom", verb: "wash", adjective: "red", object: "cup" },
      ],
    };
    const tasks = generateTasks(
      { type: "listen_build" },
      topicWithFull,
      { structure: "simple", distractors: 0 }
    );
    expect(tasks).toHaveLength(3);
  });

  it("task.audioPath is null when sentence has no audio field", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 0 }
    );
    expect(tasks[0].audioPath).toBeNull();
  });
});

describe("generateTasks — listen_build with close adults", () => {
  const studentWithAdults = {
    id: "u1",
    closeAdults: [
      { id: "a1", name: "Дима",  photo: "/photos/dima.jpg" },
      { id: "a2", name: "Катя",  photo: "/photos/katya.jpg" },
      { id: "a3", name: "Бабуля", photo: null },
    ],
  };

  it("target.subject is an adult card when student has closeAdults", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 0 },
      studentWithAdults
    );
    for (const task of tasks) {
      expect(task.target.subject.id).toMatch(/^adult_/);
      expect(task.target.subject.type).toBe("subject");
    }
  });

  it("pool subjects are adult cards only, no topic subject cards", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 2 },
      studentWithAdults
    );
    for (const task of tasks) {
      const poolSubjects = task.pool.filter((c) => c.type === "subject");
      for (const s of poolSubjects) {
        expect(s.id).toMatch(/^adult_/);
      }
    }
  });

  it("pool always contains the correct adult", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 2 },
      studentWithAdults
    );
    for (const task of tasks) {
      const correctId = task.target.subject.id;
      expect(task.pool.some((c) => c.id === correctId)).toBe(true);
    }
  });

  it("falls back to topic subjects when student has no closeAdults", () => {
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 0 },
      { id: "u2", closeAdults: [] }
    );
    for (const task of tasks) {
      expect(task.target.subject.id).not.toMatch(/^adult_/);
    }
  });

  it("adult card carries photo from closeAdults", () => {
    const oneAdult = { id: "u3", closeAdults: [{ id: "a1", name: "Дима", photo: "/photos/dima.jpg" }] };
    const tasks = generateTasks(
      { type: "listen_build" },
      topicRecord,
      { structure: "simple", distractors: 0 },
      oneAdult
    );
    expect(tasks[0].target.subject.photo).toBe("/photos/dima.jpg");
  });
});
