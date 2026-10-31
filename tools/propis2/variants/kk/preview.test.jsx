import { act } from "react";
import { createRoot } from "react-dom/client";
import { it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import PrintPageView from "../propis/PrintPageView.jsx";
import { buildPageTask } from "./pageTask.js";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
it("dump", () => {
  if (!globalThis.ResizeObserver) globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  if (!window.matchMedia) window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  const wide = JSON.parse(readFileSync("tools/propis/wide.json", "utf-8")).glyphs;
  const kk = JSON.parse(readFileSync(process.env.KK_GLYPHS, "utf-8"));
  const labels = new Set(kk.map((g) => g.label));
  const topicRecord = { wide: [...wide.filter((g) => !labels.has(g.label)), ...kk], elements: [], meta: { script: { growJoins: true, topJoins: true } } };
  const task = buildPageTask({ topicRecord, lines: JSON.parse(process.env.KK_LINES), grid: process.env.KK_GRID || "regular" });
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  act(() => root.render(<PrintPageView task={task} onClose={() => {}} />));
  const svg = host.querySelector("svg.propis-print-page-svg");
  expect(svg).toBeTruthy();
  writeFileSync(process.env.KK_OUT, svg.outerHTML.replace('class="propis-paper"', 'fill="#fffdf8"'));
});
