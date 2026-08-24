import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const speech = vi.hoisted(() => ({
  cancel: vi.fn(),
  speak: vi.fn(),
}));

vi.mock("@/shared/hooks/useSpeech", () => ({
  useSpeech: () => speech,
}));

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
    speech.cancel.mockClear();
    speech.speak.mockClear();
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
          soundEnabled={callbacks.soundEnabled ?? false}
          playFeedback={() => {}}
          onCorrect={callbacks.onCorrect ?? (() => {})}
          onIncorrect={callbacks.onIncorrect ?? (() => {})}
          onMistake={() => {}}
        />
      );
    });
  }

  it("shows only the visual change and two sign choices", () => {
    vi.useFakeTimers();
    mount(addTask);

    expect(container.textContent).not.toContain("Смотри");
    expect(container.textContent).not.toContain("Было");
    expect(container.textContent).not.toContain("Стало");
    expect(container.querySelectorAll(".observe-change__dot")).toHaveLength(2);
    expect(container.querySelectorAll(".observe-change__dot--square")).toHaveLength(2);
    const initialAnswerArea = container.querySelector(".observe-change__answer-area");
    expect(initialAnswerArea?.classList.contains("observe-change__answer-area--visible")).toBe(false);
    expect(initialAnswerArea?.getAttribute("aria-hidden")).toBe("true");

    act(() => { vi.advanceTimersByTime(5000); });

    expect(container.querySelectorAll(".observe-change__dot")).toHaveLength(3);
    expect(container.querySelector(".observe-change__question")).toBeNull();
    const visibleAnswerArea = container.querySelector(".observe-change__answer-area");
    expect(visibleAnswerArea?.classList.contains("observe-change__answer-area--visible")).toBe(true);
    expect(visibleAnswerArea?.getAttribute("aria-hidden")).toBe("false");
    expect([...container.querySelectorAll(".observe-change__answer")].map((button) => button.textContent.trim())).toEqual([
      "+",
      "−",
    ]);
  });

  it("gives a spoken starting quantity and asks more or less without naming the action", () => {
    vi.useFakeTimers();
    mount(addTask, { soundEnabled: true });

    act(() => { vi.advanceTimersByTime(80); });
    expect(speech.speak.mock.calls.at(-1)?.[0]).toBe("Было 2.");

    act(() => { vi.advanceTimersByTime(4920); });
    expect(speech.speak.mock.calls.at(-1)?.[0]).toBe("Стало больше или меньше?");
    expect(speech.speak.mock.calls.map(([text]) => text)).not.toContain("Прибавили 1.");
    expect(speech.speak.mock.calls.map(([text]) => text)).not.toContain("Убрали 1.");
  });

  it("records an incorrect answer and replays the same scene", () => {
    vi.useFakeTimers();
    const onIncorrect = vi.fn();
    mount(addTask, { onIncorrect, soundEnabled: true });
    act(() => { vi.advanceTimersByTime(5000); });

    act(() => {
      container.querySelector(".observe-change__answer--less")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onIncorrect).toHaveBeenCalledWith("plus", "operation_plus");
    expect(container.querySelector(".observe-change__feedback")).toBeNull();
    expect(speech.speak.mock.calls.at(-1)?.[0]).toBe("Неправильно. Посмотри ещё раз.");

    act(() => { vi.advanceTimersByTime(850); });
    expect(container.querySelectorAll(".observe-change__dot")).toHaveLength(2);
  });

  it("records a correct answer only after the calm confirmation", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    mount(addTask, { onCorrect, soundEnabled: true });
    act(() => { vi.advanceTimersByTime(5000); });

    act(() => {
      container.querySelector(".observe-change__answer--more")
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onCorrect).not.toHaveBeenCalled();
    expect(container.querySelector(".observe-change__feedback")).toBeNull();
    expect(speech.speak.mock.calls.at(-1)?.[0]).toBe("Правильно. Стало больше.");
    act(() => { vi.advanceTimersByTime(750); });
    expect(onCorrect).toHaveBeenCalledWith("plus", "operation_plus");
  });
});
