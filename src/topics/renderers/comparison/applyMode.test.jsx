import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { generateTasks } from "./engine.js";

// dnd-kit can't be dragged in jsdom: keep the drop handler to call it directly.
let dragEnd;
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ onDragEnd, children }) => { dragEnd = onDragEnd; return children; },
  DragOverlay: () => null,
  PointerSensor: {}, TouchSensor: {},
  useSensor: () => ({}), useSensors: () => [],
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
  useDroppable: () => ({ isOver: false, setNodeRef: () => {} }),
}));
vi.mock("./DrawingSignPad", () => ({
  default: ({ onSignRecognized }) => <button className="fake-pad" onClick={() => onSignRecognized(">", () => {})}>pad</button>,
}));
const { default: CompareApply } = await import("./CompareApply.jsx");

const MODE_APPLY = { id: "compare_apply", type: "compare_apply", defaultCardId: "compare_hard" };
const cards = [{ id: "compare_hard", conceptId: "compare_hard" }];

let container, root, calls;
afterEach(() => { act(() => root?.unmount()); container?.remove(); });
function render(task) {
  calls = { right: 0, wrong: 0, mistake: 0 };
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root.render(<CompareApply task={{ conceptId: "compare_hard", ...task }}
    onCorrect={() => calls.right++} onIncorrect={() => calls.wrong++} onMistake={() => calls.mistake++} />));
}
const drop = (tileIdx, slotIdx) => act(() => dragEnd({ active: { data: { current: { idx: tileIdx } } }, over: { data: { current: { slotIdx } } } }));

describe("Сравнение — «Применяем сравнение»", () => {
  it("«Выбери число»: some tasks have two fitting tiles", () => {
    const tasks = generateTasks(MODE_APPLY, cards, 60, { level: 3, taskType: "generate" });
    const fitCount = (t) => t.options.filter((n) => (t.op === "more" ? n > t.value : n < t.value)).length;
    expect(tasks.some((t) => fitCount(t) === 2)).toBe(true);
    expect(tasks.some((t) => fitCount(t) === 1)).toBe(true);
    expect(tasks.every((t) => fitCount(t) >= 1 && t.options.length - fitCount(t) >= 1)).toBe(true);
  });

  it("«Выбери число»: a right tile reads the record", () => {
    render({ taskType: "generate", op: "more", value: 6, options: [2, 9, 6, 4] });
    act(() => [...container.querySelectorAll(".apply-choice-btn")].find((b) => b.textContent === "9").click());
    expect(calls.right).toBe(1);
    expect(container.textContent).toContain("9 больше 6");
  });

  it("«Выбери число»: a wrong sign inside the hint costs nothing", () => {
    render({ taskType: "generate", op: "more", value: 6, options: [2, 9, 6, 4], min: 1, max: 10 });
    const hintButton = (label) => [...container.querySelectorAll(".apply-hint-btn")].find((b) => b.textContent.includes(label));
    act(() => hintButton("Подсказка").click());
    act(() => hintButton("Ещё подсказка").click());
    act(() => container.querySelector(".fake-pad").click()); // «>» for 2 vs 6 is wrong
    expect(calls).toEqual({ right: 0, wrong: 0, mistake: 0 });
  });

  it("«Выбери число»: the hint is the wedge first, drawing the sign second, never both", () => {
    render({ taskType: "generate", op: "more", value: 6, options: [2, 9, 6, 4], min: 1, max: 10 });
    const hintButton = (label) => [...container.querySelectorAll(".apply-hint-btn")].find((b) => b.textContent.includes(label));
    act(() => hintButton("Подсказка").click());
    expect(container.querySelector(".apply-wedge")).not.toBeNull();
    expect(container.querySelector(".apply-wedge-mark text").textContent).toBe("6");
    expect(container.querySelector(".fake-pad")).toBeNull();
    act(() => hintButton("Ещё подсказка").click());
    expect(container.querySelector(".apply-wedge")).toBeNull();
    expect(container.querySelectorAll(".fake-pad")).toHaveLength(4);
    act(() => hintButton("Убрать подсказку").click());
    expect(container.querySelector(".apply-wedge")).toBeNull();
    expect(container.querySelector(".fake-pad")).toBeNull();
  });

  it("«Расставь по порядку»: a wrong drop is a mistake, the numbers in place stay", () => {
    render({ taskType: "order", numbers: [8, 3, 5], sorted: [3, 5, 8], direction: "asc", min: 1, max: 10 });
    drop(1, 0); // 3 → first slot, right
    drop(0, 1); // 8 → second slot, wrong
    expect(calls).toEqual({ right: 0, wrong: 0, mistake: 1 });
    const slots = [...container.querySelectorAll(".apply-order-slot-drop")].map((s) => s.textContent);
    expect(slots).toEqual(["3", "?", "?"]);
    drop(2, 1);
    drop(0, 2);
    expect(calls).toEqual({ right: 1, wrong: 0, mistake: 1 });
  });
});
