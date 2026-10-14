import { useMemo } from "react";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { lineWidth, newRow, pageFormat, pageSnap, rowMaxX, rowToLine, taskGrid } from "@/topics/renderers/propis2/model.js";
import { digitsOut } from "@/topics/renderers/propis2/fieldText.js";
import { backContent, backPaper } from "./backContent.js";
import { coverTitle } from "./coverConfig.js";

// The engine tasks a cover draws (in our own hand, on our own paper), each built only when what it depends on changes: switching the
// decoration or the colour builds nothing, the back is built again only when the back changes.
const WIDE = { narrowRows: false, grid: "regular", midDash: true, margin: "off" };
// a line written once (no start dots, no copies)
const once = (text) => rowToLine(newRow({ text: digitsOut(text), repeat: "one", dots: "none" }));

// A line centred on its row: the engine has no centring, but a row can start N cells in (`#iN`). The cell is measured, not assumed
// (it differs between the rulings and the squared paper), from the line's width with and without an indent.
export function centredLine(line, glyphMap, paper) {
  const ruling = taskGrid(paper) === "square" || paper.ruling === "narrow" ? "narrow" : "wide";
  const snap = pageSnap(paper);
  const w = lineWidth(line, glyphMap, ruling, snap);
  const cell = (lineWidth(`${line}#i4`, glyphMap, ruling, snap) - w) / 4;
  if (!(cell > 0)) return line;
  const n = Math.max(0, Math.round((rowMaxX(paper) - w) / 2 / cell));
  return `${line}#i${n}`;
}
// the decoration band of copybook elements: one element, its copies solid along the row
const ELEMENTS_BAND = rowToLine(newRow({ kind: "element", text: "заборчик", repeat: "all", dots: "none", copies: "solid" }));

// `side`: "front" | "back" | "both" — only that side's tasks are built
export function useCoverTasks({ topicRecord, cover, notebookTitle, format, side = "both" }) {
  const front = side !== "back";
  const fmt = format === "a4" ? "a4" : "a5";
  const name = coverTitle(cover, notebookTitle);
  const cursive = front && cover.enabled && cover.title.style === "cursive";
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  // the name written once, centred: on the WIDE ruling (large, like the title line of the printed copybooks) when it fits, on the
  // narrow one (half the size) when it does not — a long name used to be cut off at the page edge
  const titleTask = useMemo(() => {
    if (!cursive) return null;
    const line = once(name);
    const wide = { ...WIDE, gridKind: "propis", ruling: "wide", format: fmt };
    const fits = lineWidth(line, glyphMap, "wide", pageSnap(wide)) <= rowMaxX(wide);
    const paper = fits ? wide : { ...wide, narrowRows: true, ruling: "narrow" };
    return buildPageTask({ topicRecord, lines: [centredLine(line, glyphMap, paper)], ...WIDE, narrowRows: !fits, format: fmt });
  }, [cursive, name, topicRecord, fmt, glyphMap]);
  const decor = front && cover.enabled ? cover.decor : "none";
  const bandTask = useMemo(() => (decor === "ruling-band" ? buildPageTask({ topicRecord, lines: [], ...WIDE, format: fmt }) : null), [decor, topicRecord, fmt]);
  const elementsTask = useMemo(() => (decor === "elements-band" ? buildPageTask({ topicRecord, lines: [ELEMENTS_BAND], ...WIDE, format: fmt }) : null), [decor, topicRecord, fmt]);
  const backKind = side !== "front" && cover.enabled ? cover.back.kind : "none";
  const backPaperId = cover.back.paper;
  const back = useMemo(() => {
    const content = backContent(backKind);
    if (!content) return null;
    const paper = backPaper(backPaperId, fmt);
    // a compact block (owner, 2026-10-14, as the backs of the printed series): the heading in our own hand on its first row, centred,
    // then the content row after row; the page around it stays white
    const lines = [centredLine(once(content.heading), glyphMap, paper), ...content.lines];
    const task = buildPageTask({ topicRecord, lines, narrowRows: true, grid: taskGrid(paper), midDash: true, margin: "off", format: pageFormat(paper) });
    return { ...content, task, rows: lines.length, square: backPaperId === "square" };
  }, [backKind, backPaperId, topicRecord, fmt, glyphMap]);
  return { titleTask, bandTask, elementsTask, back };
}
