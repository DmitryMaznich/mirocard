import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import GraphicMatrixTask from "./GraphicMatrixTask";
import { generateGraphicMatrixTasks } from "./model";

let container;
let root;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
});

function renderTask() {
  const onCorrect = vi.fn();
  const onStreakReset = vi.fn();
  const [task] = generateGraphicMatrixTasks("2x2", { id: "board", conceptId: "matrix" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(<GraphicMatrixTask task={task} onCorrect={onCorrect} onStreakReset={onStreakReset} />));

  const cells = [...container.querySelectorAll(".graphic-matrix__cell")];
  for (const cell of cells) {
    cell.querySelector("svg").getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
    cell.setPointerCapture = () => {};
    cell.hasPointerCapture = () => false;
  }
  return { cells, onCorrect, onStreakReset };
}

function gesture(cell, points, { pointerType = "touch", end = "pointerup" } = {}) {
  function send(type, [clientX, clientY]) {
    cell.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType, clientX, clientY,
    }));
  }

  act(() => {
    send("pointerdown", points[0]);
    for (const point of points.slice(1)) send("pointermove", point);
    send(end, points.at(-1));
  });
}

const horizontal = [[20, 50], [80, 50]];
const vertical = [[50, 20], [50, 80]];

describe("graphic matrix drawing screen", () => {
  it("shows the agreed title without instructions or erasing buttons", () => {
    renderTask();
    expect(container.querySelector("h1").textContent).toBe("Что получится в клетках?");
    expect(container.textContent).not.toContain("Посмотри на чёрточки");
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("uses a tap to erase only the tapped unfinished drawing without penalty", () => {
    const { cells, onCorrect, onStreakReset } = renderTask();
    const [completed, partial, other, empty] = cells;
    gesture(completed, horizontal);
    gesture(completed, vertical);
    gesture(partial, horizontal);
    gesture(other, vertical);
    gesture(empty, [[50, 50]]);
    gesture(completed, [[50, 50]]);
    expect(completed.querySelectorAll("path")).toHaveLength(2);
    expect(other.querySelectorAll("path")).toHaveLength(1);
    expect(partial.querySelectorAll("path")).toHaveLength(1);

    // A short movement that returns to where it started is still a stroke,
    // so it must never erase the already accepted line.
    gesture(partial, [[38, 60], [48, 60], [38, 60]]);
    gesture(partial, [[50, 50]], { end: "pointercancel" });
    expect(partial.querySelectorAll("path")).toHaveLength(1);
    gesture(partial, [[50, 50], [52, 51]], { pointerType: "pen" });
    expect(partial.querySelectorAll("path")).toHaveLength(0);
    expect(other.querySelectorAll("path")).toHaveLength(1);
    expect(onCorrect).not.toHaveBeenCalled();
    expect(onStreakReset).not.toHaveBeenCalled();
  });

  it("clears an invalid stroke in the touched cell without counting a second mistake", () => {
    const { cells, onStreakReset } = renderTask();
    gesture(cells[0], [[25, 25], [75, 75]]);
    expect(cells[0].querySelector(".graphic-matrix__invalid")).not.toBeNull();
    gesture(cells[1], [[50, 50]]);
    expect(cells[0].querySelector(".graphic-matrix__invalid")).not.toBeNull();
    gesture(cells[0], [[50, 50]]);
    expect(cells[0].querySelectorAll("path")).toHaveLength(0);
    expect(onStreakReset).toHaveBeenCalledTimes(1);
  });
});
