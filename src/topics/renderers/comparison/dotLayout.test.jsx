import { describe, it, expect, afterEach, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { buildDotLayout, scatterLayout, rowsLayout, baseDotSize } from "./dotLayout.js";
import { generateTasks, dotLayoutFor } from "./engine.js";
import ComparisonRenderer from "./index.jsx";

const cards = [{ id: "compare_easy", conceptId: "compare_easy" }];
const MODE_VISUAL = { id: "compare_visual", type: "compare_visual", defaultCardId: "compare_easy", ui: { instruction: "Нажми" } };

function seeded(seed) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
}
const inside = (p) => p.x - p.d / 2 >= -1e-9 && p.x + p.d / 2 <= 1 + 1e-9 && p.y - p.d / 2 >= -1e-9 && p.y + p.d / 2 <= 1 + 1e-9;
const noTouch = (pts) => pts.every((a, i) => pts.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) >= a.d * 1.2));
const area = (pts) => pts.reduce((s, p) => s + p.d * p.d, 0);

describe("Сравнение — раскладка точек", () => {
  it("scattered dots stay inside the card and never touch, up to 20", () => {
    for (let n = 1; n <= 20; n++) {
      const pts = scatterLayout(n, baseDotSize(n), undefined, seeded(n + 3));
      expect(pts).toHaveLength(n);
      expect(pts.every(inside)).toBe(true);
      expect(noTouch(pts)).toBe(true);
    }
  });

  it("rows: five to a row, all one size", () => {
    const pts = rowsLayout(8, baseDotSize(8));
    expect(new Set(pts.map((p) => p.y.toFixed(4))).size).toBe(2);
    expect(new Set(pts.map((p) => p.d)).size).toBe(1);
    expect(pts.every(inside)).toBe(true);
  });

  it("a lure task: the side with fewer dots is the one that looks bigger", () => {
    for (let k = 0; k < 20; k++) {
      const { left, right } = buildDotLayout(4, 7, "lure", true, seeded(k + 11));
      expect(left).toHaveLength(4);
      expect(right).toHaveLength(7);
      expect(left[0].d).toBeGreaterThan(right[0].d * 2);
      expect(area(left)).toBeGreaterThan(area(right));
      expect([...left, ...right].every(inside)).toBe(true);
    }
  });

  it("an honest task of the lure setting: one size on both sides", () => {
    const { left, right } = buildDotLayout(4, 7, "lure", false, seeded(5));
    expect(new Set([...left, ...right].map((p) => p.d.toFixed(6))).size).toBe(1);
  });
});

describe("Сравнение — «Как лежат точки» в движке", () => {
  it("applies to dots and dots with a number only", () => {
    expect(dotLayoutFor("dots", "lure")).toBe("lure");
    expect(dotLayoutFor("dots_numbers", "scatter")).toBe("scatter");
    expect(dotLayoutFor("pairing", "lure")).toBe("rows");
    expect(dotLayoutFor("numbers", "scatter")).toBe("rows");
    expect(dotLayoutFor("dots", "bogus")).toBe("rows");
  });

  it("lure: «поровну» comes on by itself, half of the tasks mislead, equal ones too", () => {
    const tasks = generateTasks(MODE_VISUAL, cards, 20, { visualMode: "dots", level: 1, dotLayout: "lure", showEqual: false });
    expect(tasks.every((t) => t.showEqual && t.dotLayout === "lure")).toBe(true);
    const lures = tasks.filter((t) => t.lure);
    expect(lures).toHaveLength(10);
    expect(lures.some((t) => t.left === t.right)).toBe(true);
    expect(lures.some((t) => t.left !== t.right)).toBe(true);
  });

  it("scatter never misleads; pairs keep their columns", () => {
    const scatter = generateTasks(MODE_VISUAL, cards, 10, { visualMode: "dots", level: 1, dotLayout: "scatter" });
    expect(scatter.every((t) => t.dotLayout === "scatter" && !t.lure)).toBe(true);
    const pairs = generateTasks(MODE_VISUAL, cards, 10, { visualMode: "pairing", level: 1, dotLayout: "lure" });
    expect(pairs.every((t) => t.dotLayout === "rows" && !t.lure)).toBe(true);
  });
});

describe("Сравнение — точки после ошибки", () => {
  let container, root;
  afterEach(() => { act(() => root?.unmount()); container?.remove(); vi.useRealTimers(); });

  const task = { type: "compare_visual", left: 4, right: 7, question: "more", showEqual: true, visualMode: "dots", dotLayout: "lure", lure: true, conceptId: "compare_easy", instruction: "Где больше точек?" };
  const sizes = (side) => [...side.querySelectorAll(".compare-field-dot")].map((d) => d.style.width);
  function mount(props) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ComparisonRenderer task={task} mode={MODE_VISUAL} sessionStatus="task_active" onCorrect={() => {}} onIncorrect={() => {}} {...props} />));
    return [...container.querySelectorAll(".compare-side")];
  }

  it("a lure shows big dots on the smaller side, then rows of one size after a mistake", () => {
    vi.useFakeTimers();
    const [left, right] = mount();
    expect(left.classList.contains("compare-side--field")).toBe(true);
    expect(parseFloat(sizes(left)[0])).toBeGreaterThan(parseFloat(sizes(right)[0]));
    act(() => left.click());
    act(() => { vi.advanceTimersByTime(400); });
    expect(new Set([...sizes(left), ...sizes(right)]).size).toBe(1);
  });

  it("the repeat after a mistake starts in rows", () => {
    const [left, right] = mount({ taskRetry: 1 });
    expect(new Set([...sizes(left), ...sizes(right)]).size).toBe(1);
  });
});
