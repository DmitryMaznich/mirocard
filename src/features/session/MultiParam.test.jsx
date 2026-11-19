import { describe, expect, it, vi } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MultiParam } from "./ParamsScreen";

function render(value, onChange) {
  const div = document.createElement("div");
  act(() => createRoot(div).render(createElement(MultiParam, {
    label: "Где может быть звук", options: ["start", "middle", "end"],
    labels: { start: "Начало", middle: "Середина", end: "Конец" }, value, onChange,
  })));
  return [...div.querySelectorAll("button")];
}

describe("MultiParam — several values on at once", () => {
  it("shows the chosen ones as pressed", () => {
    const b = render(["start", "end"], () => {});
    expect(b.map((x) => x.getAttribute("aria-pressed"))).toEqual(["true", "false", "true"]);
  });
  it("a tap turns a value on, keeping the order of the options", () => {
    const onChange = vi.fn();
    const b1 = render(["end"], onChange); act(() => b1[0].click());
    expect(onChange).toHaveBeenCalledWith(["start", "end"]);
  });
  it("a tap turns a value off, but the last one stays on", () => {
    const onChange = vi.fn();
    const b2 = render(["start", "end"], onChange); act(() => b2[2].click());
    expect(onChange).toHaveBeenCalledWith(["start"]);
    const last = vi.fn();
    const b3 = render(["middle"], last); act(() => b3[1].click());
    expect(last).not.toHaveBeenCalled();
  });
});
