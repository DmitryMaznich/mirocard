import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "sadness_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sadness_1.webp" },
  { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
  { id: "fear_1", conceptId: "fear", primary: true, label: "страх", image: "media/fear_1.webp" },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("choose_word_by_picture — tap feedback", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, handlers) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FlashcardsRenderer task={task} mode={{ type: "choose_word_by_picture" }} {...handlers} />
      );
    });
  }

  it("marks a wrong tap red and reveals the correct word green, without advancing immediately", () => {
    vi.useFakeTimers();
    try {
      const task = generateTasks("choose_word_by_picture", CONCEPTS, CARDS, {}).find((t) => t.conceptId === "joy");
      let incorrectCall = null;
      mount(task, {
        onCorrect: () => { throw new Error("should not fire before the delay"); },
        onIncorrect: (...args) => { incorrectCall = args; },
      });

      const buttons = Array.from(container.querySelectorAll(".choose-word-btn"));
      const wrongIndex = task.options.findIndex((o) => !o.isTarget);
      const correctIndex = task.options.findIndex((o) => o.isTarget);

      act(() => { buttons[wrongIndex].click(); });

      expect(buttons[wrongIndex].className).toContain("choose-word-btn--wrong");
      expect(buttons[correctIndex].className).toContain("choose-word-btn--correct");
      expect(buttons.every((b) => b.disabled)).toBe(true);
      expect(incorrectCall).toBeNull();

      act(() => { vi.advanceTimersByTime(1500); });
      expect(incorrectCall).toEqual(["joy", task.card.id]);
    } finally {
      vi.useRealTimers();
    }
  });
});
