import { describe, it, expect, vi } from "vitest";
import { act } from "react";
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
    const recap = h.container.querySelector(".cm-feedback");
    expect(recap.parentElement).toBe(h.button("Далее →").parentElement);
    expect(recap.compareDocumentPosition(h.button("Далее →")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
  it("drags a single coin, keeps the pile caption in place and does not add twice on release", async () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function () {
      if (this.classList.contains("cm-zone")) {
        return new DOMRect(this.previousElementSibling ? 110 : 0, 0, 110, 200);
      }
      if (this.closest(".cm-pile")) return new DOMRect(50, 250, 28, 28);
      if (this.querySelector(".cm-drag-object") || this.classList.contains("cm-drag-object")) return new DOMRect(50, 250, 28, 28);
      return new DOMRect(0, 0, 0, 0);
    });
    h.mount(BuildNumberTask, task);
    const source = h.button("Взять монету");
    const pointer = (target, type, x, y) => act(() => {
      const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 });
      Object.defineProperty(event, "isPrimary", { value: true });
      target.dispatchEvent(event);
    });
    pointer(source, "pointerdown", 64, 264);
    pointer(document, "pointermove", 150, 120);
    h.frame();
    pointer(document, "pointermove", 151, 121);
    const overlay = document.querySelector(".cm-drag-object");
    expect(overlay).toBeTruthy();
    expect(overlay.querySelectorAll(".cb-coin")).toHaveLength(1);
    expect(overlay.textContent).toBe("");
    expect(h.container.querySelector(".cm-source span").textContent).toBe("Взять монету");
    expect(source.style.transform).toBe("");
    pointer(document, "pointerup", 151, 121);
    await act(async () => {});
    h.click("Взять монету");
    expect(h.container.querySelectorAll(".cm-board .cb-coin")).toHaveLength(1);
  });
});
