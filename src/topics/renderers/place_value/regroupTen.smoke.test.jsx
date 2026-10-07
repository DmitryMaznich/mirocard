import { describe, it, expect, vi } from "vitest";
import RegroupTenTask from "./RegroupTenTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";
const task = { cardId: "x", conceptId: "x", number: 23, initial: { tens: 2, ones: 3 }, after: { tens: 1, ones: 13 } };
describe("RegroupTenTask conservation", () => {
  const h = coinHarness();
  it("allows either stack, preserves original loose coins and gains exactly ten", () => {
    h.mount(RegroupTenTask, task);
    const original = Array.from(h.container.querySelectorAll("[data-coin-id]"));
    h.click("Десяток 1"); h.click("Разложить десяток"); h.flush();
    expect(h.container.querySelectorAll(".cm-board .cb-ten-stack")).toHaveLength(1);
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(13);
    original.forEach((el, i) => expect(h.container.querySelectorAll("[data-coin-id]")[i]).toBe(el));
    expect(h.container.querySelector(".cm-total").textContent).toBe("Число 23");
    expect(h.container.querySelector(".pv-question").textContent).toBe("Сколько теперь единиц?");
  });
  it("retains a wrong answer then shows equal totals only after a checked answer", () => {
    const onCorrect = vi.fn(), onMistake = vi.fn();
    h.mount(RegroupTenTask, task, { onCorrect, onMistake });
    h.click("Десяток 2"); h.click("Разложить десяток"); h.flush();
    h.click("1"); h.click("2"); h.click("Проверить");
    expect(h.container.querySelector("output").textContent).toBe("12");
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelector(".pv-regroup-compare")).toBeNull();
    h.click("Стереть цифру"); h.click("3"); h.click("Проверить");
    expect(h.container.querySelector(".pv-regroup-compare").textContent).toContain("1 десяток и 13 единиц = 23");
    expect(onCorrect).not.toHaveBeenCalled(); h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("x", "x");
  });
  it("reverses the same exchange and permits another trial without changing total", () => {
    h.mount(RegroupTenTask, task);
    h.click("Десяток 1"); h.click("Разложить десяток"); h.flush();
    h.click("Собрать обратно"); h.flush();
    expect(h.container.querySelectorAll(".cm-board .cb-ten-stack")).toHaveLength(2);
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(3);
    h.click("Десяток 2"); h.click("Разложить десяток"); h.flush();
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(13);
  });
  it("omits reverse assistance in independent trials", () => {
    h.mount(RegroupTenTask, { ...task, supportMode: "independent" });
    h.click("Десяток 1"); h.click("Разложить десяток"); h.flush();
    expect(h.button("Собрать обратно")).toBeUndefined();
  });
});
