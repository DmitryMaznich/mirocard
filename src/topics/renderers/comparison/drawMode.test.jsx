import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { mayBeHalfOfEqual, recognizeSign } from "./signRecognition.js";
import topic from "../../../../tools/comparison/topic.json";

vi.mock("./DrawingSignPad", () => ({
  default: ({ onSignRecognized }) => (
    <div>
      {["?", "<", ">", "="].map((sign) => (
        <button key={sign} data-sign={sign} onClick={() => onSignRecognized(sign, () => {})}>{sign}</button>
      ))}
    </div>
  ),
}));
const { default: CompareDrawSign } = await import("./CompareDrawSign.jsx");

const bar = (y) => [{ x: 40, y }, { x: 140, y: y + 2 }, { x: 240, y }];

let container, root, calls;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });

function render(left, right, taskRetry = 0) {
  calls = { right: 0, wrong: 0 };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<CompareDrawSign task={{ type: "compare_draw_sign", left, right, conceptId: "compare_hard" }} mode={{ ui: { instruction: "Нарисуй" } }} taskRetry={taskRetry}
    onCorrect={() => calls.right++} onIncorrect={() => calls.wrong++} />));
}
const draw = (sign) => act(() => container.querySelector(`[data-sign="${sign}"]`).click());

describe("Сравнение — «Нарисуй знак»", () => {
  it("comes after choosing the sign: recognition first, then drawing", () => {
    const ids = topic.modes.map((m) => m.id);
    expect(ids.indexOf("compare_evaluate")).toBeLessThan(ids.indexOf("compare_draw_sign"));
    expect(topic.modes.find((m) => m.id === "compare_evaluate").ui.title).toMatch(/^3\./);
    expect(topic.modes.find((m) => m.id === "compare_draw_sign").ui.title).toMatch(/^4\./);
  });

  it("an unreadable drawing asks to draw again and is not a mistake", () => {
    render(3, 7);
    draw("?");
    expect(calls).toEqual({ right: 0, wrong: 0 });
    expect(container.textContent).toContain("нарисуй ещё раз");
    draw("<");
    expect(calls).toEqual({ right: 1, wrong: 0 });
    expect(container.textContent).not.toContain("нарисуй ещё раз");
  });

  it("the phrase reads the drawn record left to right", () => {
    render(3, 7);
    draw("<");
    expect(container.textContent).toContain("3 меньше 7");
  });

  it("after a wrong sign the crocodile reminds which way it opens", () => {
    render(3, 7);
    expect(container.querySelector(".compare-croc-tip")).toBeNull();
    act(() => root.unmount()); container.remove();
    render(3, 7, 1);
    expect(container.textContent).toContain("пасть к большему");
  });

  it("a wrong sign is still a mistake", () => {
    render(3, 7);
    draw(">");
    expect(calls).toEqual({ right: 0, wrong: 1 });
  });

  it("one flat bar waits for the second bar of «=»", () => {
    expect(mayBeHalfOfEqual([bar(120)])).toBe(true);
    expect(mayBeHalfOfEqual([[{ x: 200, y: 40 }, { x: 60, y: 150 }, { x: 200, y: 260 }]])).toBe(false);
    expect(mayBeHalfOfEqual([bar(120), bar(180)])).toBe(false);
    expect(recognizeSign([bar(120), bar(180)])).toBe("=");
  });
});
