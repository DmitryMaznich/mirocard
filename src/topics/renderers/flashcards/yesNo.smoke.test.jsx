import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

// Mounts the real, unmodified YesNoTask to confirm the question is phrased
// with the mode's answerPrefix (e.g. emotions_v2's "Чувствует") instead of
// the generic "Это" — proving the grammar fix actually reaches the DOM, not
// just a prop-shape assumption.

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "sadness_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sadness_1.webp" },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("yes_no — mounted through the real YesNoTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, mode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FlashcardsRenderer
          task={task}
          mode={mode}
          onCorrect={() => {}}
          onIncorrect={() => {}}
        />
      );
    });
  }

  it("uses the mode's answerPrefix when set", () => {
    const [task] = generateTasks("yes_no", CONCEPTS, CARDS, {});
    mount(task, { type: "yes_no", answerPrefix: "Чувствует" });
    const label = container.querySelector(".yn-label");
    expect(label?.textContent).toBe(`Чувствует ${task.displayLabel.toLowerCase()}?`);
  });

  it("falls back to the generic \"Это\" when no answerPrefix is set", () => {
    const [task] = generateTasks("yes_no", CONCEPTS, CARDS, {});
    mount(task, { type: "yes_no" });
    const label = container.querySelector(".yn-label");
    expect(label?.textContent).toBe(`Это ${task.displayLabel.toLowerCase()}?`);
  });
});
