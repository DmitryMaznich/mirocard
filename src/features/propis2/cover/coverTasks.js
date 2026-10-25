import { useMemo } from "react";
import { buildGlyphMap, buildPageTask } from "@/topics/renderers/propis2/pageTask.js";
import { deckPapers, lineWidth, newRow, pageFormat, pageSnap, rowMaxX, rowToLine, taskGrid, pageNoSlant } from "@/topics/renderers/propis2/model.js";
import { digitsOut } from "@/topics/renderers/propis2/fieldText.js";
import { backContent, backPaper } from "./backContent.js";
import { topicAlphabet } from "@/topics/renderers/propis2/alphabet.js";

// The engine tasks a cover draws (in our own hand, on our own paper), each built only when what it depends on changes: switching the
// decoration or the colour builds nothing, the back is built again only when the back changes.
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
// the spine's paper (coverConfig.js spinePaperOf) as the grid of an empty page
const SPINE_GRID = { propis: "regular", square: "square", ruled: "ruled", bg: "bg" };

// `side`: "front" | "back" | "both" — only that side's tasks are built
// `spinePaper`: the spine's paper, resolved (coverConfig.js spinePaperOf); the spine is on both sides, so both build it.
export function useCoverTasks({ topicRecord, cover, format, side = "both", spinePaper = "propis" }) {
  const fmt = format === "a4" ? "a4" : "a5";
  // «Прописи» on the cover is the deck's copybook paper: a variant deck without the Russian slant paper has its own (model.js deckPapers)
  const papers = deckPapers(topicRecord).map((g) => g.id);
  const copybook = papers.includes("propis") ? "propis" : papers[0];
  if (spinePaper === "propis") spinePaper = copybook;
  const glyphMap = useMemo(() => buildGlyphMap(topicRecord), [topicRecord]);
  const spine = cover.enabled && cover.decor === "spine" && fmt === "a5";
  const spineTask = useMemo(
    () => (spine ? buildPageTask({ topicRecord, lines: [], narrowRows: true, grid: SPINE_GRID[spinePaper] ?? "regular", midDash: true, margin: "off", format: "a5" }) : null),
    [spine, spinePaper, topicRecord],
  );
  const backKind = side !== "front" && cover.enabled ? cover.back.kind : "none";
  const backPaperId = cover.back.paper;
  const back = useMemo(() => {
    const content = backContent(backKind, topicAlphabet(topicRecord, glyphMap), topicRecord?.meta?.coverWords);
    if (!content) return null;
    const paper = backPaper(backPaperId, fmt, copybook);
    // a compact block (owner, 2026-10-14, as the backs of the printed series): the heading in our own hand on its first row, centred,
    // then the content row after row; the page around it stays white
    const lines = [centredLine(once(content.heading), glyphMap, paper), ...content.lines];
    const task = buildPageTask({ topicRecord, lines, narrowRows: true, grid: taskGrid(paper), noSlant: pageNoSlant(paper), midDash: true, margin: "off", format: pageFormat(paper) });
    return { ...content, task, rows: lines.length, square: backPaperId === "square" };
  }, [backKind, backPaperId, topicRecord, fmt, glyphMap, copybook]);
  return { spineTask, back };
}
