// Dev harness: draws words/rows the way the app prints them (the same PrintPageView + buildPageTask), in a browser you can screenshot.
// Copy this file and harness.html to the REPO ROOT as tmp-pdf.jsx / tmp-pdf.html (Vite serves the root), run `npx vite --port 5199 --host 127.0.0.1`,
// then `node tools/propis2/dev/shot-words.mjs '["Вчера мы"]' dense out.png`. DELETE tmp-pdf.* before every commit (never `git add -A` with them there).
// window.showWords(rows, pageOverrides): rows = strings (row kind "element" lets a row be elements by label), pageOverrides e.g. { ruling: "narrow", grid: "dense" }.
import React from "react";
import { createRoot } from "react-dom/client";
import "@/styles.css";
import PrintPageView from "@/topics/renderers/propis/PrintPageView";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { kitToLibraryItems, notebookSections, setToLines, taskGrid, pageNoSlant, pageMidDash, pageMargin, pageFormat } from "@/topics/renderers/propis2/model.js";
import kitsJson from "@/topics/renderers/propis2/kits.json";
import wide from "./tools/propis/wide.json";
import elements from "./tools/propis/elements.json";
import topic from "./tools/propis2/topic.json";
const topicRecord = { ...topic, wide: wide.glyphs /* + extra glyphs for experiments: [...wide.glyphs, ...extra] */, wideSheets: wide.sheets, elements: elements.elements, wideElementRepeat: wide.elementRepeat };
const glyphMap = buildGlyphMap(topicRecord);
window.showWords = (words, pageOver) => {
  const base = kitsJson.kits.find((k) => k.id === "s05-letters-e");
  const kit = { id: "tmp", title: "tmp", page: { ...base.page, ...(pageOver || {}) }, pages: [{ title: "w", rows: words.map((text) => ({ text, kind: "element", repeat: "one", dots: "none", copies: "dash", gap: 1 })) }] };
  const { set, pages } = kitToLibraryItems(kit);
  const byId = new Map(pages.map((p) => [p.id, p]));
  const sec = notebookSections(set, byId, glyphMap)[0];
  const task = buildPageTask({ topicRecord, lines: setToLines(set, byId, glyphMap, sec.pageIds), narrowRows: sec.paper.ruling === "narrow", grid: taskGrid(sec.paper), noSlant: pageNoSlant(sec.paper), midDash: pageMidDash(sec.paper), margin: pageMargin(sec.paper), format: pageFormat(sec.paper), minPages: sec.pages, firstPage: sec.start });
  createRoot(document.getElementById("root")).render(<PrintPageView task={task} startAt={0} pageTotal={sec.pages} />);
};
