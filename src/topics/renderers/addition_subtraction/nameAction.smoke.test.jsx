import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const audio = vi.hoisted(() => ({
  stop: vi.fn(),
  play: vi.fn(),
}));

vi.mock("./useAudioSequence", () => ({
  useAudioSequence: () => audio,
}));

import AdditionSubtractionRenderer from "./index.jsx";

const baseTask = {
  type: "operation_name_action",
  cardId: "operation_plus",
  conceptId: "plus",
  operation: "add",
  start: 2,
  delta: 1,
  result: 3,
  maxNumber: 3,
  shape: "circle",
  countStep: false,
  countOptions: [1, 2, 3],
  answerMode: "buttons",
};

// One hand trip (1500 lead-in + trip) plus the pause before the question.
const QUESTION_AT = 4000;

describe("operation_name_action", () => {
  let container = null;
  let root = null;

  afterEach(() => {
    if (root) act(() => root.unmount());
    if (container) container.remove();
    vi.useRealTimers();
    audio.stop.mockClear();
    audio.play.mockClear();
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
          soundEnabled={callbacks.soundEnabled ?? true}
          playFeedback={() => {}}
          onCorrect={callbacks.onCorrect ?? (() => {})}
          onIncorrect={callbacks.onIncorrect ?? (() => {})}
          onMistake={() => {}}
        />
      );
    });
  }

  function click(selector) {
    act(() => {
      container.querySelector(selector).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
  }

  it("shows the hand bringing one object, then asks what was done", () => {
    vi.useFakeTimers();
    mount(baseTask);

    expect(container.querySelectorAll(".observe-change__rail .observe-change__dot")).toHaveLength(2);
    expect(container.querySelector(".observe-change__answer-area--visible")).toBeNull();
    expect(container.querySelector(".name-action__hand-svg")?.getAttribute("src")).toBe("/name-action/hand_open.webp");

    act(() => { vi.advanceTimersByTime(1500); });
    expect(container.querySelector(".name-action__hand-svg")?.getAttribute("src")).toBe("/name-action/hand_grip.webp");

    act(() => { vi.advanceTimersByTime(QUESTION_AT - 1500); });

    expect(container.querySelectorAll(".observe-change__rail .observe-change__dot")).toHaveLength(3);
    expect(container.querySelector(".observe-change__answer-area--visible")).not.toBeNull();
    expect(container.querySelector(".name-action__scene--settled")).not.toBeNull();
    expect([...container.querySelectorAll(".name-action__answer--verb")].map((b) => b.textContent.trim())).toEqual(["+Прибавили", "−Убрали"]);
    expect(audio.play.mock.calls.at(-1)?.[0]).toEqual([
      { url: "/audio/addition-subtraction/phrases/what_was_done.mp3", tight: false },
    ]);
  });

  it("confirms with the full было–стало phrase before reporting correct", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    mount(baseTask, { onCorrect });
    act(() => { vi.advanceTimersByTime(QUESTION_AT); });

    click('.name-action__answer--verb[aria-label="Прибавили"]');

    expect(audio.play.mock.calls.at(-1)?.[0]).toEqual([
      { url: "/audio/addition-subtraction/phrases/correct_added.mp3", tight: false },
      { url: "/audio/addition-subtraction/phrases/was.mp3", tight: false },
      { url: "/audio/addition-subtraction/n2.mp3", tight: false },
      { url: "/audio/addition-subtraction/phrases/became.mp3", tight: false },
      { url: "/audio/addition-subtraction/n3.mp3", tight: false },
    ]);
    expect(onCorrect).not.toHaveBeenCalled();
    audio.play.mock.calls.at(-1)?.[1]?.();
    expect(onCorrect).toHaveBeenCalledWith("plus", "operation_plus");
  });

  it("records a wrong verb, marks it, and waits for a tap on repeat instead of auto-replaying", () => {
    vi.useFakeTimers();
    const onIncorrect = vi.fn();
    mount(baseTask, { onIncorrect });
    act(() => { vi.advanceTimersByTime(QUESTION_AT); });

    click('.name-action__answer--verb[aria-label="Убрали"]');

    expect(onIncorrect).toHaveBeenCalledWith("plus", "operation_plus");
    expect(container.querySelector(".name-action__answer--wrong")).not.toBeNull();
    expect(container.querySelector(".observe-change__repeat--attention")).not.toBeNull();

    // No auto-restart: the scene stays put (still 3 dots, answer area still
    // visible) until the child deliberately taps repeat.
    act(() => { vi.advanceTimersByTime(5000); });
    expect(container.querySelectorAll(".observe-change__rail .observe-change__dot")).toHaveLength(3);
    expect(container.querySelector(".observe-change__answer-area--visible")).not.toBeNull();

    click(".observe-change__repeat");
    expect(container.querySelectorAll(".observe-change__rail .observe-change__dot")).toHaveLength(2);
    expect(container.querySelector(".observe-change__answer-area--visible")).toBeNull();

    act(() => { vi.advanceTimersByTime(QUESTION_AT); });
    expect(container.querySelectorAll(".observe-change__rail .observe-change__dot")).toHaveLength(3);
    expect(container.querySelector(".observe-change__answer-area--visible")).not.toBeNull();
  });

  it("asks how many after the verb when the count step is on", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    const task = { ...baseTask, operation: "subtract", cardId: "operation_minus", conceptId: "minus", start: 3, delta: 2, result: 1, countStep: true };
    mount(task, { onCorrect });
    // two hand trips
    act(() => { vi.advanceTimersByTime(QUESTION_AT + 2160); });
    expect(container.querySelectorAll(".observe-change__rail .observe-change__dot")).toHaveLength(1);

    click('.name-action__answer--verb[aria-label="Убрали"]');
    act(() => { vi.advanceTimersByTime(700); });
    expect(audio.play.mock.calls.at(-1)?.[0]).toEqual([
      { url: "/audio/addition-subtraction/phrases/how_many_removed.mp3", tight: false },
    ]);

    const buttons = [...container.querySelectorAll(".name-action__count button")];
    act(() => { buttons[1].dispatchEvent(new MouseEvent("click", { bubbles: true })); });
    expect(audio.play.mock.calls.at(-1)?.[0]).toEqual([
      { url: "/audio/addition-subtraction/phrases/correct_removed_count.mp3", tight: false },
      { url: "/audio/addition-subtraction/n2.mp3", tight: false },
      { url: "/audio/addition-subtraction/phrases/was.mp3", tight: false },
      { url: "/audio/addition-subtraction/n3.mp3", tight: false },
      { url: "/audio/addition-subtraction/phrases/became.mp3", tight: false },
      { url: "/audio/addition-subtraction/n1.mp3", tight: false },
    ]);
    audio.play.mock.calls.at(-1)?.[1]?.();
    expect(onCorrect).toHaveBeenCalledWith("minus", "operation_minus");
  });

  it("in voice mode gives the adult ✓/↻ and hides the child replay button", () => {
    vi.useFakeTimers();
    const onCorrect = vi.fn();
    const onIncorrect = vi.fn();
    mount({ ...baseTask, answerMode: "voice" }, { onCorrect, onIncorrect });

    expect(container.querySelector(".observe-change__repeat")).toBeNull();
    expect(container.querySelector(".name-action__answer--verb")).toBeNull();
    act(() => { vi.advanceTimersByTime(QUESTION_AT); });
    expect(container.querySelector(".name-action__adult--visible")?.textContent).toContain("«Прибавили»");

    click(".name-action__adult-btn--retry");
    expect(onIncorrect).toHaveBeenCalledTimes(1);
    act(() => { vi.advanceTimersByTime(QUESTION_AT); });
    click(".name-action__adult-btn--ok");
    audio.play.mock.calls.at(-1)?.[1]?.();
    expect(onCorrect).toHaveBeenCalledWith("plus", "operation_plus");
  });
});
