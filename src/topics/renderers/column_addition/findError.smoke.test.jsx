import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach, vi } from "vitest";
import ColumnAdditionRenderer from "./index.jsx";

window.matchMedia ??= () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} });

describe("«Найди ошибку»", () => {
  let container = null;
  let root = null;
  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null; container = null;
  });
  const button = (label) => Array.from(container.querySelectorAll("button")).find((b) => b.getAttribute("aria-label") === label || b.textContent === label);
  const press = (label) => act(() => button(label).click());
  const note = () => container.querySelector(".cfe-note").textContent;
  const key = (d) => act(() => Array.from(container.querySelectorAll(".col-tap-kb button")).find((b) => b.textContent === String(d)).click());

  it("a right digit is said to be right; the wrong one is found, a wrong fix gets a question, the right fix names the mistake", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const task = { type: "column_find_error", cardId: "x", conceptId: "x", operation: "add", top: 47, bottom: 25, result: 72, shown: 62, wrongPlace: 1, errorType: "carry" };
    act(() => root.render(<ColumnAdditionRenderer task={task} mode={{ type: "column_find_error" }} sessionParams={{ strictStars: true }} onCorrect={onCorrect} onMistake={onMistake} student={{}} />));
    // The keypad's place is kept, hidden, until the wrong digit is found.
    expect(container.querySelector(".col-tap-kb").style.visibility).toBe("hidden");
    press("Цифра 2: единицы");
    expect(note()).toContain("Эта цифра верная");
    expect(onMistake).toHaveBeenCalledTimes(1);
    press("Цифра 6: десятки");
    expect(container.querySelector(".cfe-answer--wrong").textContent).toBe("6");
    expect(container.querySelector(".col-tap-kb").style.visibility).toBe("");
    key(6);
    expect(note()).toContain("4 + 2 + 1 = ?");
    key(7);
    expect(container.querySelector(".cfe-answer--fixed").textContent).toBe("7");
    expect(note()).toBe("Ошибка была такая: забыли перенос.");
    press("Далее →");
    expect(onCorrect).toHaveBeenCalledTimes(1);
    expect(onMistake).toHaveBeenCalledTimes(2);
  });
});
