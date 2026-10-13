import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScreenHints from "./ScreenHints";

describe("ScreenHints", () => {
  let root, container, targets, steps, onClose;
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    targets = [document.createElement("button"), document.createElement("button")];
    steps = targets.map((target, index) => {
      document.body.appendChild(target);
      target.getBoundingClientRect = () => ({ left: 20, right: 300, top: 120 + index * 90, bottom: 180 + index * 90, width: 280, height: 60 });
      const targetRef = createRef();
      targetRef.current = target;
      return { targetRef, title: index ? "Выберите тип занятия" : "Выберите тему занятия", text: "Нажмите на карточку" };
    });
    onClose = vi.fn();
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    targets.forEach((target) => target.remove());
    vi.unstubAllGlobals();
  });
  const mount = () => act(() => root.render(<ScreenHints steps={steps} onClose={onClose} />));
  const click = (label) => act(() => [...document.querySelectorAll(".screen-hints button")].find((button) => button.textContent === label).click());

  it("moves the outline with the step and supports back, finish and restart", () => {
    mount();
    expect(document.querySelector('[role="dialog"]').textContent).toContain("Выберите тему занятия");
    expect(document.querySelector(".screen-hints__target").style.top).toBe("117px");
    click("Далее");
    expect(document.querySelector('[role="dialog"]').textContent).toContain("Выберите тип занятия");
    expect(document.querySelector(".screen-hints__target").style.top).toBe("207px");
    click("Назад");
    expect(document.querySelector(".screen-hints__target").style.top).toBe("117px");
    click("Далее");
    click("Готово");
    expect(onClose).toHaveBeenCalledOnce();
    act(() => root.render(null));
    mount();
    expect(document.querySelector('[role="dialog"]').textContent).toContain("Выберите тему занятия");
  });

  it("closes with Escape or the close button and restores focus on unmount", () => {
    targets[0].focus();
    mount();
    expect(document.activeElement).toBe(document.querySelector('[role="dialog"]'));
    act(() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(onClose).toHaveBeenCalledOnce();
    act(() => document.querySelector('[aria-label="Скрыть подсказки"]').click());
    expect(onClose).toHaveBeenCalledTimes(2);
    act(() => root.render(null));
    expect(document.activeElement).toBe(targets[0]);
    expect(document.querySelector(".screen-hints")).toBeNull();
  });

  it("tracks scrolling and cleans up event listeners", () => {
    mount();
    targets[0].getBoundingClientRect = () => ({ left: 20, right: 300, top: 40, bottom: 100, width: 280, height: 60 });
    act(() => document.dispatchEvent(new Event("scroll")));
    expect(document.querySelector(".screen-hints__target").style.top).toBe("37px");
    act(() => root.render(null));
    onClose.mockClear();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
