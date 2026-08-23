import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import AdditionSubtractionRenderer from "./index.jsx";

const addTask = {
  type: "operation_observe",
  cardId: "operation_plus",
  conceptId: "plus",
  operation: "add",
  start: 2,
  delta: 1,
  result: 3,
  answer: "more",
  maxNumber: 3,
  shape: "square",
  showNumerals: false,
};

describe("operation_observe", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    vi.useRealTimers();
    root = null;
    container = null;
  });

  function mount(task, callbacks = {}) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root.render(
        <AdditionSubtractionRenderer
          task={task}
          soundEnabled={false}
          playFeedback={() => {}}
          onCorrect={callbacks.onCorrect ?? (() => {})}
          onIncorrect={callbacks.onIncorrect ?? (() => {})}
          onMistake={() => {}}
        />
      );
    });
  }

  it("shows the observed result before asking more or less", () => {
    vi.useFakeTimers();
    mount(addTask);

    expect(container.querySelector(".observe-change__title")?.textContent).toBe("Смотри");
    expect(container.querySelectorAll(".observe-change__dot")).toHaveLength(2);
    expect(container.querySelectorAll(".observe-change__dot--square")).toHaveLength(2);
    const initialAnswerArea = container.querySelector(".observe-change__answer-area");
    expect(initialAnswerArea?.classList.contains("observe-change__answer-area--visible")).toBe(false);
    expect(initialAnswerArea?.getAttribute("aria-hidden")).toBe("true");

    act(() => { vi.advanceTimersByTime(5000); });

    expect(container.querySelectorAll(".observe-change__dot")).toHaveLength(3);
    expect(container.querySelector(".observe-change__question")?.textContent).toBe("Больше или меньше?");
    const visibleAnswerArea = container.querySelector(".observe-change__answer-area");
    expect(visibleAnswerArea?.classList.contains("observe-change__answer-area--visible")).toBe(true);
    expect(visibleAnswerArea?.getAttribute("aria-hidden")).toBe("false");
    expect([...container.querySelectorAll(".observe-change__answer")].map((button) => button.textContent.trim())).toEqual([
      "+ Больше",
      "− Меньше",
    ]);
  });

  it("records an incorrect answer and replays the same scene", () => {
    vi.useFakeTimers();
    const onIncorrect = vi.fn();
    mount(addTask, { onIncorrect });
    act(() => { vi.advanceTimersByTime(5000); });

    act(() => {
      container.querySelector(".observe-change__answer--less")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onIncorrect).toHaveBeenCalledWith("plus", "operation_plus");
    expect(container.querySelector(".observe-change__feedback")?.textContent).toContain("Посмотри ещё раз");

    act(() => { vi.advanceTimersByTime(850); });
    expect(container.querySelector(".observe-change__quantity-label")?.textContent).toBe("Было");
    expect(container.querySelectorAll(".observe-change__dot")).toHaveLength(2);
  });

  it("records a correct answer only after the calm confirmation", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    mount(addTask, { onCorrect });
    act(() => { vi.advanceTimersByTime(5000); });

    act(() => {
      container.querySelector(".observe-change__answer--more")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCorrect).not.toHaveBeenCalled();
    expect(container.querySelector(".observe-change__feedback")?.textContent).toContain("Стало больше");
    act(() => { vi.advanceTimersByTime(750); });
    expect(onCorrect).toHaveBeenCalledWith("plus", "operation_plus");
  });
});
