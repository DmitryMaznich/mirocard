import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import FillBlankTask from "./FillBlankTask.jsx";

const CARD_WITH_QUESTION = {
  id: "adjagr_test",
  sentence: "У Ивана {blank} мяч.",
  answer: "маленький",
  marker: "мяч",
  question: "какой?",
  context: null,
};

const CARD_WITHOUT_QUESTION = {
  id: "case_test",
  sentence: "У Ивана нет {blank}.",
  answer: "мяча",
  marker: "нет",
  context: null,
};

describe("FillBlankTask hint", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null;
    container = null;
  });

  function mount(card, options, callbacks = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FillBlankTask
          task={{ card, options }}
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

  it("does not reveal the question or marker before the hint is tapped, even after wrong picks", () => {
    mount(CARD_WITH_QUESTION, ["маленький", "большой"]);

    expect(container.querySelector(".wa-hint-button")).not.toBeNull();
    expect(container.querySelector(".wa-question")).toBeNull();
    expect(container.querySelector(".wa-marker")).toBeNull();

    // Two wrong picks used to auto-reveal the hint — it must not anymore.
    for (let i = 0; i < 2; i++) {
      const wrongButton = [...container.querySelectorAll(".wa-option")]
        .find((btn) => btn.textContent.trim() !== "маленький");
      act(() => wrongButton.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    }

    expect(container.querySelector(".wa-question")).toBeNull();
    expect(container.querySelector(".wa-marker")).toBeNull();
  });

  it("reveals marker, question and matching endings once the lightbulb is tapped", () => {
    mount(CARD_WITH_QUESTION, ["маленький", "большой"]);

    act(() => {
      container.querySelector(".wa-hint-button")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(".wa-hint-button")).toBeNull();
    expect(container.querySelector(".wa-marker").textContent).toBe("мяч");
    expect(container.querySelector(".wa-question").textContent).toBe("(какой?)");

    // One ending inside the question + one per option (2 options) = 3.
    expect(container.querySelectorAll(".wa-ending")).toHaveLength(3);
    const questionEnding = container.querySelector(".wa-question .wa-ending");
    expect(questionEnding.textContent).toBe("ой");
  });

  it("falls back to marker-only highlighting when the card has no question", () => {
    mount(CARD_WITHOUT_QUESTION, ["мяча", "мячом"]);

    act(() => {
      container.querySelector(".wa-hint-button")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.querySelector(".wa-marker").textContent).toBe("нет");
    expect(container.querySelector(".wa-question")).toBeNull();
    expect(container.querySelectorAll(".wa-ending")).toHaveLength(0);
  });

  it("does not count the hint tap as a mistake", () => {
    const onMistake = vi.fn();
    mount(CARD_WITH_QUESTION, ["маленький", "большой"], { onMistake });

    act(() => {
      container.querySelector(".wa-hint-button")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onMistake).not.toHaveBeenCalled();
  });
});
