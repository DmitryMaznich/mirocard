import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

// Mounts the real, unmodified FindNTask (via FlashcardsRenderer's task.type
// dispatch) with an actual generateTasks("situation_emotion", ...) task, to
// confirm the situation sentence renders as the instruction and the correct
// picture option fires onCorrect - proving the "reuse find_n's UI as-is"
// design actually holds, not just the task-shape unit tests in engine.test.js.

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "joy_2", conceptId: "joy", primary: false, image: "media/joy_2.webp" },
  { id: "sadness_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sadness_1.webp" },
  { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
  { id: "situation_joy_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе подарок на день рождения.", sceneImage: "media/situation_joy_1.webp", answerKey: "радость" },
  { id: "situation_sadness_1", conceptId: "sadness", cardType: "situation", label: "Лопнул любимый шарик.", answerKey: "грусть" },
  { id: "situation_anger_1", conceptId: "anger", cardType: "situation", label: "Друг сломал башню.", answerKey: "злость" },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("situation_emotion — mounted through the real FindNTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, { onCorrect, onIncorrect }) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FlashcardsRenderer
          task={task}
          mode={{ type: "situation_emotion" }}
          onCorrect={onCorrect}
          onIncorrect={onIncorrect}
        />
      );
    });
  }

  it("renders the situation sentence as the instruction, not an emotion word", () => {
    const task = generateTasks("situation_emotion", CONCEPTS, CARDS, {}).find((item) => item.targetConceptId === "joy");
    mount(task, { onCorrect: () => {}, onIncorrect: () => {} });
    const instruction = container.querySelector(".session-instruction");
    expect(instruction?.textContent).toBe("Друг подарил тебе подарок на день рождения.");
    expect(container.querySelector(".situation-scene")).not.toBeNull();
  });

  it("tapping the correct emotion's option fires onCorrect with the target concept and card id", () => {
    const [task] = generateTasks("situation_emotion", CONCEPTS, CARDS, {});
    let correctCall = null;
    mount(task, { onCorrect: (...args) => { correctCall = args; }, onIncorrect: () => { throw new Error("should not fire"); } });

    const options = container.querySelectorAll(".find-n-option");
    expect(options).toHaveLength(task.options.length);
    const targetIndex = task.options.findIndex((o) => o.isTarget);
    act(() => options[targetIndex].click());

    expect(correctCall).toEqual([task.targetConceptId, task.options[targetIndex].card.id]);
  });

  it("tapping a wrong emotion's option fires onIncorrect, never onCorrect", () => {
    const [task] = generateTasks("situation_emotion", CONCEPTS, CARDS, {});
    let incorrectCall = null;
    mount(task, { onCorrect: () => { throw new Error("should not fire"); }, onIncorrect: (...args) => { incorrectCall = args; } });

    const options = container.querySelectorAll(".find-n-option");
    const wrongIndex = task.options.findIndex((o) => !o.isTarget);
    act(() => options[wrongIndex].click());

    expect(incorrectCall).toEqual([task.targetConceptId, task.options[wrongIndex].card.id]);
  });
});
