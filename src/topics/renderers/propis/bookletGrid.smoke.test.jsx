import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import PrintPageView from "./PrintPageView.jsx";
import { buildPageTask } from "../propis2/pageTask.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
SVGElement.prototype.getTotalLength ??= () => 100;

const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8"));
const topicRecord = { wide: wide.glyphs, wideSheets: wide.sheets, elements: JSON.parse(readFileSync("tools/propis/elements.json", "utf-8")).elements, wideElementRepeat: wide.elementRepeat };

// «Тетрадью» (owner, 2026-10-24): the halves of a sheet hold pages 4|1, 2|3. A page's slant grid is shifted by a page width on an odd page
// of the notebook, and its letters snap to it so; drawn by the half of the sheet instead, page 4 (left half) stood 1.5 mm off its letters
describe("booklet print: the dense slant follows the page of the notebook", () => {
  it("pages 2 and 4 drawn shifted, 1 and 3 not, whatever half of the sheet they are on", async () => {
    const task = buildPageTask({ topicRecord, lines: Array.from({ length: 50 }, () => "и"), narrowRows: false, grid: "dense", margin: "left", minPages: 4 });
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(<PrintPageView task={task} booklet pageNumbers onClose={() => {}} />); });
    const firstSlantX = (num) => {
      const svg = document.querySelector(`.propis-print-all [data-page-number="${num}"]`).closest("svg");
      return Math.min(...[...svg.querySelectorAll("line")].filter((l) => l.getAttribute("y1") === "0" && Number(l.getAttribute("y2")) > 1000 && l.getAttribute("x1") !== l.getAttribute("x2")).map((l) => Number(l.getAttribute("x1"))));
    };
    expect([...document.querySelectorAll(".propis-print-all [data-page-number]")].map((g) => g.getAttribute("data-page-number"))).toEqual(["4", "1", "2", "3"]);
    expect(firstSlantX("1")).toBe(0);
    expect(firstSlantX("3")).toBe(0);
    expect(firstSlantX("2")).toBeLessThan(0);
    expect(firstSlantX("4")).toBeLessThan(0);
    await act(async () => root.unmount());
    host.remove();
  });
});
