import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import ColumnOperandsParam, { tapCell } from "./ColumnOperandsParam.jsx";

// cells in DOM order: top hundreds, tens, units; bottom hundreds, tens, units
describe("ColumnOperandsParam — one gesture for every cell", () => {
  let container, root, value;
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  function mount(start, operation = "add") {
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    function App() { const [v, setV] = useState(start); value = v; return <ColumnOperandsParam value={v} operation={operation} carryMode="mixed" onChange={setV} />; }
    act(() => root.render(<App />));
  }
  const tap = (i) => act(() => container.querySelectorAll(".cop-cell")[i].click());

  it("empty cell — the number grows; again — 0 where it can stand, otherwise off", () => {
    mount({ top: 2, topZeros: [], bottom: 2, bottomZeros: [] });
    tap(0); // top grows to 3
    expect(value.top).toBe(3);
    tap(1); tap(2); // zeros in the tens and units
    expect(value.topZeros).toEqual([0, 1]);
    tap(1); // a 0 again — any digit
    expect(value.topZeros).toEqual([0]);
    tap(0); // the leading digit takes no 0 — off
    expect(value.top).toBe(2);
    tap(3); // the bottom may be longer than the top: 25 + 326
    expect(value).toEqual({ top: 2, topZeros: [0], bottom: 3, bottomZeros: [] });
    expect(container.querySelector(".cop-remove")).toBeNull();
  });

  it("a one-digit number keeps its digit", () => {
    expect(tapCell({ top: 1, topZeros: [], bottom: 1, bottomZeros: [] }, "bottom", 0)).toEqual({ top: 1, topZeros: [], bottom: 1, bottomZeros: [] });
  });

  it("with a «−» the bottom is no longer than the top: extra cells off, a longer bottom cut", () => {
    mount({ top: 2, topZeros: [], bottom: 3, bottomZeros: [] }, "subtract");
    expect(value.bottom).toBe(2); // cut and saved as shown
    const bottomHundreds = container.querySelectorAll(".cop-cell")[3];
    expect(bottomHundreds.disabled).toBe(true);
    expect(container.querySelector(".cop-note")).toBeNull();
    expect(container.querySelector(".cop-example__numbers").textContent).toMatch(/^\d{2} − \d{1,2}$/);
  });
});
