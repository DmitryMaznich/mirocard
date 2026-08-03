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

  it("shows the situation text, hides the emotion label until the first tap", () => {
    const [task] = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    mount(task, () => {});
    expect(container.querySelector(".session-instruction")?.textContent).toBe("Друг подарил тебе игрушку.");
    expect(container.querySelector(".situation-intro__reveal")?.className).not.toContain("--shown");
  });

  it("first tap reveals the emotion, does not advance; second tap advances", () => {
    const [task] = generateTasks("situation_intro", CONCEPTS, CARDS, {});
    let advanceCalls = 0;
    mount(task, () => { advanceCalls++; });

    const btn = container.querySelector("button.situation-intro");
    act(() => btn.click());
    expect(container.querySelector(".situation-intro__reveal")?.className).toContain("--shown");
    expect(container.querySelector(".session-label")?.textContent).toBe("радость");
    expect(advanceCalls).toBe(0);

    act(() => btn.click());
    expect(advanceCalls).toBe(1);
  });
});
