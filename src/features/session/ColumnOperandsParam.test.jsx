import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, afterEach } from "vitest";
import ColumnOperandsParam from "./ColumnOperandsParam.jsx";

// cells in DOM order: top hundreds, tens, units; bottom hundreds, tens, units
describe("ColumnOperandsParam — cells", () => {
  let container, root, value;
  afterEach(() => { act(() => root.unmount()); container.remove(); });
  function mount(start) {
    container = document.createElement("div"); document.body.appendChild(container);
    root = createRoot(container);
    function App() { const [v, setV] = useState(start); value = v; return <ColumnOperandsParam value={v} operation="add" carryMode="mixed" onChange={setV} />; }
    act(() => root.render(<App />));
  }
  const cell = (i) => container.querySelectorAll(".cop-cell")[i];
  const tap = (i) => act(() => cell(i).click());

  it("a zero goes into any cell but the leading one; the leading one says why", () => {
    mount({ top: 3, topZeros: [], bottom: 2, bottomZeros: [] });
    tap(1); tap(2); tap(5);
    expect(value).toEqual({ top: 3, topZeros: [0, 1], bottom: 2, bottomZeros: [0] });
    tap(0); // leading cell of the top
    expect(value.top).toBe(3);
    expect(container.querySelector(".cop-note").textContent).toContain("не начинается с нуля");
    tap(1); // again — back to any digit
    expect(value.topZeros).toEqual([0]);
  });

  it("«×» on the leading cell removes a digit; an empty cell grows the number", () => {
    mount({ top: 3, topZeros: [], bottom: 2, bottomZeros: [] });
    const removes = () => container.querySelectorAll(".cop-remove");
    expect(removes()).toHaveLength(2); // top 3 → 2, bottom 2 → 1
    act(() => removes()[1].click());
    expect(value.bottom).toBe(1);
    expect(removes()).toHaveLength(1); // a one-digit bottom can't shrink
    tap(4);
    expect(value.bottom).toBe(2);
  });
});
