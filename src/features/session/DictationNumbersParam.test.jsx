import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import DictationNumbersParam from "./DictationNumbersParam.jsx";

// cells in DOM order: first number tens, units; second number tens, units
describe("DictationNumbersParam — a cell picks «любая», a digit or «нет»", () => {
  let container, root, value;
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  function mount(start, props = {}) {
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    function App() { const [v, setV] = useState(start); value = v; return <DictationNumbersParam value={v} onChange={setV} {...props} />; }
    act(() => root.render(<App />));
  }
  const cell = (i) => container.querySelectorAll(".cop-cell")[i];
  const open = (i) => act(() => cell(i).click());
  const option = (text) => [...container.querySelectorAll(".cdp-option")].find((b) => b.textContent === text);
  const pick = (text) => act(() => option(text).click());

  it("starts as one digit + one digit; the second tap picks and closes", () => {
    mount(undefined);
    expect(value).toEqual({ top: { tens: "none", units: "any" }, bottom: { tens: "none", units: "any" } });
    open(0);
    expect(container.querySelectorAll(".cdp-option")).toHaveLength(12);
    expect(option("0").disabled).toBe(true); // a number never starts with 0
    pick("1");
    expect(value.top.tens).toBe(1);
    expect(container.querySelector(".cdp-picker")).toBeNull();
    expect(cell(0).textContent).toBe("1");
    expect(container.querySelector(".dnp-example__said").textContent).toMatch(/^«/);
  });

  it("units are always there; 0 in the units makes round numbers", () => {
    mount(undefined);
    open(3);
    expect(option("нет").disabled).toBe(true);
    pick("9");
    expect(value.bottom).toEqual({ tens: "none", units: 9 });
    open(3);
    pick("любая");
    expect(value.bottom.units).toBe("any");
  });

  it("with «−» the second number takes no tens over a one-digit first", () => {
    mount({ top: { tens: "none", units: "any" }, bottom: { tens: "any", units: "any" } }, { operation: "subtract" });
    expect(value.bottom.tens).toBe("none");
    expect(cell(2).disabled).toBe(true);
  });

  it("all cells fixed — says it is one and the same example", () => {
    mount({ top: { tens: 1, units: 6 }, bottom: { tens: "none", units: 9 } }, { crossTen: "mixed" });
    expect(container.querySelector(".cop-note").textContent).toMatch(/один и тот же/);
  });

  it("digits that cannot keep the ten setting say so (40 + 30 через десяток)", () => {
    mount({ top: { tens: "any", units: 0 }, bottom: { tens: "any", units: 0 } }, { crossTen: "cross" });
    expect(container.querySelector(".cop-note").textContent).toMatch(/не перейти/);
  });
});
