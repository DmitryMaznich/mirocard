import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import { placeValueAnswerSentence } from "./placeValueLabels.js";

// jsdom has no ResizeObserver; useFitLongestOneLine (textFit.js, used by
// the question prompt's text sizing) needs one. No-op stub — this test
// doesn't assert on live-resize font shrinking.
if (typeof window.ResizeObserver === "undefined") {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

describe("IdentifyNumberTask", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    root = null; container = null;
  });

  function mount(task, handlers = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <IdentifyNumberTask
          task={task}
          onCorrect={handlers.onCorrect ?? (() => {})}
          onMistake={handlers.onMistake ?? (() => {})}
          onFlashIncorrect={handlers.onFlashIncorrect ?? (() => {})}
        />
      );
    });
  }

  function digitButton(d) {
    return Array.from(container.querySelectorAll(".pv-numkey")).find((b) => b.textContent === String(d));
  }

  function question() {
    return container.querySelector(".pv-question");
  }

  // The two digits render inside one shared .pv-number-frame (not two
  // separate .pv-answer-slot boxes) so they read as one number, not two —
  // see place_value.css's .pv-number-frame. guessFrame() checks the single
  // frame's state class; guessCells() checks each digit's own text.
  function guessFrame() {
    return container.querySelector(".pv-guess-row .pv-number-frame");
  }

  function guessCells() {
    return container.querySelectorAll(".pv-guess-row .pv-number-cell");
  }

  function backspaceButton() {
    return container.querySelector(".pv-backspace-btn");
  }

  it("mounts asking 'Какое это число?' directly, with an empty two-digit guess row in one frame", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } });
    expect(question().textContent).toBe("Какое это число?");
    expect(container.querySelectorAll(".pv-guess-row .pv-number-frame").length).toBe(1);
    const cells = guessCells();
    expect(cells.length).toBe(2);
    expect(cells[0].textContent).toBe("?");
    expect(cells[1].textContent).toBe("?");
  });

  it("renders every ten-stack/coin at once, even with a large tens/ones count (no wrapping/shrinking to fit)", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 99, model: { tens: 9, ones: 9 } });
    const zones = container.querySelector(".pv-zones");
    expect(zones.className).toContain("pv-zones--flex-fit");
    expect(container.querySelectorAll(".cb-ten-stack").length).toBe(9);
    expect(container.querySelectorAll(".cb-coin").length).toBe(9);
  });

  it("shakes and clears a wrong two-digit guess without advancing", () => {
    vi.useFakeTimers();
    try {
      const onMistake = vi.fn();
      mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } }, { onMistake });

      act(() => { digitButton(9).click(); }); // wrong guess, digit 1 of 2
      act(() => { digitButton(9).click(); }); // wrong guess, digit 2 of 2 -> 99 !== 23

      expect(onMistake).toHaveBeenCalledTimes(1);
      // One shake on the frame — a wrong guess is one wrong number, not
      // two separately-wrong digits.
      expect(guessFrame().className).toContain("pv-number-frame--shake");

      act(() => { vi.advanceTimersByTime(500); });

      const cells = guessCells();
      expect(cells[0].textContent).toBe("?");
      expect(cells[1].textContent).toBe("?");
      expect(question().textContent).toBe("Какое это число?");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows 'Правильно!' and the recap sentence, and waits for a tap on Далее before calling onCorrect", () => {
    const onCorrect = vi.fn();
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } }, { onCorrect });

    act(() => { digitButton(2).click(); }); // correct guess, digit 1 of 2
    act(() => { digitButton(3).click(); }); // correct guess, digit 2 of 2 -> 23 === 23

    expect(question().textContent).toBe("Правильно!");
    expect(question().className).toContain("pv-question--correct");

    expect(guessFrame().className).toContain("pv-number-frame--correct");
    const cells = guessCells();
    expect(cells[0].textContent).toBe("2");
    expect(cells[1].textContent).toBe("3");

    expect(container.querySelector(".pv-recap").textContent).toBe(placeValueAnswerSentence(2, 3, 23));

    expect(onCorrect).not.toHaveBeenCalled();
    expect(container.querySelector(".pv-numpad")).toBeNull();

    const nextButton = Array.from(container.querySelectorAll("button")).find((b) => b.textContent.includes("Далее"));
    expect(nextButton).toBeTruthy();
    act(() => { nextButton.click(); });
    expect(onCorrect).toHaveBeenCalledWith("x", "x");
  });

  // Bare single digit (tens = 0, e.g. 7): the guess frame must not pad a
  // leading zero — one cell, one tap, no "07".
  it("a single-digit target (tens = 0) gets a one-cell frame that submits after one tap", () => {
    const onCorrect = vi.fn();
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 7, model: { tens: 0, ones: 7 } }, { onCorrect });

    expect(guessCells().length).toBe(1);
    expect(container.querySelectorAll(".cb-ten-stack").length).toBe(0);
    expect(container.querySelectorAll(".cb-coin").length).toBe(7);

    act(() => { digitButton(7).click(); });
    expect(question().textContent).toBe("Правильно!");
    expect(guessCells()[0].textContent).toBe("7");
  });

  // Round ten (ones = 0, e.g. 30): still a two-cell frame, second cell is 0.
  it("a round ten (ones = 0) renders an empty units zone and solves as two digits", () => {
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 30, model: { tens: 3, ones: 0 } });
    expect(guessCells().length).toBe(2);
    expect(container.querySelectorAll(".cb-ten-stack").length).toBe(3);
    expect(container.querySelectorAll(".cb-coin").length).toBe(0);

    act(() => { digitButton(3).click(); });
    act(() => { digitButton(0).click(); });
    expect(question().textContent).toBe("Правильно!");
  });

  it("backspace erases only the last digit, letting a mistyped first digit be fixed before submitting", () => {
    const onCorrect = vi.fn();
    const onMistake = vi.fn();
    mount({ cardId: "x", conceptId: "x", type: "identify_number", number: 23, model: { tens: 2, ones: 3 } }, { onCorrect, onMistake });

    act(() => { digitButton(9).click(); }); // wrong first digit, not yet submitted (2-digit target)
    expect(guessCells()[0].textContent).toBe("9");
    expect(backspaceButton().disabled).toBe(false);

    act(() => { backspaceButton().click(); });
    expect(guessCells()[0].textContent).toBe("?");
    expect(backspaceButton().disabled).toBe(true); // nothing left to erase

    act(() => { digitButton(2).click(); });
    act(() => { digitButton(3).click(); });

    expect(onMistake).not.toHaveBeenCalled(); // corrected before the guess ever completed
    expect(question().textContent).toBe("Правильно!");
    expect(onCorrect).not.toHaveBeenCalled(); // still waits for the Далее tap
  });
});
