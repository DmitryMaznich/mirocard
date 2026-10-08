import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import GroupTenTask, { heapLayout } from "./GroupTenTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const task = (number, extra = {}) => ({ type: "group_ten", cardId: "g", conceptId: "g", number, tens: Math.floor(number / 10), ones: number % 10, seed: 42, supportMode: "learning", showFrame: true, ...extra });

describe("GroupTenTask", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const take = (n) => { for (let i = 0; i < n; i++) h.click("Монета из россыпи"); };
  const answer = (n) => { for (const d of String(n)) h.click(d); h.click("Проверить"); };

  it("shows a heap and no number until the child has answered", () => {
    h.mount(GroupTenTask, task(23));
    expect(count(".gt-heap-coin")).toBe(23);
    expect(h.container.textContent).not.toContain("23");
  });

  it("frame → stack → «Больше не сложить» → three questions → spoken model", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(GroupTenTask, task(13), { onCorrect, onMistake });
    take(10);
    expect(count(".px-tf .px-coin")).toBe(10);
    expect(count(".gt-heap-coin")).toBe(3);
    // The full frame itself is the button; the stack lands right beside it.
    expect(h.button("Сложить в стопку").classList).toContain("px-tf--ready");
    h.click("Сложить в стопку"); h.flush();
    expect(count(".gt-bench-stacks .cb-ten-stack")).toBe(1);
    expect(count(".px-tf .px-coin")).toBe(0);
    h.click("Больше не сложить");
    expect(h.container.querySelector(".gt-q--active").textContent).toContain("Сколько стопок?");
    answer(1); answer(3); answer(13);
    expect(h.container.querySelector(".px-say").textContent).toBe("1 десяток и 3 единицы — тринадцать");
    expect(onMistake).not.toHaveBeenCalled();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("g", "g");
  });

  it("a frame coin can be put back, and the frame cannot be closed before ten", () => {
    h.mount(GroupTenTask, task(13));
    take(4);
    expect(h.button("Сложить в стопку")).toBeUndefined();
    expect(h.container.querySelector(".px-tenframe h3, .px-tf-count")).toBeNull();
    h.click("Монета в рамке 2");
    expect(count(".px-tf .px-coin")).toBe(3);
    expect(count(".gt-heap-coin")).toBe(10);
  });

  it("stopping while ten more could be stacked: hint in «Обучение», one mistake in «Проверка»", () => {
    const onMistake = vi.fn();
    h.mount(GroupTenTask, task(23), { onMistake });
    take(10); h.click("Сложить в стопку"); h.flush();
    h.click("Больше не сложить");
    expect(h.container.querySelector(".px-hint").textContent).toContain("можно сложить ещё одну стопку?");
    expect(h.container.querySelector(".gt-heap.px-glow")).not.toBeNull();
    expect(onMistake).not.toHaveBeenCalled();
    h.unmount();
    h.mount(GroupTenTask, task(23, { supportMode: "independent" }), { onMistake });
    h.click("Больше не сложить"); h.click("Больше не сложить");
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector(".px-hint")).toBeNull();
    expect(h.container.querySelector(".gt-questions")).toBeNull();
  });

  it("without the frame the child counts ten alone; a wrong stack goes back to the heap", () => {
    const onMistake = vi.fn();
    h.mount(GroupTenTask, task(12, { showFrame: false }), { onMistake });
    expect(count(".px-tf-slot")).toBe(0);
    take(9);
    h.click("Сложить в стопку");
    expect(h.container.querySelector(".px-note").textContent).toContain("ровно десять");
    expect(count(".gt-bench-stacks .cb-ten-stack")).toBe(0);
    expect(count(".gt-heap-coin")).toBe(12);
    take(10);
    h.click("Сложить в стопку"); h.flush();
    expect(count(".gt-bench-stacks .cb-ten-stack")).toBe(1);
    expect(count(".gt-heap-coin")).toBe(2);
  });

  it("a wrong total in «Обучение» gets the count-by-tens prompt; round tens end with «0 единиц»", () => {
    const onMistake = vi.fn();
    h.mount(GroupTenTask, task(20), { onMistake });
    take(10); h.click("Сложить в стопку"); h.flush();
    take(10); h.click("Сложить в стопку"); h.flush();
    h.click("Больше не сложить");
    answer(2); answer(0); answer(2);
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector(".px-note").textContent).toContain("Стопок 2 — это двадцать");
    h.click("Стереть цифру"); answer(20);
    expect(h.container.querySelector(".px-say").textContent).toBe("2 десятка и 0 единиц — двадцать");
  });

  it("the how-to-start hint waits for a pause and only in «Обучение»", () => {
    h.mount(GroupTenTask, task(13));
    expect(h.container.querySelector(".px-hint")).toBeNull();
    act(() => vi.advanceTimersByTime(6000));
    expect(h.container.querySelector(".px-hint").textContent).toContain("Нажимай на монеты");
    h.unmount();
    h.mount(GroupTenTask, task(13, { supportMode: "independent" }));
    act(() => vi.advanceTimersByTime(20000));
    expect(h.container.querySelector(".px-hint")).toBeNull();
  });
});

describe("heapLayout", () => {
  it("gives every coin its own grid cell", () => {
    for (const n of [11, 19, 23, 40, 49]) {
      const { cols, rows, coins } = heapLayout(n, 7);
      expect(coins).toHaveLength(n);
      expect(new Set(coins.map((c) => `${c.col}:${c.row}`)).size).toBe(n);
      for (const c of coins) {
        expect(c.col).toBeLessThan(cols); expect(c.row).toBeLessThan(rows);
        expect(c.jx).toBeGreaterThanOrEqual(0); expect(c.jx).toBeLessThan(1);
      }
    }
  });
});
