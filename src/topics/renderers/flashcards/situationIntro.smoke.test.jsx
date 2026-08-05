import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

const CARDS = [
  { id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp" },
  { id: "joy_2", conceptId: "joy", primary: false, image: "media/joy_2.webp" },
  { id: "situation_joy_1", conceptId: "joy", cardType: "situation", label: "Друг подарил тебе игрушку." },
];
const CONCEPTS = deriveConcepts(CARDS);

describe("situation_intro — mounted through the real SituationIntroTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, onAdvance) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FlashcardsRenderer task={task} mode={{ type: "situation_intro" }} onAdvance={onAdvance} />
      );
    });
  }

  it("shows the situation text, the picture, and the question up front (same font as the situation text); hides only the emotion word until the first tap", () => {
    const [task] = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    mount(task, () => {});
    const instructions = container.querySelectorAll(".session-instruction");
    expect(instructions[0]?.textContent).toBe("Друг подарил тебе игрушку.");
    expect(instructions[1]?.textContent).toBe("Как называется это чувство?");
    expect(container.querySelector(".card-area")).not.toBeNull();
    expect(container.querySelector(".situation-intro__reveal")?.className).not.toContain("--shown");
    expect(container.querySelector(".situation-intro__label")?.textContent).toBe("радость");
  });

  it("first tap reveals the emotion word, does not advance; second tap advances", () => {
    const [task] = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    let advanceCalls = 0;
    mount(task, () => { advanceCalls++; });

    const btn = container.querySelector("button.situation-intro");
    act(() => btn.click());
    expect(container.querySelector(".situation-intro__reveal")?.className).toContain("--shown");
    expect(advanceCalls).toBe(0);

    act(() => btn.click());
    expect(advanceCalls).toBe(1);
  });
});
