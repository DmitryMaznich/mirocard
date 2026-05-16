// src/topics/renderers/function_cards/engine.test.js
import { describe, it, expect } from "vitest";
import { generateTasks } from "./engine";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  {
    id: "hammer_tool_1", conceptId: "hammer", primary: true,
    label: "Молоток", labelInstrumental: "молотком", action: "забивают гвозди",
    image: "media/hammer_tool_1.webp", type: "tool",
    audio: { ru: "audio/hammer_question.mp3" },
  },
  { id: "hammer_tool_2", conceptId: "hammer", primary: false, label: "Молоток", image: "media/hammer_tool_2.webp", type: "tool" },
  { id: "hammer_scene_before", conceptId: "hammer", primary: false, image: "media/hammer_scene_before.webp", type: "scene_before" },
  { id: "hammer_scene_after",  conceptId: "hammer", primary: false, image: "media/hammer_scene_after.webp",  type: "scene_after"  },

  {
    id: "screwdriver_tool_1", conceptId: "screwdriver", primary: true,
    label: "Отвёртка", labelInstrumental: "отвёрткой", action: "закручивают шурупы",
    image: "media/screwdriver_tool_1.webp", type: "tool",
  },
  { id: "screwdriver_scene_before", conceptId: "screwdriver", primary: false, image: "media/screwdriver_scene_before.webp", type: "scene_before" },
  { id: "screwdriver_scene_after",  conceptId: "screwdriver", primary: false, image: "media/screwdriver_scene_after.webp",  type: "scene_after"  },

  {
    id: "drill_tool_1", conceptId: "drill", primary: true,
    label: "Дрель", labelInstrumental: "дрелью", action: "сверлят отверстия",
    image: "media/drill_tool_1.webp", type: "tool",
  },
  { id: "drill_scene_before", conceptId: "drill", primary: false, image: "media/drill_scene_before.webp", type: "scene_before" },
  { id: "drill_scene_after",  conceptId: "drill", primary: false, image: "media/drill_scene_after.webp",  type: "scene_after"  },

  {
    id: "handsaw_tool_1", conceptId: "handsaw", primary: true,
    label: "Пила", labelInstrumental: "пилой", action: "пилят доску",
    image: "media/handsaw_tool_1.webp", type: "tool",
  },
  { id: "handsaw_scene_before", conceptId: "handsaw", primary: false, image: "media/handsaw_scene_before.webp", type: "scene_before" },
  { id: "handsaw_scene_after",  conceptId: "handsaw", primary: false, image: "media/handsaw_scene_after.webp",  type: "scene_after"  },
];

const CONCEPTS = deriveConcepts(CARDS);

// ── choose_action ────────────────────────────────────────────

describe("generateTasks — choose_action", () => {
  it("generates one task per concept", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(CONCEPTS.length);
  });

  it("each task has type choose_action", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    expect(tasks.every(t => t.type === "choose_action")).toBe(true);
  });

  it("each task has exactly 4 options", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    for (const t of tasks) expect(t.options).toHaveLength(4);
  });

  it("exactly one option is the target", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      expect(t.options.filter(o => o.isTarget)).toHaveLength(1);
    }
  });

  it("target action matches concept action", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      const target = t.options.find(o => o.isTarget);
      const concept = CONCEPTS.find(c => c.conceptId === t.conceptId);
      expect(target.action).toBe(concept.primary.action);
    }
  });

  it("task has toolCard (type=tool)", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      expect(t.toolCard).toBeDefined();
      expect(t.toolCard.type).toBe("tool");
    }
  });

  it("task has question string containing labelInstrumental", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      expect(t.question).toContain(t.labelInstrumental);
    }
  });

  it("task has feedbackText containing label and action", () => {
    const tasks = generateTasks("choose_action", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      const concept = CONCEPTS.find(c => c.conceptId === t.conceptId);
      expect(t.feedbackText).toContain(concept.primary.label);
      expect(t.feedbackText).toContain(concept.primary.action);
    }
  });
});

// ── scene_function ───────────────────────────────────────────

describe("generateTasks — scene_function", () => {
  it("generates one task per concept", () => {
    const tasks = generateTasks("scene_function", CONCEPTS, CARDS, {});
    expect(tasks).toHaveLength(CONCEPTS.length);
  });

  it("each task has type scene_function", () => {
    const tasks = generateTasks("scene_function", CONCEPTS, CARDS, {});
    expect(tasks.every(t => t.type === "scene_function")).toBe(true);
  });

  it("each task has sceneBefore and sceneAfter cards", () => {
    const tasks = generateTasks("scene_function", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      expect(t.sceneBefore?.type).toBe("scene_before");
      expect(t.sceneAfter?.type).toBe("scene_after");
    }
  });

  it("each task has exactly 4 tool options", () => {
    const tasks = generateTasks("scene_function", CONCEPTS, CARDS, {});
    for (const t of tasks) expect(t.options).toHaveLength(4);
  });

  it("exactly one option is the target", () => {
    const tasks = generateTasks("scene_function", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      expect(t.options.filter(o => o.isTarget)).toHaveLength(1);
    }
  });

  it("target option conceptId matches task conceptId", () => {
    const tasks = generateTasks("scene_function", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      const target = t.options.find(o => o.isTarget);
      expect(target.conceptId).toBe(t.conceptId);
    }
  });

  it("all options have a toolCard with type=tool", () => {
    const tasks = generateTasks("scene_function", CONCEPTS, CARDS, {});
    for (const t of tasks) {
      for (const opt of t.options) {
        expect(opt.toolCard?.type).toBe("tool");
      }
    }
  });

  it("returns empty array for unknown mode", () => {
    expect(generateTasks("unknown_mode", CONCEPTS, CARDS, {})).toEqual([]);
  });
});
