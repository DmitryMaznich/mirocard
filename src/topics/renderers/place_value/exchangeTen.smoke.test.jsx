import { describe, it, expect, vi } from "vitest";
import { act } from "react";
import ExchangeTenTask from "./ExchangeTenTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";

const minus = { cardId: "c", conceptId: "c", op: "give", k: 4, number: 32, start: { tens: 3, ones: 2 }, result: 28, needsExchange: true, supportMode: "learning" };
const plus = { cardId: "c", conceptId: "c", op: "get", k: 4, number: 38, start: { tens: 3, ones: 8 }, result: 42, needsExchange: true, supportMode: "learning" };

describe("ExchangeTenTask — «Плюс и минус через десяток»", () => {
  const h = coinHarness();
  const count = (sel) => h.container.querySelectorAll(sel).length;
  const answer = (n) => { for (const d of String(n)) h.click(d); h.click("Проверить"); };
  const frameCoins = () => count(".sg-frame .px-tf .px-coin");
  const stacks = () => count(".sg-stacks .cb-ten-stack");

  it("shows the example; the ones lie in the frame, the tens in the store", () => {
    h.mount(ExchangeTenTask, minus);
    expect(h.container.querySelector(".xt-example").textContent.replace(/\s+/g, " ").trim()).toBe("32 − 4 = ?");
    expect(stacks()).toBe(3);
    expect(frameCoins()).toBe(2);
    expect(h.container.querySelector(".xt-tray-label").textContent).toBe("−4");
  });

  it("minus «по частям»: take the ones out, open a stack into the empty frame, take the rest, answer", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(ExchangeTenTask, minus, { onCorrect, onMistake });
    // A stack can't be opened while the frame still has coins.
    expect(h.button("Десяток 1").disabled).toBe(true);
    h.click("Монета в рамке 2"); h.click("Монета в рамке 1");
    expect(frameCoins()).toBe(0);
    expect(count(".xt-gone")).toBe(2);
    h.click("Десяток 3"); h.flush();
    expect(stacks()).toBe(2);
    expect(frameCoins()).toBe(10);
    // Ten coins that came from a stack are not offered back as a stack.
    expect(h.container.querySelector(".px-tf--ready")).toBeNull();
    h.click("Монета в рамке 10"); h.click("Монета в рамке 9");
    expect(frameCoins()).toBe(8);
    // All four are gone: nothing more can be taken, the answer comes.
    expect(h.button("Монета в рамке 1").disabled).toBe(true);
    expect(count(".sg-reveal.sg-show")).toBe(2);
    // The tray with the four coins taken out fades: the question is what is left.
    expect(h.container.querySelector(".xt-tray--gone")).not.toBeNull();
    expect(h.container.querySelector('output[aria-label="Сколько осталось?"]')).not.toBeNull();
    answer(28);
    expect(h.container.querySelector(".xt-q").textContent).toBe("28");
    expect(onMistake).not.toHaveBeenCalled();
    h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("c", "c");
  });

  it("minus without a crossing: no stack is ever opened", () => {
    h.mount(ExchangeTenTask, { ...minus, k: 1, result: 31, needsExchange: false });
    h.click("Монета в рамке 1");
    expect(h.button("Десяток 1").disabled).toBe(true);
    expect(count(".sg-reveal.sg-show")).toBe(2);
  });

  it("plus «по частям»: fill the frame, tap it into a stack, bring the rest", () => {
    h.mount(ExchangeTenTask, plus);
    expect(h.container.querySelector(".xt-tray-label").textContent).toBe("+4");
    h.click("Монета из лотка"); h.click("Монета из лотка");
    expect(frameCoins()).toBe(10);
    // The frame is full: the tray waits, the frame is the button.
    expect(h.button("Монета из лотка").disabled).toBe(true);
    h.click("Сложить в стопку"); h.flush();
    expect(stacks()).toBe(4);
    expect(frameCoins()).toBe(0);
    h.click("Монета из лотка"); h.click("Монета из лотка");
    expect(frameCoins()).toBe(2);
    expect(count(".sg-reveal.sg-show")).toBe(2);
    expect(h.container.querySelector(".xt-tray--gone")).not.toBeNull();
    expect(h.container.querySelector('output[aria-label="Сколько стало?"]')).not.toBeNull();
    answer(42);
    expect(h.container.querySelector(".xt-q").textContent).toBe("42");
  });

  it("a round result: the last coin fills the frame, which must become a stack before the answer", () => {
    h.mount(ExchangeTenTask, { ...plus, k: 2, result: 40 });
    h.click("Монета из лотка"); h.click("Монета из лотка");
    expect(count(".sg-reveal.sg-show")).toBe(0);
    h.click("Сложить в стопку"); h.flush();
    expect(count(".sg-reveal.sg-show")).toBe(2);
  });

  it("a wrong answer is a mistake and stays on screen", () => {
    const onMistake = vi.fn();
    h.mount(ExchangeTenTask, { ...minus, k: 1, result: 31, needsExchange: false }, { onMistake });
    h.click("Монета в рамке 1");
    answer(32);
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector(".sg-status-note").textContent).toContain("Посчитай");
    expect(h.container.querySelector(".fp-field--wrong")).not.toBeNull();
  });

  it("«Обучение»: after a pause a hand shows the next move; «Проверка» has none", () => {
    h.mount(ExchangeTenTask, minus);
    act(() => vi.advanceTimersByTime(5000));
    expect(h.container.querySelector(".sg-status-hint").textContent).toContain("Убери монету");
    h.click("Монета в рамке 2"); h.click("Монета в рамке 1");
    act(() => vi.advanceTimersByTime(5000));
    expect(h.container.querySelector(".sg-status-hint").textContent).toContain("Нажми на стопку");
    h.unmount();
    h.mount(ExchangeTenTask, { ...minus, supportMode: "independent" });
    act(() => vi.advanceTimersByTime(20000));
    expect(h.container.querySelector(".sg-status-hint")).toBeNull();
  });
});
