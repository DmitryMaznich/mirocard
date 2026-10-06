import { describe, it, expect, vi } from "vitest";
import IdentifyNumberTask from "./IdentifyNumberTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";
const task = { cardId: "x", conceptId: "x", number: 23, model: { tens: 2, ones: 3 } };
describe("IdentifyNumberTask explicit checking", () => {
  const h = coinHarness();
  it("requires checking even a correct whole-number entry", () => {
    const onCorrect = vi.fn();
    h.mount(IdentifyNumberTask, task, { onCorrect });
    h.click("2"); h.click("3");
    expect(h.container.querySelector(".pv-question").textContent).toBe("Какое это число?");
    h.click("Проверить");
    expect(h.container.querySelector(".pv-question").textContent).toBe("Правильно!");
    expect(h.container.querySelector("output").textContent).toBe("23");
    const recap = h.container.querySelector(".cm-feedback");
    expect(recap.parentElement).toBe(h.button("Далее →").parentElement);
    expect(recap.compareDocumentPosition(h.button("Далее →")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(onCorrect).not.toHaveBeenCalled(); h.click("Далее →");
    expect(onCorrect).toHaveBeenCalledWith("x", "x");
  });
  it("keeps incorrect digits and permits correction without waiting for a timeout", () => {
    const onMistake = vi.fn();
    h.mount(IdentifyNumberTask, task, { onMistake });
    h.click("2"); h.click("9"); h.click("Проверить"); h.flush();
    expect(h.container.querySelector("output").textContent).toBe("29");
    expect(onMistake).toHaveBeenCalledTimes(1);
    h.click("Стереть цифру"); h.click("3"); h.click("Проверить");
    expect(h.container.querySelector(".pv-question").textContent).toBe("Правильно!");
  });
  it("reads single digits and round tens without padded input or a target-length hint", () => {
    h.mount(IdentifyNumberTask, { ...task, number: 7, model: { tens: 0, ones: 7 } });
    expect(h.container.querySelectorAll(".cm-board .cb-ten-stack")).toHaveLength(0);
    h.click("7"); h.click("Проверить");
    expect(h.container.querySelector(".pv-question").textContent).toBe("Правильно!");
  });
  it("marks counted objects without counting for the child", () => {
    h.mount(IdentifyNumberTask, task);
    h.click("Посчитать"); h.click("Десяток 1"); h.click("Монета 1");
    expect(h.container.querySelectorAll(".cm-counted")).toHaveLength(2);
    expect(h.container.querySelector("output").textContent).toBe("?");
    h.click("Закончить счёт");
    expect(h.container.querySelectorAll(".cm-counted")).toHaveLength(0);
  });
  it("disables counting assistance in independent trials and renders the full 99 model", () => {
    h.mount(IdentifyNumberTask, { ...task, number: 99, model: { tens: 9, ones: 9 }, supportMode: "independent" });
    expect(h.button("Посчитать")).toBeUndefined();
    expect(h.container.querySelectorAll(".cm-board .cb-ten-stack")).toHaveLength(9);
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(9);
  });
});
