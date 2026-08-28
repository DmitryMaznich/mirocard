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
];
const CONCEPTS = deriveConcepts(CARDS);

describe("emotion_control — graphical prompt with a full answer bank", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null;
    container = null;
  });

  function mount(task, { onCorrect, onIncorrect }) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FlashcardsRenderer task={task} mode={{ type: "emotion_control" }} onCorrect={onCorrect} onIncorrect={onIncorrect} />
      );
    });
  }

  it("shows every label as an answer button and has no quality scale", () => {
    const task = generateTasks("emotion_control", CONCEPTS, CARDS, {}).find((item) => item.conceptId === "joy");
    mount(task, { onCorrect: () => {}, onIncorrect: () => {} });

    expect(container.querySelector(".emotion-control__prompt .card-area")).not.toBeNull();
    expect(container.querySelectorAll(".emotion-control__choice")).toHaveLength(3);
    expect(container.querySelectorAll(".qa-btn")).toHaveLength(0);
  });

  it("selecting the named emotion highlights it green, then reports a correct answer after the reveal delay", () => {
    vi.useFakeTimers();
    try {
      const task = generateTasks("emotion_control", CONCEPTS, CARDS, {}).find((item) => item.conceptId === "joy");
      let correctCall = null;
      mount(task, { onCorrect: (...args) => { correctCall = args; }, onIncorrect: () => { throw new Error("should not fire"); } });

      const targetIndex = task.options.findIndex((option) => option.isTarget);
      const target = container.querySelectorAll(".emotion-control__choice")[targetIndex];
      act(() => target.click());

      expect(target.className).toContain("emotion-control__choice--correct");
      expect(correctCall).toBeNull();

      act(() => { vi.advanceTimersByTime(1500); });
      expect(correctCall).toEqual(["joy", task.card.id]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("marks a wrong tap red and still reveals the correct word green", () => {
    vi.useFakeTimers();
    try {
      const task = generateTasks("emotion_control", CONCEPTS, CARDS, {}).find((item) => item.conceptId === "joy");
      let incorrectCall = null;
      mount(task, { onCorrect: () => { throw new Error("should not fire"); }, onIncorrect: (...args) => { incorrectCall = args; } });

      const choices = container.querySelectorAll(".emotion-control__choice");
      const targetIndex = task.options.findIndex((option) => option.isTarget);
      const wrongIndex = task.options.findIndex((option) => !option.isTarget);
      act(() => choices[wrongIndex].click());

      expect(choices[wrongIndex].className).toContain("emotion-control__choice--wrong");
      expect(choices[targetIndex].className).toContain("emotion-control__choice--correct");

      act(() => { vi.advanceTimersByTime(1500); });
      expect(incorrectCall).toEqual(["joy", task.card.id]);
    } finally {
      vi.useRealTimers();
    }
  });
});
