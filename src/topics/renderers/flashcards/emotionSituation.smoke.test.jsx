import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "situation_joy_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку." },
  { id: "sad_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sad_1.webp" },
  { id: "situation_sad_1", conceptId: "sadness", cardType: "situation", label: "Питомец заболел." },
  { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
  { id: "situation_anger_1", conceptId: "anger", cardType: "situation", label: "Брат сломал твою игрушку." },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("emotion_situation — mounted through the real (unmodified) ChooseWordTask", () => {
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
        <FlashcardsRenderer task={task} mode={{ type: "emotion_situation" }} onCorrect={onCorrect} onIncorrect={onIncorrect} />
      );
    });
  }

  it("renders situation sentences as clickable text options, not emotion words", () => {
    const tasks = generateTasks("emotion_situation", CONCEPTS, CARDS, { optionCount: 2 });
    mount(tasks[0], { onCorrect: () => {}, onIncorrect: () => {} });
    const buttons = Array.from(container.querySelectorAll(".choose-word-btn"));
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => !["радость", "грусть", "злость"].includes(b.textContent))).toBe(true);
  });

  it("clicking the correct situation option fires onCorrect", () => {
    const tasks = generateTasks("emotion_situation", CONCEPTS, CARDS, { optionCount: 2 });
    const task = tasks.find((t) => t.conceptId === "joy");
    let correctCall = null;
    mount(task, { onCorrect: (...args) => { correctCall = args; }, onIncorrect: () => { throw new Error("should not fire"); } });

    const targetLabel = task.options.find((o) => o.isTarget).label;
    const btn = Array.from(container.querySelectorAll(".choose-word-btn")).find((b) => b.textContent === targetLabel);
    expect(btn, "target option button not found").toBeTruthy();
    act(() => btn.click());

    expect(correctCall).toEqual(["joy", task.card.id]);
  });
});
