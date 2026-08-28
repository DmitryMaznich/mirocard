import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import FlashcardsRenderer from "./index.jsx";
import { generateTasks } from "./engine.js";
import { deriveConcepts } from "@/shared/utils/topicUtils";

// The halo class is computed synchronously from card.semantic.group1 and
// applied to CardImage's wrapper in both its loading and loaded states (see
// index.jsx), so this test never needs a real topic file to resolve — same
// as every other flashcards smoke test, no topicId/IndexedDB seeding needed.

describe("mood halo — CardImage glow gated on card.semantic.group1", () => {
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
      root.render(<FlashcardsRenderer task={task} mode={mode} onAdvance={() => {}} />);
    });
  }

  it("adds a positive halo class when the card declares semantic.group1: positive", () => {
    const cards = [{ id: "joy_1", conceptId: "joy", primary: true, label: "радость", image: "media/joy_1.webp", semantic: { group1: "positive" } }];
    const concepts = deriveConcepts(cards);
    const task = generateTasks("intro", concepts, cards, {})[0];
    mount(task, { type: "intro" });
    expect(container.querySelector(".card-img-wrap--positive")).not.toBeNull();
  });

  it("adds no halo class at all when the card has no semantic field (every non-emotions topic)", () => {
    const cards = [{ id: "t1", conceptId: "tshirt", primary: true, label: "футболка", image: "media/t1.webp" }];
    const concepts = deriveConcepts(cards);
    const task = generateTasks("intro", concepts, cards, {})[0];
    mount(task, { type: "intro" });
    const wrap = container.querySelector(".card-img-wrap");
    expect(wrap).not.toBeNull();
    expect(wrap.className).toBe("card-img-wrap");
  });
});
