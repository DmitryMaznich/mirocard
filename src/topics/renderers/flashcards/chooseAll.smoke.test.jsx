import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "joy_2", conceptId: "joy", primary: false, image: "media/joy_2.webp" },
  { id: "sadness_1", conceptId: "sadness", primary: true, label: "грусть", image: "media/sadness_1.webp" },
  { id: "anger_1", conceptId: "anger", primary: true, label: "злость", image: "media/anger_1.webp" },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("choose_all — progress counter", () => {
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
        <FlashcardsRenderer task={task} mode={{ type: "choose_all" }} {...handlers} />
      );
    });
  }

  it("shows 0 found before any tap, and updates after a correct tap", () => {
    const task = generateTasks("choose_all", CONCEPTS, CARDS, { optionCount: 4 }).find((t) => t.conceptId === "joy");
    mount(task, { onCorrect: () => {}, onIncorrect: () => {} });

    expect(container.querySelector(".choose-all-progress")?.textContent).toBe(`Найдено 0 из ${task.targetCardIds.length}`);

    // ChooseAllOption renders a loading placeholder (no real <img src>) in this
    // test environment, so identify the target tile by its position in
    // task.allCards — the same array ChooseAllTask maps over to render tiles —
    // rather than by image content.
    const firstTargetId = task.targetCardIds[0];
    const allButtons = Array.from(container.querySelectorAll(".choose-all-option"));
    const targetIndex = task.allCards.findIndex((c) => c.id === firstTargetId);
    act(() => { allButtons[targetIndex].click(); });

    expect(container.querySelector(".choose-all-progress")?.textContent).toBe(`Найдено 1 из ${task.targetCardIds.length}`);
  });
});
