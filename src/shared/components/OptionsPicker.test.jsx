import { describe, it, expect } from "vitest";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import OptionsPicker from "./OptionsPicker.jsx";

const CHOICES = [{ product: "мёд" }, { product: "ягоды" }];

function Controlled({ mode }) {
  const [selected, setSelected] = useState([]);
  return (
    <>
      <OptionsPicker choices={CHOICES} selected={selected} onChange={setSelected} mode={mode} />
      <div id="result">{JSON.stringify(selected)}</div>
    </>
  );
}

let container;
function click(product) {
  const btn = [...container.querySelectorAll(".options-picker__choice")]
    .find((el) => el.textContent.startsWith(product));
  btn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}
function result() {
  return JSON.parse(container.querySelector("#result").textContent);
}

describe("OptionsPicker", () => {
  it("mode=single never empties — clicking the selected choice again keeps it selected", async () => {
    container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<Controlled mode="single" />); });

    await act(async () => { click("мёд"); });
    expect(result()).toEqual(["мёд"]);

    await act(async () => { click("мёд"); });
    expect(result()).toEqual(["мёд"]); // still selected, not toggled off

    await act(async () => { click("ягоды"); });
    expect(result()).toEqual(["ягоды"]); // replaced, not appended
  });

  it("mode=single-optional replaces on a different choice but toggles off on the same one", async () => {
    container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<Controlled mode="single-optional" />); });

    expect(result()).toEqual([]);

    await act(async () => { click("мёд"); });
    expect(result()).toEqual(["мёд"]);

    await act(async () => { click("ягоды"); });
    expect(result()).toEqual(["ягоды"]); // replaced

    await act(async () => { click("ягоды"); });
    expect(result()).toEqual([]); // clicking the active choice again clears it
  });

  it("mode=multi keeps the existing toggle-add/toggle-remove behavior", async () => {
    container = document.createElement("div");
    const root = createRoot(container);
    await act(async () => { root.render(<Controlled mode="multi" />); });

    await act(async () => { click("мёд"); });
    await act(async () => { click("ягоды"); });
    expect(result()).toEqual(["мёд", "ягоды"]);

    await act(async () => { click("мёд"); });
    expect(result()).toEqual(["ягоды"]);
  });
});
