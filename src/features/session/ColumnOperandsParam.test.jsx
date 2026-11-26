import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import ColumnOperandsParam, { cellOptionDisabled } from "./ColumnOperandsParam.jsx";
import { normalizeOperands, operandsExample, setOperandCell } from "@/topics/renderers/column_addition/engine.js";

// cells in DOM order: top hundreds, tens, units; bottom hundreds, tens, units
describe("ColumnOperandsParam — a cell picks «любая», 0–9 or «нет»", () => {
  let container, root, value;
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  function mount(start, operation = "add") {
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    function App() { const [v, setV] = useState(start); value = v; return <ColumnOperandsParam value={v} operation={operation} regroup={{ carry: "any", borrow: "any" }} onChange={setV} />; }
    act(() => root.render(<App />));
  }
  const cell = (i) => container.querySelectorAll(".cop-cell")[i];
  const option = (text) => [...container.querySelectorAll(".cdp-option")].find((b) => b.textContent === text);
  const pick = (i, text) => { act(() => cell(i).click()); act(() => option(text).click()); };

  it("an empty cell grows the number, «нет» cuts it, 0 and digits stay in their cell", () => {
    mount({ top: 2, topZeros: [], bottom: 2, bottomZeros: [] });
    pick(0, "любая");
    expect(value.top).toBe(3);
    pick(1, "0");
    pick(2, "5");
    expect(value).toEqual({ top: 3, topZeros: [1], topFixed: { 0: 5 }, bottom: 2, bottomZeros: [] });
    pick(2, "любая");
    expect(value.topFixed).toBeUndefined();
    pick(1, "нет"); // the tens go — and the hundreds with them
    expect(value.top).toBe(1);
    pick(3, "любая"); // the bottom may be longer than the top: 5 + 326
    expect(value.bottom).toBe(3);
    expect(container.querySelector(".cdp-picker")).toBeNull();
  });

  it("no 0 where it would lead the number, no «нет» for the units", () => {
    const o = normalizeOperands({ top: 2, topZeros: [], bottom: 1, bottomZeros: [] });
    expect(cellOptionDisabled(o, "top", 1, 0)).toBe(true);
    expect(cellOptionDisabled(o, "top", 2, 0)).toBe(true);
    expect(cellOptionDisabled(o, "top", 0, 0)).toBe(false);
    expect(cellOptionDisabled(o, "top", 0, "none")).toBe(true);
    expect(cellOptionDisabled(o, "top", 1, 7)).toBe(false);
  });

  it("a fixed digit draws only that digit; all cells fixed — one example, said so", () => {
    let o = normalizeOperands({ top: 2, topZeros: [], bottom: 1, bottomZeros: [] });
    o = setOperandCell(o, "bottom", 0, 9);
    for (let i = 0; i < 30; i++) expect(operandsExample(o, "add", "mixed").bottom).toBe(9);
    mount({ top: 2, topZeros: [], topFixed: { 1: 4, 0: 5 }, bottom: 1, bottomZeros: [], bottomFixed: { 0: 9 } });
    expect(container.querySelector(".cop-note").textContent).toMatch(/один и тот же/);
    expect(container.querySelector(".cop-example__numbers").textContent).toBe("45 + 9");
  });

  it("with a «−» the bottom is no longer than the top: extra cells off, a longer bottom cut", () => {
    mount({ top: 2, topZeros: [], bottom: 3, bottomZeros: [] }, "subtract");
    expect(value.bottom).toBe(2); // cut and saved as shown
    expect(cell(3).disabled).toBe(true);
    expect(container.querySelector(".cop-note")).toBeNull();
    expect(container.querySelector(".cop-example__numbers").textContent).toMatch(/^\d{2} − \d{1,2}$/);
  });

  it("digits that cannot borrow say so (▢9 − ▢ with «С займом» → without)", () => {
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<ColumnOperandsParam value={{ top: 2, topZeros: [], topFixed: { 0: 9 }, bottom: 1, bottomZeros: [] }} operation="subtract" regroup={{ carry: "with", borrow: "with" }} onChange={() => {}} />));
    expect(container.querySelector(".cop-note").textContent).toMatch(/заёма не бывает/);
  });
});
