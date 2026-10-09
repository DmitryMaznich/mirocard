import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import GroupTenTask, { heapLayout } from "./GroupTenTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const task = (number, extra = {}) => ({ type: "group_ten", cardId: "g", conceptId: "g", number, tens: Math.floor(number / 10), ones: number % 10, seed: 42, showFrame: true, ...extra });

describe("GroupTenTask", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const take = (n) => { for (let i = 0; i < n; i++) h.click("Монета из россыпи"); };
  const answer = (n) => { for (const d of String(n)) h.click(d); h.click("Проверить"); };

  it("shows a heap and no number until the child has answered", () => {
    h.mount(GroupTenTask, task(23));
    expect(count(".sg-heap-coin")).toBe(23);
    expect(Array.from(h.container.querySelectorAll(".sg-heap, .fp-value")).map((e) => e.textContent).join("")).not.toContain("23");
  });

  const field = (label) => h.container.querySelector(`output[aria-label="${label}"]`).textContent;

  it("frame → stack → answers typed straight into the fields → spoken model", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(GroupTenTask, task(13), { onCorrect, onMistake });
    expect(h.button("Больше не сложить")).toBeUndefined();
    take(10);
    expect(count(".px-tf .px-coin")).toBe(10);
    expect(count(".sg-heap-coin")).toBe(3);
    // The full frame itself is the button; the stack lands right beside it.
    expect(h.button("Сложить в стопку").classList).toContain("px-tf--ready");
    h.click("Сложить в стопку"); h.flush();
    expect(count(".sg-stacks .cb-ten-stack")).toBe(1);
    expect(count(".px-tf .px-coin")).toBe(0);
    h.click("1");
    expect(field("Десятки")).toBe("1");
    h.click("Проверить");
    expect(h.container.querySelector(".fp-field--active output").getAttribute("aria-label")).toBe("Единицы");
    answer(3); answer(13);
    expect(h.container.querySelector(".px-say")).toBeNull();
    expect(field("Какое это число?")).toBe("13");
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
    expect(count(".sg-heap-coin")).toBe(10);
  });

  it("answer fields, number and keypad have their places from the start but show only when no more stacks can be made", () => {
    h.mount(GroupTenTask, task(23));
    const shown = () => count(".sg-reveal.sg-show");
    expect(count(".sg-reveal")).toBe(4);
    expect(shown()).toBe(0);
    expect(h.button("1").disabled).toBe(true);
    take(10); h.click("Сложить в стопку"); h.flush();
    expect(shown()).toBe(0);
    const rows = h.container.querySelector(".sg-heapbox").style.gridTemplateRows;
    take(10); h.click("Сложить в стопку"); h.flush();
    expect(shown()).toBe(4);
    // The heap is not laid out again: same grid, coins where they were.
    expect(h.container.querySelector(".sg-heapbox").style.gridTemplateRows).toBe(rows);
    expect(count(".sg-heap-coin")).toBe(3);
    expect(h.container.querySelector(".fp-field--active output").getAttribute("aria-label")).toBe("Десятки");
    answer(2); answer(3); answer(23);
    expect(field("Какое это число?")).toBe("23");
  });

  it("without the frame the child counts ten alone; a wrong stack goes back to the heap", () => {
    const onMistake = vi.fn();
    h.mount(GroupTenTask, task(12, { showFrame: false }), { onMistake });
    expect(count(".px-tf-slot")).toBe(0);
    take(9);
    h.click("Сложить в стопку");
    expect(h.container.querySelector(".sg-status").textContent).toContain("ровно десять");
    expect(count(".sg-stacks .cb-ten-stack")).toBe(0);
    expect(count(".sg-heap-coin")).toBe(12);
    take(10);
    h.click("Сложить в стопку"); h.flush();
    expect(count(".sg-stacks .cb-ten-stack")).toBe(1);
    expect(count(".sg-heap-coin")).toBe(2);
  });

  it("a wrong total in «Обучение» gets the count-by-tens prompt; round tens end with «0 единиц»", () => {
    const onMistake = vi.fn();
    h.mount(GroupTenTask, task(20), { onMistake });
    take(10); h.click("Сложить в стопку"); h.flush();
    take(10); h.click("Сложить в стопку"); h.flush();
    answer(2); answer(0); answer(2);
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector(".sg-status").textContent).toContain("Стопок 2 — это двадцать");
    h.click("Стереть цифру"); answer(20);
    expect(field("Единицы")).toBe("0");
    expect(field("Какое это число?")).toBe("20");
  });

  it("the written how-to-start hint waits for a pause", () => {
    h.mount(GroupTenTask, task(13));
    expect(h.container.querySelector(".sg-status").textContent).toBe("");
    act(() => vi.advanceTimersByTime(6000));
    expect(h.container.querySelector(".sg-status").textContent).toContain("Перенеси монету в рамку");
  });
});

describe("GroupTenTask — the hand and dragging", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;

  it("after a pause a hand shows how to take a coin into the frame, and goes on the first action", () => {
    h.mount(GroupTenTask, task(13));
    expect(h.container.querySelector(".sg-hand")).toBeNull();
    act(() => vi.advanceTimersByTime(3000));
    expect(h.container.querySelector(".sg-hand--move")).not.toBeNull();
    h.click("Монета из россыпи");
    expect(h.container.querySelector(".sg-hand")).toBeNull();
  });

  it("a full frame waiting too long gets a tapping hand", () => {
    h.mount(GroupTenTask, task(13));
    for (let i = 0; i < 10; i++) h.click("Монета из россыпи");
    act(() => vi.advanceTimersByTime(6000));
    expect(h.container.querySelector(".sg-hand--tap")).not.toBeNull();
  });

  it("the columns are named, and their answer fields show only a box", () => {
    h.mount(GroupTenTask, task(13));
    expect(Array.from(h.container.querySelectorAll(".sg-head")).map((e) => e.textContent)).toEqual(["Десятки", "Единицы"]);
    expect(count(".sg-bench .fp-label")).toBe(0);
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
