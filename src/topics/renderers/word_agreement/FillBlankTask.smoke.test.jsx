import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import FillBlankTask from "./FillBlankTask.jsx";

const ADJECTIVE_CARD = {
  id: "adjagr_test",
  sentence: "У Ивана {blank} мяч.",
  answer: "маленький",
  marker: "мяч",
  question: "какой?",
  context: null,
};

const POSSESSIVE_CARD = {
  id: "possagr_test",
  sentence: "Иван нашёл {blank} мяч.",
  answer: "свой",
  marker: "мяч",
  question: "чей?",
  context: null,
};

const CASE_CARD_NO_QUESTION = {
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

  function mount(type, card, options, callbacks = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <FillBlankTask
          task={{ type, card, options }}
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

  function tapHint() {
    act(() => {
      container.querySelector(".wa-hint-button")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  it("does not reveal the question or marker before the hint is tapped, even after wrong picks", () => {
    mount("adjective_agreement", ADJECTIVE_CARD, ["маленький", "большой"]);

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

  it("highlights the real 2-letter adjective ending, not just the last 2 characters", () => {
    mount("adjective_agreement", ADJECTIVE_CARD, ["маленький", "большой"]);
    tapHint();

    expect(container.querySelector(".wa-hint-button")).toBeNull();
    expect(container.querySelector(".wa-marker").textContent).toBe("мяч");
    expect(container.querySelector(".wa-question").textContent).toBe("(какой?)");

    // One ending inside the question + one per option (2 options) = 3.
    expect(container.querySelectorAll(".wa-ending")).toHaveLength(3);
    expect(container.querySelector(".wa-question .wa-ending").textContent).toBe("ой");

    const optionEndings = [...container.querySelectorAll(".wa-option")].map(
      (btn) => btn.querySelector(".wa-ending")?.textContent
    );
    expect(optionEndings.sort()).toEqual(["ий", "ой"]); // маленький / большой
  });

  it("highlights possessive pronouns' real 1-letter ending, including a zero ending for наш", () => {
    // свой/наш are different lexemes standing side by side as distractors —
    // a shared-root diff between them would be wrong; each word's ending
    // must come from its own paradigm (свой: 1-letter "-й", наш: no ending
    // at all in the masculine).
    mount("possessive_agreement", POSSESSIVE_CARD, ["свой", "наш"]);
    tapHint();

    expect(container.querySelector(".wa-question").textContent).toBe("(чей?)");
    expect(container.querySelector(".wa-question .wa-ending").textContent).toBe("й");

    const svoyButton = [...container.querySelectorAll(".wa-option")]
      .find((btn) => btn.textContent.trim() === "свой");
    expect(svoyButton.querySelector(".wa-ending").textContent).toBe("й");

    const nashButton = [...container.querySelectorAll(".wa-option")]
      .find((btn) => btn.textContent.trim() === "наш");
    expect(nashButton.querySelector(".wa-ending")).toBeNull();

    // question ending ("й") + свой's ending ("й") — наш contributes none.
    expect(container.querySelectorAll(".wa-ending")).toHaveLength(2);
  });

  it("falls back to marker-only highlighting when the card has no question", () => {
    mount("case_agreement", CASE_CARD_NO_QUESTION, ["мяча", "мячом"]);
    tapHint();

    expect(container.querySelector(".wa-marker").textContent).toBe("нет");
    expect(container.querySelector(".wa-question")).toBeNull();
    expect(container.querySelectorAll(".wa-ending")).toHaveLength(0);
  });

  it("does not count the hint tap as a mistake", () => {
    const onMistake = vi.fn();
    mount("adjective_agreement", ADJECTIVE_CARD, ["маленький", "большой"], { onMistake });
    tapHint();

    expect(onMistake).not.toHaveBeenCalled();
  });
});
