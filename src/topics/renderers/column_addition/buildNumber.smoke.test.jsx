import { describe, it, expect, vi } from "vitest";
import BuildNumberTask from "./BuildNumberTask.jsx";
import { coinHarness } from "./coinTestHelpers.jsx";
const task = { cardId: "x", conceptId: "x", number: 13, target: { tens: 1, ones: 3 } };

describe("BuildNumberTask coin lessons", () => {
  const h = coinHarness();
  it("groups before the target is collected, then continues adding units", () => {
    h.mount(BuildNumberTask, task);
    for (let i = 0; i < 10; i++) h.click("Взять монету");
    expect(h.button("Собрать десяток")).toBeTruthy();
    h.click("Собрать десяток"); h.flush();
    expect(h.container.querySelectorAll(".cm-board .cb-ten-stack")).toHaveLength(1);
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(0);
    for (let i = 0; i < 3; i++) h.click("Взять монету");
    h.click("Проверить");
    expect(h.container.querySelector(".pv-question").textContent).toBe("Правильно!");
    expect(h.container.querySelector(".cm-feedback").textContent).toContain("1 десяток и 3 единицы");
  });
  it("supports ready stacks and only advances when the adult-visible next action is pressed", () => {
    const onCorrect = vi.fn();
    h.mount(BuildNumberTask, { ...task, number: 23, target: { tens: 2, ones: 3 }, buildApproach: "ready" }, { onCorrect });
    h.click("Взять десяток"); h.click("Взять десяток");
    for (let i = 0; i < 3; i++) h.click("Взять монету");
    h.click("Проверить"); expect(onCorrect).not.toHaveBeenCalled();
    h.click("Далее →"); expect(onCorrect).toHaveBeenCalledWith("x", "x");
  });
  it("selects without removing and uses separate remove / ungroup actions", () => {
    h.mount(BuildNumberTask, { ...task, buildApproach: "ready" });
    h.click("Взять десяток"); h.click("Десяток 1");
    expect(h.container.querySelectorAll(".cm-board .cb-ten-stack")).toHaveLength(1);
    h.click("Разложить десяток"); h.flush();
    expect(h.container.querySelectorAll(".cm-board .cb-ten-stack")).toHaveLength(0);
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(10);
    h.click("Монета 1"); h.click("Убрать");
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(9);
  });
  it("preserves a wrong construction, distinguishes independent feedback and makes composition optional", () => {
    const onMistake = vi.fn();
    h.mount(BuildNumberTask, { ...task, supportMode: "independent", askComposition: true }, { onMistake });
    h.click("Взять монету"); h.click("Проверить");
    expect(onMistake).toHaveBeenCalledTimes(1);
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(1);
    expect(h.container.querySelector(".cm-feedback").textContent).toBe("Проверь число ещё раз");
    expect(h.container.querySelector(".cm-board").className).not.toContain("focus");
  });
  it("asks composition only when enabled and hides the number while answering", () => {
    h.mount(BuildNumberTask, { ...task, buildApproach: "ready", askComposition: true });
    h.click("Взять десяток"); for (let i = 0; i < 3; i++) h.click("Взять монету");
    h.click("Проверить");
    expect(h.container.querySelector(".cm-target")).toBeNull();
    expect(h.container.querySelector(".pv-question").textContent).toBe("Сколько десятков?");
    h.click("1"); h.click("Проверить"); h.click("3"); h.click("Проверить");
    expect(h.container.querySelector(".pv-question").textContent).toBe("Правильно!");
  });
  it("flies ten coins, locks editing during flight and cancels ghosts on unmount", () => {
    h.mount(BuildNumberTask, task);
    for (let i = 0; i < 10; i++) h.click("Взять монету");
    h.click("Собрать десяток"); h.frame();
    expect(document.querySelectorAll(".cb-coin-fly-ghost")).toHaveLength(10);
    expect(h.button("Взять монету").disabled).toBe(true);
    expect(h.button("Проверить").disabled).toBe(true);
    h.unmount();
    expect(document.querySelectorAll(".cb-coin-fly-ghost")).toHaveLength(0);
    h.flush();
  });
});
