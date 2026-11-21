import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import MathHousesRenderer from "./index.jsx";
import { generateNumberPath } from "./numberPath.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("credits the completed path immediately and advances after the practice answer", () => {
  vi.useFakeTimers();
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    disconnect() {}
  });
  const card = { id: "house_5", conceptId: "house_5", params: { number: 5 } };
  const [task] = generateNumberPath([card], { boardSize: 5 });
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const onCorrect = vi.fn();
  const onMistake = vi.fn();
  const onAdvance = vi.fn();

  function render(sessionStatus, key = "active") {
    act(() => root.render(
      <MathHousesRenderer
        key={key}
        task={task}
        sessionStatus={sessionStatus}
        sessionParams={{ mistakeBehavior: "restart" }}
        onCorrect={onCorrect}
        onMistake={onMistake}
        onAdvance={onAdvance}
      />,
    ));
  }

  try {
    render("task_active");
    const tiles = container.querySelectorAll(".number-path__tile");
    for (const index of task.route.slice(1, -1)) act(() => tiles[index].click());
    expect(onCorrect).not.toHaveBeenCalled();
    act(() => tiles[task.route.at(-1)].click());
    expect(onCorrect).toHaveBeenCalledExactlyOnceWith(task.conceptId, task.cardId);

    const check = container.querySelector(".number-path__check");
    const options = [...check.querySelectorAll("button")];
    const pick = (value) => act(() => options.find((button) => button.textContent === String(value)).click());
    expect(check.textContent).toContain("2 + ? = 5");
    act(() => vi.runAllTimers());
    expect(onAdvance).not.toHaveBeenCalled();

    pick(2);
    expect(onMistake).not.toHaveBeenCalled();
    expect(check.textContent).toContain("Получилось 4. Ищем 5.");
    expect(tiles[task.route.at(-1)].dataset.state).toBe("current");
    act(() => vi.runAllTimers());
    expect(onAdvance).not.toHaveBeenCalled();

    pick(3);
    expect(check.textContent).toContain("2 + 3 = 5");
    expect(options.every((button) => button.disabled)).toBe(true);
    act(() => vi.runAllTimers());
    expect(onCorrect).toHaveBeenCalledExactlyOnceWith(task.conceptId, task.cardId);
    expect(onAdvance).toHaveBeenCalledTimes(1);

    render("answer_correct", "restored");
    expect(container.querySelector('.number-path__tile[data-endpoint="finish"]').dataset.state).toBe("current");
    expect(container.querySelector(".number-path__check").textContent).toContain("2 + ? = 5");
    expect(onCorrect).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    container.remove();
  }
});
