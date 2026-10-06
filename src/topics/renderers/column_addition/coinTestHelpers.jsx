import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, vi } from "vitest";

export function coinHarness() {
  let root, container;
  let animationDescriptor;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    vi.stubGlobal("requestAnimationFrame", (fn) => setTimeout(() => fn(0), 1));
    vi.stubGlobal("cancelAnimationFrame", clearTimeout);
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("matchMedia", () => ({ matches: false, addListener() {}, removeListener() {} }));
    animationDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate");
    Object.defineProperty(Element.prototype, "animate", { configurable: true, value: vi.fn((_frames, options) => {
      const animation = { onfinish: null, cancel: () => clearTimeout(timer) };
      const timer = setTimeout(() => animation.onfinish?.(), options.duration + options.delay);
      return animation;
    }) });

  });
  afterEach(() => {
    if (root) act(() => root.unmount());
    container?.remove();
    root = null;
    if (animationDescriptor) Object.defineProperty(Element.prototype, "animate", animationDescriptor);
    else delete Element.prototype.animate;
    vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  });
  function mount(Component, task, handlers = {}) {
    container = document.createElement("div"); document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<Component task={task} onCorrect={handlers.onCorrect ?? vi.fn()} onMistake={handlers.onMistake ?? vi.fn()} onFlashIncorrect={handlers.onFlashIncorrect ?? vi.fn()} />));
    return container;
  }
  function button(label) {
    return Array.from(container.querySelectorAll("button")).find((b) => b.getAttribute("aria-label") === label || b.textContent === label);
  }
  function click(label) { const b = button(label); if (!b) throw new Error("Missing button: " + label); act(() => b.click()); }
  function flush() { act(() => vi.runAllTimers()); }
  function frame() { act(() => vi.advanceTimersByTime(1)); }
  function unmount() { act(() => root.unmount()); root = null; }
  return { mount, button, click, flush, frame, unmount, get container() { return container; } };
}
