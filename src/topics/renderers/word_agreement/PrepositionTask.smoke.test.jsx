import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import WordAgreementRenderer from "./index.jsx";

const CARD = {
  id: "prep_ball_box_in",
  relation: "in",
  distractorRelations: ["on"],
  object: "ball",
  landmark: "box",
  locatePrompt: "Где мяч? Покажи: в коробке.",
  actionPrompt: "Положи мяч в коробку.",
  resultPhrase: "Мяч в коробке.",
  sentence: "Мяч лежит {blank} коробке.",
  answer: "в",
};

describe("preposition tasks", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null;
    container = null;
  });

  function mount(type, callbacks = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <WordAgreementRenderer
          task={{ type, card: CARD, options: ["in", "on"] }}
          topicId="word_agreement_ru"
          onCorrect={callbacks.onCorrect ?? (() => {})}
          onMistake={callbacks.onMistake ?? (() => {})}
          onAdvance={() => {}}
          onCardShown={() => {}}
          onTap={() => {}}
        />
      );
    });
  }

  it("shows two concrete scene choices and accepts the matching relation", () => {
    const onCorrect = vi.fn();
    mount("preposition_recognize", { onCorrect });

    expect(container.querySelectorAll(".wa-scene-choice")).toHaveLength(2);
    expect(container.textContent).toContain(CARD.locatePrompt);

    act(() => {
      container.querySelector(".wa-scene-choice[aria-label='мяч в коробке']")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCorrect).toHaveBeenCalledWith(CARD.id, CARD.id);
    expect(container.textContent).toContain(CARD.resultPhrase);
  });

  it("uses tap targets instead of requiring a drag in the action form", () => {
    const onCorrect = vi.fn();
    mount("preposition_place", { onCorrect });

    expect(container.querySelectorAll(".wa-scene__zone")).toHaveLength(2);
    act(() => {
      container.querySelector(".wa-scene__zone--in")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCorrect).toHaveBeenCalledWith(CARD.id, CARD.id);
    expect(container.querySelector(".wa-scene--relation-in")).not.toBeNull();
  });

  it("keeps the scene visible while the child chooses the preposition in a phrase", () => {
    const onCorrect = vi.fn();
    mount("preposition_phrase", { onCorrect });

    expect(container.textContent).toContain("Мяч лежит");
    expect(container.querySelector(".wa-scene--relation-in")).not.toBeNull();
    act(() => {
      [...container.querySelectorAll(".wa-option")]
        .find((button) => button.textContent.trim() === "в")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCorrect).toHaveBeenCalledWith(CARD.id, CARD.id);
    expect(container.textContent).toContain("Мяч лежит в коробке.");
  });
});
